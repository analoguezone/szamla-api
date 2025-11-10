# NAV Integration Guide

Working with the Hungarian NAV Online Invoice System.

**Related docs**: [Invoice Management](./07-invoices.md) | [Background Jobs](./10-background-jobs.md) | [Troubleshooting](./19-troubleshooting.md)

## Overview

The NAV (Nemzeti Adó- és Vámhivatal - National Tax Authority) online invoice system is **mandatory** for Hungarian businesses. This guide covers integration with NAV API v3.

**Official Documentation**: https://onlineszamla.nav.gov.hu/dokumentaciok

## NAV Concepts

### Technical User

Each organization needs NAV technical user credentials:
- **Login**: Technical username
- **Password**: Technical password
- **Tax Number**: Organization tax number (12345678-1-23)
- **Signature Key**: For request signing
- **Exchange Key**: For encryption

### Operations

1. **manageInvoice**: Submit new invoices or storno
2. **queryTransactionStatus**: Check submission status
3. **queryInvoiceData**: Retrieve invoice from NAV
4. **queryTaxpayer**: Lookup taxpayer information
5. **manageAnnulment**: Cancel invoice operations

### Transaction Flow

```
Submit Invoice → Transaction ID → Poll Status → Confirmed/Failed
     (async)                        (background job)
```

## Implementation

### 1. NAV Connector Service

```typescript
// src/services/nav-connector.ts
import axios from 'axios';
import crypto from 'crypto';

export class NavConnector {
  private baseURL: string;
  private user: NavUserCredentials;
  private software: NavSoftwareData;

  constructor(config: NavConfig) {
    this.baseURL = config.baseURL;
    this.user = config.user;
    this.software = config.software;
  }

  /**
   * Test connection and validate credentials
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.tokenExchange();
      return result.funcCode === 'OK';
    } catch (error) {
      return false;
    }
  }

  /**
   * Submit invoice to NAV
   */
  async manageInvoice(params: ManageInvoiceParams): Promise<ManageInvoiceResult> {
    const requestId = this.generateRequestId();
    const timestamp = this.getTimestamp();

    const request = {
      header: this.createHeader(requestId, timestamp),
      user: this.createUserHeader(requestId, timestamp),
      software: this.software,
      invoiceOperations: {
        compressedContent: false,
        invoiceOperation: params.invoices.map(inv => ({
          index: inv.index,
          operation: params.operation, // CREATE, STORNO, ANNUL
          invoice: Buffer.from(inv.xml).toString('base64')
        }))
      }
    };

    const response = await this.post('/manageInvoice', request);

    return {
      transactionId: response.transactionId,
      funcCode: response.funcCode,
      errorCode: response.errorCode,
      message: response.message
    };
  }

  /**
   * Query transaction status
   */
  async queryTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const requestId = this.generateRequestId();
    const timestamp = this.getTimestamp();

    const request = {
      header: this.createHeader(requestId, timestamp),
      user: this.createUserHeader(requestId, timestamp),
      software: this.software,
      transactionId
    };

    const response = await this.post('/queryTransactionStatus', request);

    return {
      transactionId,
      status: response.processingResults?.status, // PENDING, PROCESSING, DONE, ABORTED
      technicalValidationMessages: response.processingResults?.technicalValidationMessages,
      businessValidationMessages: response.processingResults?.businessValidationMessages
    };
  }

  /**
   * Create request header
   */
  private createHeader(requestId: string, timestamp: string) {
    return {
      requestId,
      timestamp,
      requestVersion: '3.0',
      headerVersion: '1.0'
    };
  }

  /**
   * Create user authentication header
   */
  private createUserHeader(requestId: string, timestamp: string) {
    const passwordHash = crypto
      .createHash('sha512')
      .update(this.user.password)
      .digest('hex')
      .toUpperCase();

    const signatureKey = this.user.signatureKey;
    const signatureBase = `${requestId}${timestamp}${signatureKey}`;
    const requestSignature = crypto
      .createHash('sha3-512')
      .update(signatureBase)
      .digest('hex')
      .toUpperCase();

    return {
      login: this.user.login,
      passwordHash,
      taxNumber: this.user.taxNumber,
      requestSignature
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `REQ${Date.now()}${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get ISO 8601 timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Make POST request to NAV
   */
  private async post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, {
        timeout: 70000, // NAV recommends > 60s
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw new NavApiError(error);
    }
  }
}
```

### 2. NAV Service (Application Layer)

```typescript
// src/services/nav.service.ts
import { NavConnector } from './nav-connector';
import { encryptionService } from './encryption.service';

