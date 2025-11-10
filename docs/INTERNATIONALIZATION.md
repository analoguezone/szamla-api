# Internationalization (i18n) Design

Bilingual support: Hungarian (default) and English.

**Related**: [ARCHITECTURE.md](../ARCHITECTURE.md) | [API_DESIGN.md](../API_DESIGN.md)

## Supported Languages

- **Hungarian (hu)**: Default language
- **English (en)**: Secondary language

## Strategy

### API Responses
- Error messages in requested language
- API documentation in English
- Validation messages in both languages

### Invoice Documents
- PDF invoices in organization's default language
- Support for language override per invoice

### Email Notifications
- User's preferred language
- Fallback to organization default

## Implementation

### 1. i18n Library

**Recommendation**: `i18next` with `i18next-http-middleware`

```bash
npm install i18next i18next-http-middleware i18next-fs-backend
```

### 2. Translation Files

```
locales/
├── hu/
│   ├── common.json
│   ├── errors.json
│   ├── invoices.json
│   └── emails.json
└── en/
    ├── common.json
    ├── errors.json
    ├── invoices.json
    └── emails.json
```

### 3. Configuration

```typescript
// src/config/i18n.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'hu',
    supportedLngs: ['hu', 'en'],
    preload: ['hu', 'en'],
    ns: ['common', 'errors', 'invoices', 'emails'],
    defaultNS: 'common',
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json'
    },
    detection: {
      order: ['header', 'querystring'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lang',
      caches: false
    }
  });

export default i18next;
```

### 4. Express Middleware

```typescript
// src/app.ts
import i18next from './config/i18n';
import middleware from 'i18next-http-middleware';

app.use(middleware.handle(i18next));
```

### 5. Usage in Code

```typescript
// In controllers/services
import { t } from 'i18next';

// Error messages
throw new Error(req.t('errors:insufficient_balance', {
  required: 63.5,
  available: 50
}));

// Success messages
return {
  message: req.t('invoices:created_successfully'),
  data: invoice
};
```

### 6. Translation Files

**locales/hu/errors.json**:
```json
{
  "insufficient_balance": "Nincs elegendő egyenleg. Szükséges: {{required}} HUF, Elérhető: {{available}} HUF",
  "invoice_not_found": "A számla nem található",
  "invalid_tax_number": "Érvénytelen adószám formátum",
  "nav_submission_failed": "NAV beküldés sikertelen: {{error}}",
  "unauthorized": "Érvénytelen API kulcs",
  "rate_limit_exceeded": "Túl sok kérés. Próbálja újra {{seconds}} másodperc múlva"
}
```

**locales/en/errors.json**:
```json
{
  "insufficient_balance": "Insufficient balance. Required: {{required}} HUF, Available: {{available}} HUF",
  "invoice_not_found": "Invoice not found",
  "invalid_tax_number": "Invalid tax number format",
  "nav_submission_failed": "NAV submission failed: {{error}}",
  "unauthorized": "Invalid API key",
  "rate_limit_exceeded": "Too many requests. Try again in {{seconds}} seconds"
}
```

**locales/hu/invoices.json**:
```json
{
  "created_successfully": "Számla sikeresen létrehozva",
  "finalized": "Számla véglegesítve",
  "submitted_to_nav": "Beküldve a NAV-hoz",
  "storno_created": "Stornó számla létrehozva",
  "payment_recorded": "Fizetés rögzítve",

  "fields": {
    "invoice_number": "Számlaszám",
    "issue_date": "Kiállítás dátuma",
    "due_date": "Fizetési határidő",
    "partner": "Partner",
    "net_amount": "Nettó összeg",
    "vat_amount": "ÁFA",
    "gross_amount": "Bruttó összeg"
  },

  "pdf": {
    "title": "SZÁMLA",
    "storno_title": "STORŃÓ SZÁMLA",
    "supplier": "Szállító",
    "customer": "Vevő",
    "tax_number": "Adószám",
    "payment_method": "Fizetési mód",
    "bank_account": "Bankszámlaszám",
    "items": "Tételek",
    "item_name": "Megnevezés",
    "quantity": "Mennyiség",
    "unit": "Egység",
    "unit_price": "Egységár",
    "vat_rate": "ÁFA",
    "total": "Összesen",
    "thank_you": "Köszönjük megrendelését!"
  }
}
```

