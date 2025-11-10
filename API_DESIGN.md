# Számlázó NAV API - API Design Specification

## Base Information

- **Base URL**: `https://api.szamla.example.com/api/v1`
- **Protocol**: HTTPS only
- **Authentication**: API Key (Bearer token)
- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8
- **Rate Limiting**: Configurable per organization (default: 60 req/min)

## Authentication

All API requests must include an API key in the Authorization header:

```
Authorization: Bearer sk_live_abc123def456...
```

### API Key Format

- **Development**: `sk_test_...` (test environment)
- **Production**: `sk_live_...` (production environment)

## Common Response Structure

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid invoice data provided",
    "details": [
      {
        "field": "partner.tax_number",
        "message": "Invalid Hungarian tax number format"
      }
    ]
  },
  "meta": {
    "request_id": "req_abc124",
    "timestamp": "2025-01-15T10:31:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_REQUEST` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `NAV_ERROR` | 502 | NAV service error |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Pagination

List endpoints support pagination with the following query parameters:

- `page` (default: 1)
- `limit` (default: 25, max: 100)

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "current_page": 1,
    "per_page": 25,
    "total_items": 150,
    "total_pages": 6,
    "has_next": true,
    "has_prev": false
  },
  "meta": { ... }
}
```

## Date and Time Formats

- **Dates**: ISO 8601 date format (`YYYY-MM-DD`)
- **Timestamps**: ISO 8601 with timezone (`YYYY-MM-DDTHH:MM:SSZ`)
- **Timezone**: All timestamps in UTC

---

# API Endpoints

## Organizations

### Get Organization Info

Get current organization information.

**Endpoint**: `GET /organization`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "org_abc123",
    "name": "Example Kft.",
    "tax_number": "12345678-1-23",
    "email": "info@example.hu",
    "phone": "+36301234567",
    "address": {
      "country": "HU",
      "postal_code": "1011",
      "city": "Budapest",
      "address": "Fő utca 1."
    },
    "invoice_settings": {
      "prefix": "INV",
      "next_number": 125,
      "default_currency": "HUF",
      "default_language": "hu"
    },
    "nav_status": {
      "connected": true,
      "last_test": "2025-01-15T10:00:00Z"
    },
    "subscription": {
      "tier": "pro",
      "status": "active"
    }
  }
}
```

### Update Organization

**Endpoint**: `PATCH /organization`

**Request Body**:
```json
{
  "name": "New Company Name Kft.",
  "email": "newemail@example.hu",
  "invoice_settings": {
    "prefix": "INV",
    "default_currency": "HUF"
  }
}
```

### Update NAV Credentials

**Endpoint**: `PUT /organization/nav-credentials`

**Request Body**:
```json
{
  "login": "nav_technical_user",
  "password": "nav_password",
  "tax_number": "12345678-1-23",
  "signature_key": "signature_key_here",
  "exchange_key": "exchange_key_here"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "connection_tested": true,
    "tested_at": "2025-01-15T10:30:00Z",
    "message": "NAV credentials updated and connection verified successfully"
  }
}
```

---

## Partners

### List Partners

**Endpoint**: `GET /partners`

**Query Parameters**:
- `page` (integer): Page number
- `limit` (integer): Items per page
- `search` (string): Search by name or tax number
- `is_foreign` (boolean): Filter foreign partners

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "partner_abc123",
      "name": "Partner Company Kft.",
      "tax_number": "98765432-1-23",
      "tax_number_eu": null,
      "is_individual": false,
      "is_foreign": false,
      "email": "contact@partner.hu",
      "phone": "+36301234567",
      "address": {
        "country": "HU",
        "postal_code": "1011",
        "city": "Budapest",
        "address": "Partner utca 5."
      },
      "created_at": "2025-01-10T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Partner

**Endpoint**: `GET /partners/{id}`

### Create Partner

**Endpoint**: `POST /partners`

**Request Body**:
```json
{
  "name": "New Partner Kft.",
  "tax_number": "98765432-1-23",
  "is_individual": false,
  "is_foreign": false,
  "email": "info@newpartner.hu",
  "phone": "+36301234567",
  "address": {
    "country": "HU",
    "postal_code": "1011",
    "city": "Budapest",
    "address": "Új utca 10."
  },
  "bank_account_number": "HU12345678901234567890123456",
  "notes": "Important client"
}
```

**Response**: Returns created partner object with `id`

### Update Partner

**Endpoint**: `PATCH /partners/{id}`

**Request Body**: Same as create, all fields optional

### Delete Partner

**Endpoint**: `DELETE /partners/{id}`