export const navService = {
  /**
   * Create NAV client for organization
   */
  createClient(organization: Organization): NavConnector {
    const credentials = {
      login: organization.nav_login,
      password: encryptionService.decrypt(organization.nav_password_encrypted),
      taxNumber: organization.tax_number,
      signatureKey: encryptionService.decrypt(organization.nav_signature_key_encrypted),
      exchangeKey: encryptionService.decrypt(organization.nav_exchange_key_encrypted)
    };

    return new NavConnector({
      baseURL: config.nav.baseURL,
      user: credentials,
      software: {
        softwareId: organization.software_id,
        softwareName: organization.software_name,
        softwareOperation: 'LOCAL_SOFTWARE',
        softwareMainVersion: '1.0',
        softwareDevName: organization.software_developer,
        softwareDevContact: organization.software_developer_email,
        softwareDevCountryCode: 'HU',
        softwareDevTaxNumber: organization.software_developer_tax_number
      }
    });
  },

  /**
   * Test NAV connection for organization
   */
  async testConnection(organizationId: string): Promise<TestConnectionResult> {
    const org = await db.organization.findUnique({
      where: { id: organizationId }
    });

    const client = this.createClient(org);
    const startTime = Date.now();

    try {
      const isValid = await client.testConnection();
      const responseTime = Date.now() - startTime;

      await db.organization.update({
        where: { id: organizationId },
        data: {
          nav_connection_tested: isValid,
          nav_last_test_at: new Date()
        }
      });

      return {
        success: isValid,
        responseTimeMs: responseTime,
        testedAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        testedAt: new Date()
      };
    }
  },

  /**
   * Submit invoice to NAV
   */
  async submitInvoice(invoice: Invoice): Promise<NavSubmission> {
    const org = await db.organization.findUnique({
      where: { id: invoice.organization_id }
    });

    // Convert invoice to NAV XML format
    const navXml = await this.convertToNavXml(invoice);

    // Create NAV client
    const client = this.createClient(org);

    // Determine operation type
    const operation = invoice.invoice_type === 'storno' ? 'STORNO' : 'CREATE';

    // Submit to NAV
    const result = await client.manageInvoice({
      operation,
      invoices: [{
        index: 1,
        xml: navXml
      }]
    });

    // Store submission record
    const submission = await db.navSubmission.create({
      data: {
        organization_id: invoice.organization_id,
        invoice_id: invoice.id,
        operation_type: 'manage_invoice',
        operation_subtype: operation.toLowerCase(),
        transaction_id: result.transactionId,
        request_xml: navXml,
        response_json: result,
        status: 'PENDING'
      }
    });

    // Update invoice
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        nav_status: 'submitted',
        nav_transaction_id: result.transactionId
      }
    });

    return submission;
  },

  /**
   * Query transaction status
   */
  async queryTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const submission = await db.navSubmission.findUnique({
      where: { transaction_id: transactionId },
      include: { organization: true }
    });

    if (!submission) {
      throw new Error('NAV submission not found');
    }

    const client = this.createClient(submission.organization);
    const status = await client.queryTransactionStatus(transactionId);

    // Update submission
    await db.navSubmission.update({
      where: { transaction_id: transactionId },
      data: {
        status: status.status,
        processing_results: status,
        last_checked_at: new Date(),
        completed_at: ['DONE', 'ABORTED'].includes(status.status) ? new Date() : null
      }
    });

    // Update invoice if done
    if (status.status === 'DONE' && submission.invoice_id) {
      await db.invoice.update({
        where: { id: submission.invoice_id },
        data: {
          nav_status: 'confirmed',
          nav_confirmed_at: new Date()
        }
      });
    }

    // Handle errors
    if (status.status === 'ABORTED' && submission.invoice_id) {
      await db.invoice.update({
        where: { id: submission.invoice_id },
        data: {
          nav_status: 'failed',
          nav_error: JSON.stringify(status.businessValidationMessages)
        }
      });
    }

    return status;
  },

  /**
   * Convert invoice to NAV XML format
   */
  async convertToNavXml(invoice: Invoice): Promise<string> {
    // Load invoice with items and partner
    const fullInvoice = await db.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: true,
        partner: true
      }
    });

    // Build NAV XML (simplified example)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data">
  <invoiceNumber>${fullInvoice.invoice_number}</invoiceNumber>
  <invoiceIssueDate>${fullInvoice.issue_date.toISOString().split('T')[0]}</invoiceIssueDate>
  <supplierName>${fullInvoice.organization.name}</supplierName>
  <supplierTaxNumber>
    <taxpayerId>${fullInvoice.organization.tax_number.split('-')[0]}</taxpayerId>
    <vatCode>${fullInvoice.organization.tax_number.split('-')[1]}</vatCode>
    <countyCode>${fullInvoice.organization.tax_number.split('-')[2]}</countyCode>
  </supplierTaxNumber>
  <customerName>${fullInvoice.partner.name}</customerName>
  ${fullInvoice.partner.tax_number ? `
  <customerTaxNumber>
    <taxpayerId>${fullInvoice.partner.tax_number.split('-')[0]}</taxpayerId>
  </customerTaxNumber>
  ` : ''}
  <invoiceLines>
    ${fullInvoice.items.map((item, idx) => `
    <line>
      <lineNumber>${idx + 1}</lineNumber>
      <productDescription>${item.name}</productDescription>
      <quantity>${item.quantity}</quantity>
      <unitOfMeasure>${item.unit}</unitOfMeasure>
      <unitPrice>${item.net_unit_price}</unitPrice>
      <lineNetAmount>${item.net_amount}</lineNetAmount>
      <lineVatRate><percentage>${item.vat_rate}</percentage></lineVatRate>
      <lineVatAmount>${item.vat_amount}</lineVatAmount>
      <lineGrossAmountNormal>${item.gross_amount}</lineGrossAmountNormal>
    </line>
    `).join('')}
  </invoiceLines>
  <invoiceNetAmount>${fullInvoice.net_amount}</invoiceNetAmount>
  <invoiceVatAmount>${fullInvoice.vat_amount}</invoiceVatAmount>
  <invoiceGrossAmount>${fullInvoice.gross_amount}</invoiceGrossAmount>
