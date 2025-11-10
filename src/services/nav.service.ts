import { db } from '@config/database';
import { organizationService, OrganizationWithDecryptedNAV } from './organization.service';
import { invoiceService } from './invoice.service';
import { NotFoundError, ValidationError } from '@utils/errors';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

/**
 * NAV Service
 *
 * Handles integration with Hungarian NAV (Tax Authority) Online Invoice System
 *
 * Features:
 * - NAV 3.0 API authentication
 * - Invoice data submission
 * - Invoice status queries
 * - Connection testing
 * - XML generation for invoice data
 *
 * NAV API Documentation: https://onlineszamla.nav.gov.hu/dokumentaciok
 */

export interface NAVCredentials {
  technicalUser: string;
  signatureKey: string;
  replacementKey: string;
  taxNumber: string;
}

export interface NAVTokenRequest {
  requestId: string;
  timestamp: string;
  requestSignature: string;
}

export interface NAVInvoiceData {
  invoiceNumber: string;
  invoiceIssueDate: string;
  completenessIndicator: boolean;
  invoiceMain: {
    invoice: {
      invoiceHead: any;
      invoiceLines: any[];
      invoiceSummary: any;
    };
  };
}

export interface NAVSubmissionResponse {
  transactionId: string;
  status: 'RECEIVED' | 'PROCESSING' | 'DONE' | 'ABORTED';
  technicalValidationMessages?: string[];
  businessValidationMessages?: string[];
}

export class NAVService {
  private navClient: AxiosInstance;
  private readonly NAV_TEST_URL = 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3';
  private readonly NAV_PROD_URL = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  constructor() {
    // Initialize axios client with default config
    this.navClient = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
  }

  /**
   * Get NAV API base URL based on environment
   */
  private getNavUrl(isTestMode: boolean = false): string {
    // Use test environment for development or when explicitly requested
    const useTest = process.env.NAV_TEST_MODE === 'true' || isTestMode;
    return useTest ? this.NAV_TEST_URL : this.NAV_PROD_URL;
  }

  /**
   * Generate request ID (30 characters)
   */
  private generateRequestId(): string {
    return crypto.randomBytes(15).toString('hex').toUpperCase();
  }

  /**
   * Generate timestamp in NAV format (ISO 8601)
   */
  private generateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Calculate request signature
   * Signature = SHA512(requestId + timestamp + signKey)
   */
  private calculateRequestSignature(
    requestId: string,
    timestamp: string,
    signatureKey: string
  ): string {
    const data = requestId + timestamp + signatureKey;
    return crypto.createHash('sha512').update(data).digest('hex').toUpperCase();
  }

  /**
   * Calculate password hash for NAV authentication
   * passwordHash = SHA512(technicalUser + SHA512(password))
   */
  private calculatePasswordHash(technicalUser: string, password: string): string {
    const passwordSha = crypto.createHash('sha512').update(password).digest('hex');
    const combined = technicalUser + passwordSha.toUpperCase();
    return crypto.createHash('sha512').update(combined).digest('hex').toUpperCase();
  }

  /**
   * Build NAV authentication header
   */
  private buildAuthHeader(credentials: NAVCredentials): NAVTokenRequest {
    const requestId = this.generateRequestId();
    const timestamp = this.generateTimestamp();
    const requestSignature = this.calculateRequestSignature(
      requestId,
      timestamp,
      credentials.signatureKey
    );

    return {
      requestId,
      timestamp,
      requestSignature,
    };
  }