**Note**: Only allowed if partner has no associated invoices.

---

## Invoices

### List Invoices

**Endpoint**: `GET /invoices`

**Query Parameters**:
- `page`, `limit`: Pagination
- `status`: Filter by status (`draft`, `finalized`, `sent`, `paid`, `cancelled`)
- `payment_status`: Filter by payment (`unpaid`, `paid`, `overdue`)
- `nav_status`: Filter by NAV status (`pending`, `submitted`, `confirmed`, `failed`)
- `partner_id`: Filter by partner
- `date_from`, `date_to`: Filter by issue date (ISO 8601)
- `invoice_type`: Filter by type (`normal`, `proforma`, `storno`)
- `invoice_number`: Search by invoice number

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_abc123",
      "invoice_number": "INV-2025-00123",
      "invoice_type": "normal",
      "status": "finalized",
      "payment_status": "unpaid",
      "nav_status": "confirmed",
      "partner": {
        "id": "partner_abc123",
        "name": "Partner Company Kft.",
        "tax_number": "98765432-1-23"
      },
      "issue_date": "2025-01-15",
      "fulfillment_date": "2025-01-15",
      "due_date": "2025-01-30",
      "currency": "HUF",
      "amounts": {
        "net": 100000,
        "vat": 27000,
        "gross": 127000
      },
      "items_count": 3,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Invoice

**Endpoint**: `GET /invoices/{id}`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "inv_abc123",
    "invoice_number": "INV-2025-00123",
    "invoice_type": "normal",
    "status": "finalized",
    "payment_status": "unpaid",
    "partner": {
      "id": "partner_abc123",
      "name": "Partner Company Kft.",
      "tax_number": "98765432-1-23",
      "email": "contact@partner.hu",
      "address": {
        "country": "HU",
        "postal_code": "1011",
        "city": "Budapest",
        "address": "Partner utca 5."
      }
    },
    "dates": {
      "issue_date": "2025-01-15",
      "fulfillment_date": "2025-01-15",
      "due_date": "2025-01-30"
    },
    "currency": "HUF",
    "payment_method": "transfer",
    "items": [
      {
        "id": "item_1",
        "line_number": 1,
        "name": "Web Development Services",
        "description": "Monthly website maintenance",
        "quantity": 10,
        "unit": "hour",
        "net_unit_price": 10000,
        "vat_rate": 27,
        "vat_code": "AAM",
        "amounts": {
          "net": 100000,
          "vat": 27000,
          "gross": 127000
        }
      }
    ],
    "amounts": {
      "net": 100000,
      "vat": 27000,
      "gross": 127000
    },
    "vat_summary": [
      {
        "rate": 27,
        "net": 100000,
        "vat": 27000,
        "gross": 127000
      }
    ],
    "comment": "Thank you for your business!",
    "nav": {
      "status": "confirmed",
      "transaction_id": "nav_trans_123",
      "confirmed_at": "2025-01-15T10:05:00Z"
    },
    "created_at": "2025-01-15T10:00:00Z",
    "finalized_at": "2025-01-15T10:00:30Z"
  }
}
```

### Create Invoice

**Endpoint**: `POST /invoices`

**Request Body**:
```json
{
  "partner_id": "partner_abc123",
  "issue_date": "2025-01-15",
  "fulfillment_date": "2025-01-15",
  "due_date": "2025-01-30",
  "payment_method": "transfer",
  "currency": "HUF",
  "language": "hu",
  "items": [
    {
      "name": "Web Development Services",
      "description": "Monthly website maintenance",
      "sku": "WEB-MAINT-001",
      "quantity": 10,
      "unit": "hour",
      "net_unit_price": 10000,
      "vat_rate": 27,
      "vat_code": "AAM"
    },
    {
      "name": "Hosting Service",
      "quantity": 1,
      "unit": "month",
      "net_unit_price": 5000,
      "vat_rate": 27,
      "vat_code": "AAM"
    }
  ],
  "comment": "Thank you for your business!",
  "internal_note": "Client pays on time",
  "auto_submit_to_nav": true,
  "auto_finalize": false
}
```

**Response**: Returns created invoice object with status `draft` or `finalized`

**Notes**:
- `auto_finalize`: If `false`, invoice is created as draft. If `true`, immediately finalized.
- `auto_submit_to_nav`: If `true`, automatically submits to NAV after finalization.
- Amounts are calculated automatically from items.

### Update Invoice (Draft Only)

**Endpoint**: `PATCH /invoices/{id}`

**Note**: Only draft invoices can be updated. Finalized invoices are immutable.

**Request Body**: Same as create, all fields optional

### Finalize Invoice

**Endpoint**: `POST /invoices/{id}/finalize`

**Request Body**:
```json
{
  "submit_to_nav": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "inv_abc123",
    "invoice_number": "INV-2025-00123",
    "status": "finalized",
    "nav_status": "pending",
    "nav_transaction_id": "nav_trans_123",
    "finalized_at": "2025-01-15T10:00:30Z"
  }
}
```

**Notes**:
- Assigns invoice number
- Makes invoice immutable
- Optionally submits to NAV

### Delete Invoice (Draft Only)

**Endpoint**: `DELETE /invoices/{id}`

**Note**: Only draft invoices can be deleted.

### Create Storno Invoice

**Endpoint**: `POST /invoices/{id}/storno`

**Request Body**:
```json
{
  "reason": "Customer returned goods",
  "auto_submit_to_nav": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "storno_invoice": {
      "id": "inv_def456",
      "invoice_number": "INV-2025-00124",
      "invoice_type": "storno",
      "original_invoice_id": "inv_abc123",
      "status": "finalized",
      "nav_status": "pending",
      "amounts": {
        "net": -100000,
        "vat": -27000,
        "gross": -127000
      }
    },
    "original_invoice": {
      "id": "inv_abc123",
      "is_storned": true,
      "storned_by_invoice_id": "inv_def456"
    }
  }
}
```

**Notes**:
- Creates a new invoice with negative amounts
- Links to original invoice
- Marks original as storned
- Submits STORNO operation to NAV

### Update Payment Status

**Endpoint**: `POST /invoices/{id}/payment`

**Request Body**:
```json
{
  "payment_status": "paid",
  "payment_date": "2025-01-20",
  "payment_method": "transfer",
  "note": "Received bank transfer"
}
```

**Response**: Returns updated invoice

---

## Invoice Documents

### Download Invoice PDF

**Endpoint**: `GET /invoices/{id}/pdf`

**Response**: Binary PDF file

**Headers**:
- `Content-Type: application/pdf`
- `Content-Disposition: inline; filename="INV-2025-00123.pdf"`

### Download NAV XML

**Endpoint**: `GET /invoices/{id}/nav-xml`

**Response**: XML file (base64 encoded in JSON response)

**Note**: Only available after NAV submission

---

## NAV Operations

### Get NAV Transaction Status

**Endpoint**: `GET /nav/transactions/{transaction_id}`

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "nav_trans_123",
    "status": "DONE",
    "invoice_id": "inv_abc123",
    "operation_type": "manage_invoice",
    "submitted_at": "2025-01-15T10:00:30Z",
    "completed_at": "2025-01-15T10:01:00Z",
    "processing_results": {
      "technical_validation": "OK",
      "business_validation": "OK"
    }
  }
}
```