**locales/en/invoices.json**:
```json
{
  "created_successfully": "Invoice created successfully",
  "finalized": "Invoice finalized",
  "submitted_to_nav": "Submitted to NAV",
  "storno_created": "Storno invoice created",
  "payment_recorded": "Payment recorded",

  "fields": {
    "invoice_number": "Invoice Number",
    "issue_date": "Issue Date",
    "due_date": "Due Date",
    "partner": "Partner",
    "net_amount": "Net Amount",
    "vat_amount": "VAT",
    "gross_amount": "Gross Amount"
  },

  "pdf": {
    "title": "INVOICE",
    "storno_title": "CREDIT NOTE",
    "supplier": "Supplier",
    "customer": "Customer",
    "tax_number": "Tax Number",
    "payment_method": "Payment Method",
    "bank_account": "Bank Account",
    "items": "Items",
    "item_name": "Description",
    "quantity": "Quantity",
    "unit": "Unit",
    "unit_price": "Unit Price",
    "vat_rate": "VAT",
    "total": "Total",
    "thank_you": "Thank you for your business!"
  }
}
```

### 7. PDF Invoice Template (Bilingual)

```typescript
// src/services/pdf.service.ts
import { TFunction } from 'i18next';

export function generateInvoicePDF(invoice: Invoice, lang: 'hu' | 'en'): Buffer {
  const t = i18next.getFixedT(lang, 'invoices');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${t('pdf.title')} - ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${invoice.organization.logo_url ? `<img src="${invoice.organization.logo_url}" height="80">` : ''}
        <h1 class="title">${invoice.invoice_type === 'storno' ? t('pdf.storno_title') : t('pdf.title')}</h1>
        <p>${invoice.invoice_number}</p>
      </div>

      <div class="section">
        <h3>${t('pdf.supplier')}</h3>
        <p><strong>${invoice.organization.name}</strong></p>
        <p>${t('pdf.tax_number')}: ${invoice.organization.tax_number}</p>
        <p>${invoice.organization.address}</p>
      </div>

      <div class="section">
        <h3>${t('pdf.customer')}</h3>
        <p><strong>${invoice.partner.name}</strong></p>
        <p>${t('pdf.tax_number')}: ${invoice.partner.tax_number || '-'}</p>
        <p>${invoice.partner.address}</p>
      </div>

      <div class="section">
        <p>${t('fields.issue_date')}: ${invoice.issue_date}</p>
        <p>${t('fields.due_date')}: ${invoice.due_date}</p>
        <p>${t('pdf.payment_method')}: ${invoice.payment_method}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>${t('pdf.item_name')}</th>
            <th>${t('pdf.quantity')}</th>
            <th>${t('pdf.unit')}</th>
            <th>${t('pdf.unit_price')}</th>
            <th>${t('pdf.vat_rate')}</th>
            <th>${t('pdf.total')}</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>${item.unit}</td>
              <td>${formatCurrency(item.net_unit_price)}</td>
              <td>${item.vat_rate}%</td>
              <td>${formatCurrency(item.gross_amount)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5">${t('fields.net_amount')}:</td>
            <td>${formatCurrency(invoice.net_amount)}</td>
          </tr>
          <tr>
            <td colspan="5">${t('fields.vat_amount')}:</td>
            <td>${formatCurrency(invoice.vat_amount)}</td>
          </tr>
          <tr class="total">
            <td colspan="5">${t('fields.gross_amount')}:</td>
            <td>${formatCurrency(invoice.gross_amount)} ${invoice.currency}</td>
          </tr>
        </tfoot>
      </table>

      <p style="text-align: center; margin-top: 40px;">
        ${t('pdf.thank_you')}
      </p>
    </body>
    </html>
  `;

  return convertHtmlToPdf(html);
}
```

### 8. Language Detection

```typescript
// Middleware to detect language
app.use((req, res, next) => {
  // Priority:
  // 1. Query param: ?lang=en
  // 2. Accept-Language header
  // 3. Organization default
  // 4. Fallback to 'hu'

  const queryLang = req.query.lang as string;
  const headerLang = req.headers['accept-language']?.split(',')[0].split('-')[0];
  const orgLang = req.organization?.default_language;

  req.language = queryLang || headerLang || orgLang || 'hu';

  next();
});
```

### 9. API Response Example

```typescript
// GET /api/v1/invoices/123
// Accept-Language: en