</InvoiceData>`;

    return xml;
  }
};
```

### 3. Background Job for Status Polling

```typescript
// src/jobs/nav-status.job.ts
import { Queue, Worker } from 'bullmq';
import { navService } from '../services/nav.service';

export const navStatusQueue = new Queue('nav-status', {
  connection: redisConnection
});

export const navStatusWorker = new Worker(
  'nav-status',
  async (job) => {
    const { transactionId } = job.data;

    const status = await navService.queryTransactionStatus(transactionId);

    // If still processing, requeue
    if (['PENDING', 'PROCESSING'].includes(status.status)) {
      await navStatusQueue.add(
        'check-status',
        { transactionId },
        { delay: 5000 } // Check again in 5 seconds
      );
    }

    return status;
  },
  { connection: redisConnection }
);
```

## NAV XML Schema

### Invoice Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data">
  <invoiceNumber>INV-2025-00001</invoiceNumber>
  <invoiceIssueDate>2025-01-15</invoiceIssueDate>
  <invoiceDeliveryDate>2025-01-15</invoiceDeliveryDate>

  <!-- Supplier -->
  <supplierName>Example Kft.</supplierName>
  <supplierTaxNumber>
    <taxpayerId>12345678</taxpayerId>
    <vatCode>1</vatCode>
    <countyCode>23</countyCode>
  </supplierTaxNumber>

  <!-- Customer -->
  <customerName>Customer Kft.</customerName>
  <customerTaxNumber>
    <taxpayerId>98765432</taxpayerId>
  </customerTaxNumber>

  <!-- Line Items -->
  <invoiceLines>
    <line>
      <lineNumber>1</lineNumber>
      <productDescription>Product Name</productDescription>
      <quantity>1</quantity>
      <unitOfMeasure>PIECE</unitOfMeasure>
      <unitPrice>10000</unitPrice>
      <lineNetAmount>10000</lineNetAmount>
      <lineVatRate>
        <percentage>27.00</percentage>
      </lineVatRate>
      <lineVatAmount>2700</lineVatAmount>
      <lineGrossAmountNormal>12700</lineGrossAmountNormal>
    </line>
  </invoiceLines>

  <!-- Totals -->
  <invoiceNetAmount>10000</invoiceNetAmount>
  <invoiceVatAmount>2700</invoiceVatAmount>
  <invoiceGrossAmount>12700</invoiceGrossAmount>

  <paymentMethod>TRANSFER</paymentMethod>
  <paymentDate>2025-01-30</paymentDate>