**Status Values**:
- `PENDING`: Submitted, waiting for processing
- `PROCESSING`: NAV is processing
- `DONE`: Successfully processed
- `ABORTED`: Failed validation
- `FAILED`: Technical error

### Query Invoice from NAV

**Endpoint**: `GET /nav/invoices/{invoice_number}`

**Query Parameters**:
- `invoice_number`: Invoice number to query

**Response**: NAV invoice data

**Note**: Queries NAV directly for invoice information

### Test NAV Connection

**Endpoint**: `POST /organization/nav/test-connection`

**Response**:
```json
{
  "success": true,
  "data": {
    "connection_successful": true,
    "user_authenticated": true,
    "tested_at": "2025-01-15T10:30:00Z",
    "nav_api_version": "v3",
    "response_time_ms": 234
  }
}
```

---

## Usage & Billing

### Get Current Period Usage

**Endpoint**: `GET /usage/current`

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "metrics": {
      "api_calls": {
        "total": 1250,
        "success": 1200,
        "failed": 50
      },
      "invoices": {
        "created": 150,
        "storned": 5,
        "submitted_to_nav": 145
      },
      "pdfs_generated": 180,
      "data_transfer_mb": 45.3
    },
    "limits": {
      "api_calls_per_day": 10000,
      "invoices_per_month": 1000
    },
    "usage_percentage": 15.0
  }
}
```

### Get Usage History

**Endpoint**: `GET /usage/history`

**Query Parameters**:
- `from_date`: Start date (ISO 8601)
- `to_date`: End date (ISO 8601)
- `aggregation`: `daily` or `monthly`

**Response**: Array of usage aggregates

---

## API Keys Management

### List API Keys

**Endpoint**: `GET /api-keys`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "key_abc123",
      "key_prefix": "sk_live_abc123",
      "name": "Production API Key",
      "scopes": ["invoices:read", "invoices:write"],
      "is_active": true,
      "created_at": "2025-01-01T10:00:00Z",
      "last_used_at": "2025-01-15T09:45:00Z",
      "expires_at": null
    }
  ]
}
```