  /**
   * Test connection to NAV
   */
  async testConnection(organizationId: string): Promise<{
    success: boolean;
    message: string;
    technicalUser?: string;
    timestamp?: string;
  }> {
    try {
      // Get organization with NAV credentials
      const organization = await organizationService.getOrganizationWithNAVCredentials(organizationId);

      if (!organization.navLogin || !organization.navSignatureKey) {
        throw new ValidationError('NAV credentials not configured for this organization');
      }

      const credentials: NAVCredentials = {
        technicalUser: organization.navLogin,
        signatureKey: organization.navSignatureKey,
        replacementKey: organization.navExchangeKey || '',
        taxNumber: organization.taxNumber,
      };

      const auth = this.buildAuthHeader(credentials);
      const baseUrl = this.getNavUrl(true); // Use test mode for connection test

      // Build test connection XML request
      const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${auth.requestId}</requestId>
    <timestamp>${auth.timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.technicalUser}</login>
    <passwordHash>${this.calculatePasswordHash(credentials.technicalUser, credentials.signatureKey)}</passwordHash>
    <taxNumber>${credentials.taxNumber}</taxNumber>
    <requestSignature>${auth.requestSignature}</requestSignature>
  </user>
  <software>
    <softwareId>HU12345678-SZAMLAAPI-1.0</softwareId>
    <softwareName>Számlázó API</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Számlázó API</softwareDevName>
    <softwareDevContact>info@szamlazoapi.hu</softwareDevContact>
  </software>
  <taxNumber>${credentials.taxNumber}</taxNumber>
</QueryTaxpayerRequest>`;

      // Send request to NAV
      const response = await this.navClient.post(
        `${baseUrl}/queryTaxpayer`,
        requestXml
      );

      // Check if response is successful
      if (response.status === 200) {
        // Update organization - mark connection as tested
        await organizationService.markNAVConnectionTested(organizationId, true);

        return {
          success: true,
          message: 'Successfully connected to NAV',
          technicalUser: credentials.technicalUser,
          timestamp: auth.timestamp,
        };
      } else {
        return {
          success: false,
          message: `NAV connection failed with status ${response.status}`,
        };
      }
    } catch (error: any) {
      console.error('NAV connection test failed:', error);

      // Update organization - mark connection as not tested
      await organizationService.markNAVConnectionTested(organizationId, false);

      return {
        success: false,
        message: error.response?.data || error.message || 'NAV connection test failed',
      };
    }
  }

  /**
   * Submit invoice to NAV
   */
  async submitInvoice(
    invoiceId: string,
    organizationId: string
  ): Promise<NAVSubmissionResponse> {
    try {
      // Get invoice with items
      const invoice = await invoiceService.getInvoiceById(invoiceId, organizationId);

      // Check if invoice is finalized
      if (invoice.status !== 'finalized') {
        throw new ValidationError('Only finalized invoices can be submitted to NAV');
      }

      // Check if already submitted
      if (invoice.navStatus === 'sent' || invoice.navStatus === 'confirmed') {
        throw new ValidationError('This invoice has already been submitted to NAV');
      }

      // Get organization with NAV credentials
      const organization = await organizationService.getOrganizationWithNAVCredentials(organizationId);

      if (!organization.navLogin || !organization.navSignatureKey) {
        throw new ValidationError('NAV credentials not configured');
      }

      const credentials: NAVCredentials = {
        technicalUser: organization.navLogin,
        signatureKey: organization.navSignatureKey,
        replacementKey: organization.navExchangeKey || '',
        taxNumber: organization.taxNumber,
      };

      // Generate invoice XML data
      const invoiceData = await this.generateInvoiceXML(invoice, organization);

      // Build authentication
      const auth = this.buildAuthHeader(credentials);
      const baseUrl = this.getNavUrl(false); // Use production mode for submission

      // Build submission XML request
      const requestXml = this.buildManageInvoiceRequest(
        auth,
        credentials,
        invoiceData,
        'CREATE'
      );

      // Submit to NAV
      const response = await this.navClient.post(
        `${baseUrl}/manageInvoice`,
        requestXml
      );

      // Parse response
      const result = this.parseManageInvoiceResponse(response.data);

      // Update invoice with NAV transaction data
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          navStatus: 'sent',
          navTransactionId: result.transactionId,
          navConfirmedAt: result.status === 'DONE' ? new Date() : null,
        },
      });

      return result;
    } catch (error: any) {
      console.error('NAV invoice submission failed:', error);

      // Update invoice with error
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          navStatus: 'error',
          navError: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Generate invoice XML data in NAV 3.0 format
   */
  private async generateInvoiceXML(
    invoice: any,
    organization: OrganizationWithDecryptedNAV
  ): Promise<string> {
    // Get partner data
    const partner = await db.partner.findUnique({
      where: { id: invoice.partnerId },
    });

    if (!partner) {
      throw new NotFoundError('Partner', invoice.partnerId);
    }

    // Format dates
    const issueDate = new Date(invoice.issueDate).toISOString().split('T')[0];
    const fulfillmentDate = new Date(invoice.fulfillmentDate).toISOString().split('T')[0];

    // Build invoice XML according to NAV 3.0 schema
    const invoiceXml = `
    <invoiceData>
      <invoiceNumber>${invoice.invoiceNumber}</invoiceNumber>
      <invoiceIssueDate>${issueDate}</invoiceIssueDate>
      <completenessIndicator>true</completenessIndicator>
      <invoiceMain>
        <invoice>
          <invoiceHead>
            <supplierInfo>
              <supplierTaxNumber>
                <taxpayerId>${organization.taxNumber.substring(0, 8)}</taxpayerId>
                <vatCode>${organization.taxNumber.substring(8, 9)}</vatCode>
                <countyCode>${organization.taxNumber.substring(9, 11)}</countyCode>
              </supplierTaxNumber>
              <supplierName>${organization.name}</supplierName>
              <supplierAddress>
                <simpleAddress>
                  <countryCode>${organization.country}</countryCode>
                  <postalCode>${organization.postalCode}</postalCode>
                  <city>${organization.city}</city>
                  <additionalAddressDetail>${organization.address}</additionalAddressDetail>
                </simpleAddress>
              </supplierAddress>
            </supplierInfo>
            <customerInfo>
              ${partner.isForeign ? this.buildForeignCustomerInfo(partner) : this.buildDomesticCustomerInfo(partner)}
            </customerInfo>
            <invoiceDetail>
              <invoiceCategory>${invoice.invoiceType === 'normal' ? 'NORMAL' : 'OTHER'}</invoiceCategory>
              <invoiceDeliveryDate>${fulfillmentDate}</invoiceDeliveryDate>
              <currencyCode>${invoice.currency}</currencyCode>
              ${invoice.currency !== 'HUF' ? `<exchangeRate>${invoice.exchangeRate}</exchangeRate>` : ''}
            </invoiceDetail>
          </invoiceHead>
          <invoiceLines>
            ${this.buildInvoiceLines(invoice.items)}
          </invoiceLines>
          <invoiceSummary>
            <summaryNormal>
              <summaryByVatRate>
                ${this.buildVatSummary(invoice.vatSummary)}
              </summaryByVatRate>
              <invoiceNetAmount>${Number(invoice.netAmount).toFixed(2)}</invoiceNetAmount>
              <invoiceVatAmount>${Number(invoice.vatAmount).toFixed(2)}</invoiceVatAmount>
              <invoiceGrossAmount>${Number(invoice.grossAmount).toFixed(2)}</invoiceGrossAmount>
            </summaryNormal>
          </invoiceSummary>
        </invoice>
      </invoiceMain>
    </invoiceData>`;

    return invoiceXml;
  }

  /**
   * Build domestic customer info XML
   */
  private buildDomesticCustomerInfo(partner: any): string {
    return `
      <customerTaxNumber>
        <taxpayerId>${partner.taxNumber?.substring(0, 8) || ''}</taxpayerId>
        <vatCode>${partner.taxNumber?.substring(8, 9) || ''}</vatCode>
        <countyCode>${partner.taxNumber?.substring(9, 11) || ''}</countyCode>
      </customerTaxNumber>
      <customerName>${partner.name}</customerName>
      <customerAddress>
        <simpleAddress>
          <countryCode>HU</countryCode>
          <postalCode>${partner.postalCode || ''}</postalCode>
          <city>${partner.city || ''}</city>
          <additionalAddressDetail>${partner.address || ''}</additionalAddressDetail>
        </simpleAddress>
      </customerAddress>`;
  }

  /**
   * Build foreign customer info XML
   */
  private buildForeignCustomerInfo(partner: any): string {
    return `
      <customerName>${partner.name}</customerName>
      <customerAddress>
        <simpleAddress>
          <countryCode>${partner.country || 'Unknown'}</countryCode>
          <postalCode>${partner.postalCode || ''}</postalCode>
          <city>${partner.city || ''}</city>
          <additionalAddressDetail>${partner.address || ''}</additionalAddressDetail>
        </simpleAddress>
      </customerAddress>
      ${partner.taxNumberEu ? `<customerTaxNumberEu>${partner.taxNumberEu}</customerTaxNumberEu>` : ''}`;
  }

  /**
   * Build invoice lines XML
   */
  private buildInvoiceLines(items: any[]): string {
    return items
      .map((item, index) => {
        const lineNumber = index + 1;
        return `
        <line>
          <lineNumber>${lineNumber}</lineNumber>
          <lineDescription>${this.escapeXml(item.name)}</lineDescription>
          <quantity>${Number(item.quantity)}</quantity>
          <unitOfMeasure>${item.unit || 'PIECE'}</unitOfMeasure>
          <unitPrice>${Number(item.netUnitPrice).toFixed(2)}</unitPrice>
          <lineNetAmount>${Number(item.netAmount).toFixed(2)}</lineNetAmount>
          <lineVatRate>
            ${Number(item.vatRate) > 0
              ? `<vatPercentage>${Number(item.vatRate).toFixed(2)}</vatPercentage>`
              : `<vatExemption><case>${item.vatCode || 'AAM'}</case></vatExemption>`
            }
          </lineVatRate>
          <lineVatAmount>${Number(item.vatAmount).toFixed(2)}</lineVatAmount>
          <lineGrossAmountData>
            <lineGrossAmount>${Number(item.grossAmount).toFixed(2)}</lineGrossAmount>
          </lineGrossAmountData>
        </line>`;
      })
      .join('');
  }

  /**
   * Build VAT summary XML
   */
  private buildVatSummary(vatSummary: any): string {
    if (!vatSummary || typeof vatSummary !== 'object') {
      return '';
    }

    return Object.entries(vatSummary)
      .map(([key, value]: [string, any]) => {
        // Parse VAT rate or exemption code
        const isPercentage = key.endsWith('%');
        const rate = isPercentage ? parseFloat(key) : 0;

        return `
        <summaryByVatRateData>
          <vatRate>
            ${rate > 0
              ? `<vatPercentage>${rate.toFixed(2)}</vatPercentage>`
              : `<vatExemption><case>${key}</case></vatExemption>`
            }
          </vatRate>
          <vatRateNetData>
            <vatRateNetAmount>${value.net}</vatRateNetAmount>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>${value.vat}</vatRateVatAmount>
          </vatRateVatData>
          <vatRateGrossData>
            <vatRateGrossAmount>${value.gross}</vatRateGrossAmount>
          </vatRateGrossData>
        </summaryByVatRateData>`;
      })
      .join('');
  }

  /**
   * Build manageInvoice request XML
   */
  private buildManageInvoiceRequest(
    auth: NAVTokenRequest,
    credentials: NAVCredentials,
    invoiceData: string,
    operation: 'CREATE' | 'MODIFY' | 'STORNO'
  ): string {
    // Encode invoice data to base64
    const invoiceDataBase64 = Buffer.from(invoiceData, 'utf8').toString('base64');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ManageInvoiceRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${auth.requestId}</requestId>
    <timestamp>${auth.timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.technicalUser}</login>
    <passwordHash>${this.calculatePasswordHash(credentials.technicalUser, credentials.signatureKey)}</passwordHash>
    <taxNumber>${credentials.taxNumber}</taxNumber>
    <requestSignature>${auth.requestSignature}</requestSignature>
  </user>
  <software>
    <softwareId>HU12345678-SZAMLAAPI-1.0</softwareId>
    <softwareName>Számlázó API</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Számlázó API</softwareDevName>
    <softwareDevContact>info@szamlazoapi.hu</softwareDevContact>
  </software>
  <exchangeToken></exchangeToken>
  <invoiceOperations>
    <compressedContent>false</compressedContent>
    <invoiceOperation>
      <index>1</index>
      <operation>${operation}</operation>
      <invoiceData>${invoiceDataBase64}</invoiceData>
    </invoiceOperation>
  </invoiceOperations>
</ManageInvoiceRequest>`;
  }

  /**
   * Parse manageInvoice response
   */
  private parseManageInvoiceResponse(xmlResponse: string): NAVSubmissionResponse {
    // Simple XML parsing (in production, use a proper XML parser like xml2js)
    // This is a simplified version for demonstration

    // Extract transaction ID
    const transactionIdMatch = xmlResponse.match(/<transactionId>([^<]+)<\/transactionId>/);
    const transactionId = transactionIdMatch ? transactionIdMatch[1]! : '';

    // Extract processing results
    const statusMatch = xmlResponse.match(/<processingResult>([^<]+)<\/processingResult>/);
    const status = (statusMatch ? statusMatch[1] : 'RECEIVED') as NAVSubmissionResponse['status'];

    return {
      transactionId,
      status,
      technicalValidationMessages: [],
      businessValidationMessages: [],
    };
  }

  /**
   * Query invoice status from NAV
   */
  async queryInvoiceStatus(
    invoiceId: string,
    organizationId: string
  ): Promise<{
    status: string;
    validationMessages?: string[];
  }> {
    try {
      const invoice = await invoiceService.getInvoiceById(invoiceId, organizationId);

      if (!invoice.navTransactionId) {
        throw new ValidationError('Invoice has not been submitted to NAV');
      }

      const organization = await organizationService.getOrganizationWithNAVCredentials(organizationId);

      const credentials: NAVCredentials = {
        technicalUser: organization.navLogin!,
        signatureKey: organization.navSignatureKey!,
        replacementKey: organization.navExchangeKey || '',
        taxNumber: organization.taxNumber,
      };

      const auth = this.buildAuthHeader(credentials);
      const baseUrl = this.getNavUrl(false);

      // Build query request
      const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTransactionStatusRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${auth.requestId}</requestId>
    <timestamp>${auth.timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.technicalUser}</login>
    <passwordHash>${this.calculatePasswordHash(credentials.technicalUser, credentials.signatureKey)}</passwordHash>
    <taxNumber>${credentials.taxNumber}</taxNumber>
    <requestSignature>${auth.requestSignature}</requestSignature>
  </user>
  <software>
    <softwareId>HU12345678-SZAMLAAPI-1.0</softwareId>
    <softwareName>Számlázó API</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Számlázó API</softwareDevName>
    <softwareDevContact>info@szamlazoapi.hu</softwareDevContact>
  </software>
  <transactionId>${invoice.navTransactionId}</transactionId>
</QueryTransactionStatusRequest>`;

      const response = await this.navClient.post(
        `${baseUrl}/queryTransactionStatus`,
        requestXml
      );

      // Parse response (simplified)
      const statusMatch = response.data.match(/<processingResult>([^<]+)<\/processingResult>/);
      const status = statusMatch ? statusMatch[1] : 'UNKNOWN';

      // Update invoice if confirmed
      if (status === 'DONE' && invoice.navStatus !== 'confirmed') {
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            navStatus: 'confirmed',
            navConfirmedAt: new Date(),
          },
        });
      }

      return {
        status,
        validationMessages: [],
      };
    } catch (error: any) {
      console.error('NAV status query failed:', error);
      throw error;
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const navService = new NAVService();
