import puppeteer, { Browser } from 'puppeteer';
import { Invoice, InvoiceItem, Organization, Partner } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * PDF Service
 *
 * Generates professional PDF invoices using Puppeteer
 */

type InvoiceWithRelations = Invoice & {
  items: InvoiceItem[];
  organization?: Organization;
  partner?: Partner;
};

export class PDFService {
  private browser: Browser | null = null;

  /**
   * Initialize browser instance (reusable for performance)
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoicePDF(invoice: InvoiceWithRelations): Promise<Buffer> {
    await this.initialize();

    const page = await this.browser!.newPage();

    try {
      const html = this.generateInvoiceHTML(invoice);

      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate HTML template for invoice
   */
  private generateInvoiceHTML(invoice: InvoiceWithRelations): string {
    const org = invoice.organization!;
    const partner = invoice.partner!;
    const isStorno = invoice.invoiceType === 'storno';

    // Format currency
    const formatCurrency = (amount: number | Decimal, currency: string): string => {
      const value = typeof amount === 'number' ? amount : amount.toNumber();
      return new Intl.NumberFormat('hu-HU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) + ' ' + currency;
    };

    // Format date
    const formatDate = (date: Date): string => {
      return new Intl.DateTimeFormat('hu-HU').format(date);
    };

    return `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #333;
    }

    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm;
    }

    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }

    .header h1 {
      font-size: 28pt;
      color: ${isStorno ? '#c00' : '#333'};
      margin-bottom: 5px;
    }

    .header .invoice-number {
      font-size: 14pt;
      font-weight: bold;
      color: #666;
    }

    .company-info {
      margin-bottom: 30px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .info-block {
      flex: 1;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }

    .info-block + .info-block {
      margin-left: 20px;
    }

    .info-block h3 {
      font-size: 12pt;
      margin-bottom: 10px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
    }

    .info-block p {
      margin: 3px 0;
      font-size: 10pt;
    }

    .info-block strong {
      display: inline-block;
      width: 100px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    table thead {
      background: #333;
      color: white;
    }

    table th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10pt;
    }

    table th.right, table td.right {
      text-align: right;
    }

    table tbody tr {
      border-bottom: 1px solid #ddd;
    }

    table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }

    table td {
      padding: 10px 8px;
      font-size: 10pt;
    }

    .totals {
      margin-left: auto;
      width: 300px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 11pt;
    }

    .totals-row.grand-total {
      border-top: 2px solid #333;
      padding-top: 12px;
      margin-top: 12px;
      font-size: 14pt;
      font-weight: bold;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }

    .payment-info {
      margin-top: 30px;
      padding: 15px;
      background: #f0f8ff;
      border-left: 4px solid #0066cc;
    }

    .payment-info h3 {
      font-size: 11pt;
      margin-bottom: 10px;
      color: #0066cc;
    }

    .storno-notice {
      background: #fee;
      border: 2px solid #c00;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
      text-align: center;
      font-weight: bold;
      color: #c00;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div>
        <h1>${isStorno ? 'STORNO SZÁMLA' : 'SZÁMLA'}</h1>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
      </div>
      <div style="text-align: right;">
        <p><strong>Kelt:</strong> ${formatDate(invoice.issueDate)}</p>
        <p><strong>Teljesítés:</strong> ${formatDate(invoice.fulfillmentDate)}</p>
        <p><strong>Fizetési határidő:</strong> ${formatDate(invoice.dueDate)}</p>
      </div>
    </div>

    ${isStorno ? `
    <div class="storno-notice">
      ⚠️ Ez egy storno számla. Az eredeti számla tételeit érvényteleníti.
      ${invoice.originalInvoiceId ? `<br>Eredeti számla: ${invoice.originalInvoiceId}` : ''}
    </div>
    ` : ''}

    <!-- Company and Partner Info -->
    <div class="info-row">
      <div class="info-block">
        <h3>Eladó</h3>
        <p><strong>${org.name}</strong></p>
        <p>${org.address}</p>
        <p>${org.postalCode} ${org.city}</p>
        <p>${org.country}</p>
        <p><strong>Adószám:</strong> ${org.taxNumber}</p>
        ${org.phone ? `<p><strong>Telefon:</strong> ${org.phone}</p>` : ''}
        ${org.email ? `<p><strong>Email:</strong> ${org.email}</p>` : ''}
      </div>

      <div class="info-block">
        <h3>Vevő</h3>
        <p><strong>${partner.name}</strong></p>
        <p>${partner.address}</p>
        <p>${partner.postalCode} ${partner.city}</p>
        <p>${partner.country}</p>
        ${partner.taxNumber ? `<p><strong>Adószám:</strong> ${partner.taxNumber}</p>` : ''}
        ${partner.taxNumberEu ? `<p><strong>EU adószám:</strong> ${partner.taxNumberEu}</p>` : ''}
        ${partner.email ? `<p><strong>Email:</strong> ${partner.email}</p>` : ''}
      </div>
    </div>

    <!-- Invoice Items -->
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 40%;">Megnevezés</th>
          <th class="right" style="width: 10%;">Menny.</th>
          <th style="width: 10%;">Egység</th>
          <th class="right" style="width: 15%;">Nettó ár</th>
          <th class="right" style="width: 10%;">ÁFA</th>
          <th class="right" style="width: 15%;">Bruttó</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            ${item.name}
            ${item.description ? `<br><small style="color: #666;">${item.description}</small>` : ''}
          </td>
          <td class="right">${new Decimal(item.quantity).toFixed(2)}</td>
          <td>${item.unit}</td>
          <td class="right">${formatCurrency(item.netAmount, invoice.currency)}</td>
          <td class="right">${new Decimal(item.vatRate).toFixed(0)}%</td>
          <td class="right">${formatCurrency(item.grossAmount, invoice.currency)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-row">
        <span>Nettó összeg:</span>
        <strong>${formatCurrency(invoice.netAmount, invoice.currency)}</strong>
      </div>
      <div class="totals-row">
        <span>ÁFA összesen:</span>
        <strong>${formatCurrency(invoice.vatAmount, invoice.currency)}</strong>
      </div>
      <div class="totals-row grand-total">
        <span>Fizetendő:</span>
        <strong>${formatCurrency(invoice.grossAmount, invoice.currency)}</strong>
      </div>
    </div>

    ${!isStorno ? `
    <div class="payment-info">
      <h3>Fizetési információk</h3>
      <p><strong>Fizetési mód:</strong> ${invoice.paymentMethod === 'transfer' ? 'Átutalás' : invoice.paymentMethod}</p>
      <p><strong>Fizetési határidő:</strong> ${formatDate(invoice.dueDate)}</p>
      ${invoice.comment ? `<p><strong>Megjegyzés:</strong> ${invoice.comment}</p>` : ''}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>A számla elektronikusan került kiállításra és érvényes aláírás nélkül.</p>
      ${invoice.navTransactionId ? `<p>NAV tranzakció: ${invoice.navTransactionId}</p>` : ''}
      <p>Köszönjük a megrendelést!</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

// Export singleton instance
export const pdfService = new PDFService();