### Create API Key

**Endpoint**: `POST /api-keys`

**Request Body**:
```json
{
  "name": "Production API Key",
  "scopes": ["invoices:read", "invoices:write", "partners:read"],
  "expires_in_days": 365
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "key": "sk_live_abc123def456ghi789...",
    "key_prefix": "sk_live_abc123",
    "name": "Production API Key",
    "created_at": "2025-01-15T10:00:00Z",
    "expires_at": "2026-01-15T10:00:00Z"
  },
  "warning": "This is the only time the full API key will be shown. Store it securely."
}
```

**Note**: The full key is only shown once at creation time.

### Revoke API Key

**Endpoint**: `DELETE /api-keys/{id}`

---

## Webhooks (Future Feature)

### Register Webhook

**Endpoint**: `POST /webhooks`

**Request Body**:
```json
{
  "url": "https://example.com/webhook",
  "events": ["invoice.finalized", "invoice.paid", "nav.confirmed"],
  "secret": "webhook_secret_123"
}
```

### Webhook Event Payload

```json
{
  "id": "evt_abc123",
  "type": "invoice.finalized",
  "created_at": "2025-01-15T10:00:30Z",
  "data": {
    "invoice_id": "inv_abc123",
    "invoice_number": "INV-2025-00123"
  }
}
```

**Event Types**:
- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.storned`
- `nav.submitted`
- `nav.confirmed`
- `nav.failed`

---

## Rate Limiting

Rate limits are applied per API key:

**Response Headers**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705318800
```

**429 Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "retry_after": 30
  }
}
```

---

## Versioning

API versioning is handled via the URL path:

- Current: `/api/v1/...`
- Future: `/api/v2/...`

Breaking changes will result in a new version. Non-breaking changes will be added to existing versions.

---

## Data Validation Rules

### Hungarian Tax Number Format

- Format: `12345678-1-23` (8 digits, 1 digit, 2 digits)
- Validation regex: `^\d{8}-\d-\d{2}$`

### Invoice Number Format

- Auto-generated: `{PREFIX}-{YEAR}-{NUMBER}`
- Example: `INV-2025-00123`
- Unique per organization

### VAT Rates (Hungary)

Common rates:
- `27%`: Standard rate (AAM)
- `18%`: Reduced rate (TAM)
- `5%`: Super-reduced rate (FAM)
- `0%`: Zero-rated (AAM with 0%)

### Currency Codes

ISO 4217 codes:
- `HUF`: Hungarian Forint (primary)
- `EUR`: Euro
- `USD`: US Dollar

---

## Best Practices

1. **Idempotency**: Use idempotency keys for invoice creation to prevent duplicates
2. **Async NAV Submission**: NAV submission is async. Poll transaction status for confirmation.
3. **Error Handling**: Always check `success` field and handle errors gracefully
4. **Rate Limiting**: Implement exponential backoff when rate limited
5. **Security**: Never commit API keys to version control
6. **Testing**: Use test API keys (`sk_test_...`) in development
7. **Webhooks**: Use webhooks for real-time notifications instead of polling

---

## Example Workflows

### Creating and Submitting an Invoice

```
1. POST /partners (create partner if needed)
2. POST /invoices (create draft invoice)
3. Review invoice data
4. POST /invoices/{id}/finalize (finalize and submit to NAV)
5. GET /nav/transactions/{transaction_id} (check NAV status)
6. GET /invoices/{id}/pdf (download PDF)
```

### Handling Invoice Cancellation

```
1. GET /invoices/{id} (verify invoice exists and is finalized)
2. POST /invoices/{id}/storno (create storno invoice)
3. GET /nav/transactions/{transaction_id} (verify NAV submission)
```

### Monthly Usage Reporting

```
1. GET /usage/history?from_date=2025-01-01&to_date=2025-01-31&aggregation=monthly
2. Analyze usage metrics
3. Implement rate limiting or upgrade tier if needed
```

---

## OpenAPI/Swagger Specification

A complete OpenAPI 3.0 specification will be generated and available at:

- **Specification**: `/api/v1/openapi.json`
- **Swagger UI**: `/api/v1/docs`
- **ReDoc**: `/api/v1/redoc`

This allows for automatic client SDK generation and interactive API testing.