{
  "success": true,
  "data": {
    "id": "inv_123",
    "invoice_number": "INV-2025-00123",
    "status": "finalized",
    // ... invoice data
  },
  "meta": {
    "message": "Invoice retrieved successfully",
    "language": "en"
  }
}

// Accept-Language: hu
{
  "success": true,
  "data": {
    "id": "inv_123",
    "invoice_number": "INV-2025-00123",
    "status": "finalized",
    // ... invoice data
  },
  "meta": {
    "message": "Számla sikeresen lekérve",
    "language": "hu"
  }
}
```

### 10. Organization Language Preference

```sql
-- Add to organizations table
ALTER TABLE organizations ADD COLUMN
  default_language VARCHAR(2) DEFAULT 'hu',
  supported_languages VARCHAR(2)[] DEFAULT ARRAY['hu'];
```

```typescript
// Override language per invoice
await invoiceService.create(orgId, {
  partner_id: 'partner_123',
  language: 'en', // Override organization default
  // ...
});
```

## Email Templates

### Email Structure

```
emails/
├── hu/
│   ├── invoice_created.html
│   ├── low_balance.html
│   └── payment_failed.html
└── en/
    ├── invoice_created.html
    ├── low_balance.html
    └── payment_failed.html
```

### Example Email Template

**emails/hu/low_balance.html**:
```html
<h2>Alacsony egyenleg figyelmeztetés</h2>
<p>Kedves {{organization_name}}!</p>
<p>A jelenlegi egyenlege: <strong>{{balance}} HUF</strong></p>
<p>Kérjük, töltse fel egyenlegét a szolgáltatás folyamatos használatához.</p>
<a href="{{topup_url}}">Egyenleg feltöltése</a>
```

**emails/en/low_balance.html**:
```html
<h2>Low Balance Alert</h2>
<p>Dear {{organization_name}},</p>
<p>Your current balance is: <strong>{{balance}} HUF</strong></p>
<p>Please top up your balance to continue using the service.</p>
<a href="{{topup_url}}">Top Up Balance</a>
```

## Testing i18n

```typescript
describe('Internationalization', () => {
  it('should return error in Hungarian by default', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/nonexistent')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(res.body.error.message).toBe('A számla nem található');
  });

  it('should return error in English when requested', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/nonexistent?lang=en')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(res.body.error.message).toBe('Invoice not found');
  });

  it('should generate PDF in requested language', async () => {
    const pdf = await pdfService.generate(invoice, 'en');
    const text = await extractTextFromPdf(pdf);

    expect(text).toContain('INVOICE');
    expect(text).toContain('Customer');
  });
});
```

## Best Practices

1. **Always provide both languages** for all user-facing text
2. **Use keys, not hardcoded text** in code
3. **Keep translations synchronized** (same keys in both files)
4. **Context matters**: Provide context in translation keys (`invoices:created` not just `created`)
5. **Pluralization**: Use i18next pluralization for counts
6. **Date formatting**: Use locale-specific date formats
7. **Currency**: Always show HUF, but format according to locale

## Performance

- **Preload translations** at server startup
- **Cache compiled templates**
- **Don't reload on every request**

## Future: More Languages

To add more languages later:

1. Create new `locales/de/` folder (for German, etc.)
2. Add to `supportedLngs: ['hu', 'en', 'de']`
3. Translate all JSON files
4. Update organization settings to support selection

---

**Implementation**: Phase 8 or can be done incrementally throughout development