</InvoiceData>
```

## Testing NAV Integration

### Use NAV Test Environment

```env
NAV_BASE_URL=https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3
```

### Mock NAV in Tests

```typescript
jest.mock('../services/nav-connector');

describe('NAV Integration', () => {
  beforeEach(() => {
    NavConnector.prototype.manageInvoice.mockResolvedValue({
      transactionId: 'test_trans_123',
      funcCode: 'OK'
    });
  });

  it('should submit invoice to NAV', async () => {
    const result = await navService.submitInvoice(invoice);

    expect(result.transaction_id).toBe('test_trans_123');
    expect(NavConnector.prototype.manageInvoice).toHaveBeenCalledWith({
      operation: 'CREATE',
      invoices: expect.any(Array)
    });
  });
});
```

## Error Handling

### Common NAV Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `AUTHENTICATION_FAILED` | Invalid credentials | Check NAV credentials |
| `XML_SCHEMA_VALIDATION_ERROR` | Invalid XML | Validate XML against schema |
| `INVOICE_NUMBER_ERROR` | Duplicate invoice number | Check invoice numbering |
| `TAX_NUMBER_ERROR` | Invalid tax number | Validate tax number format |

### Retry Strategy

```typescript
async function submitWithRetry(invoice: Invoice, maxRetries = 3): Promise<NavSubmission> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await navService.submitInvoice(invoice);
    } catch (error) {
      lastError = error;

      if (error.code === 'AUTHENTICATION_FAILED') {
        throw error; // Don't retry auth errors
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

## Best Practices

1. **Always use test environment** during development
2. **Store NAV credentials encrypted** at rest
3. **Poll transaction status** asynchronously (background jobs)
4. **Handle timeouts gracefully** (NAV can be slow)
5. **Log all NAV requests/responses** for debugging
6. **Validate XML** before submission
7. **Test with various invoice types** (domestic, foreign, individual, etc.)

## Next Steps

- **Create invoices**: [Invoice Management](./07-invoices.md)
- **Background processing**: [Background Jobs](./10-background-jobs.md)
- **Troubleshoot NAV issues**: [Troubleshooting](./19-troubleshooting.md)
