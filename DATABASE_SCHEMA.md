# Database Schema Design

## Overview

This document defines the PostgreSQL database schema for the Számlázó NAV API system. The schema is designed for multi-tenancy with row-level organization isolation and comprehensive audit trails.

## Entity Relationship Diagram

```
┌──────────────────┐
│  organizations   │
└────────┬─────────┘
         │ 1
         │
         │ *
┌────────┴─────────┬────────────────────┬─────────────────┬──────────────────┐
│                  │                    │                 │                  │
│ *                │ *                  │ *               │ *                │
┌┴─────────────┐  ┌┴──────────────┐   ┌┴──────────┐    ┌┴──────────────┐  │
│  invoices    │  │   partners    │   │ api_keys  │    │ usage_logs    │  │
└──┬───────────┘  └───────────────┘   └───────────┘    └───────────────┘  │
   │ 1                                                                      │
   │                                                                        │
   │ *                                                                      │ *
┌──┴─────────────┐                                                    ┌────┴─────────────┐
│ invoice_items  │                                                    │ nav_submissions  │
└────────────────┘                                                    └──────────────────┘
```

## Schema Definitions

### 1. organizations

Stores information about each organization using the service.

```sql
CREATE TABLE organizations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization Details
  name VARCHAR(255) NOT NULL,
  tax_number VARCHAR(20) NOT NULL UNIQUE, -- Hungarian tax number format: 12345678-1-23
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  -- Address
  country VARCHAR(2) NOT NULL DEFAULT 'HU',
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,

  -- Invoice Settings
  invoice_prefix VARCHAR(10) DEFAULT 'INV',
  next_invoice_number INTEGER DEFAULT 1,
  default_currency VARCHAR(3) DEFAULT 'HUF',
  default_language VARCHAR(2) DEFAULT 'hu',

  -- NAV Credentials (Encrypted)
  nav_login VARCHAR(255),
  nav_password_encrypted TEXT,
  nav_signature_key_encrypted TEXT,
  nav_exchange_key_encrypted TEXT,
  nav_connection_tested BOOLEAN DEFAULT FALSE,
  nav_last_test_at TIMESTAMP,

  -- Software Details (for NAV)
  software_id VARCHAR(100) NOT NULL DEFAULT 'SZAMLA_API_V1',
  software_name VARCHAR(100) NOT NULL DEFAULT 'Számlázó API',
  software_developer VARCHAR(100) NOT NULL,
  software_developer_email VARCHAR(255) NOT NULL,
  software_developer_tax_number VARCHAR(20),

  -- Subscription & Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  subscription_tier VARCHAR(20) DEFAULT 'basic', -- basic, pro, enterprise
  trial_ends_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

-- Indexes
CREATE INDEX idx_organizations_tax_number ON organizations(tax_number);
CREATE INDEX idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at);
```

### 2. api_keys

API keys for authentication, scoped to organizations.

```sql
CREATE TABLE api_keys (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Key Details
  key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification (e.g., "sk_live_")
  key_hash VARCHAR(255) NOT NULL UNIQUE, -- bcrypt hash of full key
  name VARCHAR(100), -- User-friendly name (e.g., "Production API Key")

  -- Permissions & Limits
  scopes TEXT[] DEFAULT ARRAY['invoices:read', 'invoices:write'], -- JSON array of permissions
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,

  -- Expiration
  expires_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255), -- User/admin who created it
  revoked_at TIMESTAMP,
  revoked_by VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, organization_id) WHERE revoked_at IS NULL;
```

### 3. partners

Business partners (customers/suppliers) for each organization.

```sql
CREATE TABLE partners (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Partner Details
  name VARCHAR(255) NOT NULL,
  tax_number VARCHAR(20), -- Can be NULL for foreign/individual partners
  tax_number_eu VARCHAR(20), -- EU VAT number
  is_individual BOOLEAN DEFAULT FALSE,
  is_foreign BOOLEAN DEFAULT FALSE,

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Address
  country VARCHAR(2) NOT NULL DEFAULT 'HU',
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,

  -- Banking (optional)
  bank_account_number VARCHAR(50), -- IBAN or local format
  bank_name VARCHAR(100),
  swift_bic VARCHAR(11),

  -- Metadata
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

-- Indexes
CREATE INDEX idx_partners_organization_id ON partners(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_partners_tax_number ON partners(organization_id, tax_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_partners_name ON partners(organization_id, name) WHERE deleted_at IS NULL;
```

### 4. invoices

Core invoice entities.

```sql
CREATE TABLE invoices (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,

  -- Invoice Identification
  invoice_number VARCHAR(50) NOT NULL, -- e.g., "INV-2025-00123"
  invoice_type VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal, proforma, storno, modification

  -- Storno Relationships
  original_invoice_id UUID REFERENCES invoices(id), -- For storno invoices, points to original
  storned_by_invoice_id UUID REFERENCES invoices(id), -- For original, points to storno invoice
  is_storned BOOLEAN DEFAULT FALSE,

  -- Dates
  issue_date DATE NOT NULL,
  fulfillment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE, -- When actually paid

  -- Financial Details
  currency VARCHAR(3) NOT NULL DEFAULT 'HUF',
  exchange_rate DECIMAL(12, 6) DEFAULT 1.0, -- For foreign currency invoices

  -- Amounts (all in invoice currency)
  net_amount DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) NOT NULL,
  gross_amount DECIMAL(15, 2) NOT NULL,

  -- Payment
  payment_method VARCHAR(50) NOT NULL DEFAULT 'transfer', -- transfer, cash, card, etc.
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid, partially_paid, paid, overdue

  -- VAT Summary (JSONB for multiple VAT rates)
  vat_summary JSONB, -- [{ rate: 27, net: 10000, vat: 2700, gross: 12700 }, ...]

  -- Additional Info
  language VARCHAR(2) DEFAULT 'hu',
  comment TEXT,
  internal_note TEXT, -- Not visible on invoice

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, finalized, sent, paid, cancelled

  -- NAV Related
  nav_status VARCHAR(20) DEFAULT 'pending', -- pending, submitted, confirmed, failed
  nav_transaction_id VARCHAR(100), -- NAV transaction ID
  nav_confirmed_at TIMESTAMP,
  nav_error TEXT, -- Error message if NAV submission failed

  -- File References
  pdf_path VARCHAR(500), -- Path to generated PDF
  nav_xml_path VARCHAR(500), -- Path to NAV XML

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMP, -- When moved from draft to finalized
  deleted_at TIMESTAMP, -- Soft delete (only for drafts)

  -- Constraints
  CONSTRAINT unique_invoice_number_per_org UNIQUE(organization_id, invoice_number),
  CONSTRAINT check_storno_has_original CHECK (
    invoice_type != 'storno' OR original_invoice_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_partner_id ON invoices(partner_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(organization_id, invoice_number);
CREATE INDEX idx_invoices_dates ON invoices(organization_id, issue_date, due_date);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_payment_status ON invoices(organization_id, payment_status);
CREATE INDEX idx_invoices_nav_status ON invoices(nav_status) WHERE nav_status IN ('pending', 'failed');
CREATE INDEX idx_invoices_original ON invoices(original_invoice_id) WHERE original_invoice_id IS NOT NULL;

-- Partitioning by year (optional, for high volume)
-- CREATE TABLE invoices_2025 PARTITION OF invoices FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### 5. invoice_items

Line items for each invoice.

```sql
CREATE TABLE invoice_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Position
  line_number INTEGER NOT NULL, -- Order of items on invoice

  -- Product/Service Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100), -- Optional product SKU/code

  -- Quantity & Unit
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'db', -- db (piece), óra (hour), kg, etc.

  -- Pricing
  net_unit_price DECIMAL(15, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) NOT NULL, -- 27.00, 18.00, 5.00, 0.00 (Hungarian VAT rates)
  vat_code VARCHAR(20), -- NAV VAT code (e.g., 'AAM', 'TAM', 'KBAUK')

  -- Calculated Amounts (for denormalization and performance)
  net_amount DECIMAL(15, 2) NOT NULL, -- quantity * net_unit_price
  vat_amount DECIMAL(15, 2) NOT NULL, -- net_amount * (vat_rate / 100)
  gross_amount DECIMAL(15, 2) NOT NULL, -- net_amount + vat_amount

  -- Additional Info
  comment TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_line_number_per_invoice UNIQUE(invoice_id, line_number)
);

-- Indexes
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_sku ON invoice_items(sku) WHERE sku IS NOT NULL;
```

### 6. nav_submissions

Track all NAV submission attempts with full history.

```sql
CREATE TABLE nav_submissions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Submission Details
  operation_type VARCHAR(20) NOT NULL, -- manage_invoice, manage_annulment, query_transaction
  operation_subtype VARCHAR(20), -- create, storno, annul
  transaction_id VARCHAR(100), -- NAV transaction ID

  -- Request/Response
  request_xml TEXT, -- Full XML sent to NAV
  request_hash VARCHAR(128), -- SHA3-512 hash
  response_json JSONB, -- Full NAV response

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, done, aborted, failed
  processing_results JSONB, -- Validation messages from NAV

  -- Timing
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Error Handling
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  nav_api_version VARCHAR(10) DEFAULT 'v3',
  user_agent VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nav_submissions_organization_id ON nav_submissions(organization_id);
CREATE INDEX idx_nav_submissions_invoice_id ON nav_submissions(invoice_id);
CREATE INDEX idx_nav_submissions_transaction_id ON nav_submissions(transaction_id);
CREATE INDEX idx_nav_submissions_status ON nav_submissions(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_nav_submissions_created_at ON nav_submissions(created_at DESC);
```

### 7. usage_logs

Track API usage for billing and analytics.

```sql
CREATE TABLE usage_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  -- Request Details
  endpoint VARCHAR(255) NOT NULL, -- e.g., "/api/v1/invoices"
  http_method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE
  http_status INTEGER NOT NULL, -- 200, 400, 500, etc.

  -- Timing
  request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  response_time_ms INTEGER, -- Response time in milliseconds

  -- Request/Response Size
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,

  -- IP and User Agent
  client_ip INET,
  user_agent VARCHAR(255),

  -- Resource Tracking
  resource_type VARCHAR(50), -- invoice, partner, etc.
  resource_id UUID, -- ID of the resource created/accessed

  -- Operation Costs (for billing)
  operation_cost DECIMAL(10, 4) DEFAULT 0, -- Cost in credits/units

  -- Error Details (if failed)
  error_code VARCHAR(50),
  error_message TEXT,

  -- Metadata
  request_id VARCHAR(100), -- Trace ID for debugging

  -- Timestamps (single field for logs)
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_usage_logs_organization_id ON usage_logs(organization_id, created_at DESC);
CREATE INDEX idx_usage_logs_api_key_id ON usage_logs(api_key_id, created_at DESC);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_endpoint ON usage_logs(endpoint, organization_id);

-- Partitioning by month (recommended for high volume)
-- CREATE TABLE usage_logs_2025_01 PARTITION OF usage_logs FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 8. usage_aggregates

Pre-aggregated usage data for fast reporting.

```sql
CREATE TABLE usage_aggregates (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  aggregation_type VARCHAR(20) NOT NULL, -- daily, monthly

  -- Counts
  api_calls_total INTEGER DEFAULT 0,
  api_calls_success INTEGER DEFAULT 0,
  api_calls_failed INTEGER DEFAULT 0,

  -- Invoice Operations
  invoices_created INTEGER DEFAULT 0,
  invoices_storned INTEGER DEFAULT 0,
  invoices_submitted_to_nav INTEGER DEFAULT 0,
  pdfs_generated INTEGER DEFAULT 0,

  -- Data Transfer
  total_request_bytes BIGINT DEFAULT 0,
  total_response_bytes BIGINT DEFAULT 0,

  -- Performance
  avg_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,

  -- Costs (for billing)
  total_cost DECIMAL(15, 4) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_org_period UNIQUE(organization_id, period_start, aggregation_type)
);

-- Indexes
CREATE INDEX idx_usage_aggregates_organization_period ON usage_aggregates(organization_id, period_start DESC);
```

### 9. audit_logs

Comprehensive audit trail for security and compliance.

```sql
CREATE TABLE audit_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID, -- If user management is added later

  -- Event Details
  event_type VARCHAR(50) NOT NULL, -- user_login, invoice_created, nav_submitted, etc.
  event_category VARCHAR(50) NOT NULL, -- authentication, invoice, nav, organization
  action VARCHAR(50) NOT NULL, -- create, update, delete, read

  -- Target Resource
  resource_type VARCHAR(50), -- invoice, partner, api_key, etc.
  resource_id UUID,

  -- Changes (for updates)
  old_values JSONB, -- Previous state
  new_values JSONB, -- New state

  -- Context
  ip_address INET,
  user_agent VARCHAR(255),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  -- Additional Info
  description TEXT,
  metadata JSONB, -- Any additional contextual data

  -- Status
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at DESC);
```

## Views for Common Queries

### Active Organizations View

```sql
CREATE VIEW v_active_organizations AS
SELECT
  o.*,
  COUNT(DISTINCT i.id) as total_invoices,
  COUNT(DISTINCT ak.id) as total_api_keys
FROM organizations o
LEFT JOIN invoices i ON i.organization_id = o.id AND i.deleted_at IS NULL
LEFT JOIN api_keys ak ON ak.organization_id = o.id AND ak.is_active = TRUE
WHERE o.deleted_at IS NULL AND o.status = 'active'
GROUP BY o.id;
```

### Invoice Summary View

```sql
CREATE VIEW v_invoice_summary AS
SELECT
  i.id,
  i.organization_id,
  i.invoice_number,
  i.issue_date,
  i.due_date,
  i.gross_amount,
  i.currency,
  i.payment_status,
  i.nav_status,
  p.name as partner_name,
  p.tax_number as partner_tax_number,
  COUNT(ii.id) as item_count
FROM invoices i
JOIN partners p ON p.id = i.partner_id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.deleted_at IS NULL
GROUP BY i.id, p.id;
```

## Functions and Triggers

### Update Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Increment Invoice Number Function

```sql
CREATE OR REPLACE FUNCTION get_next_invoice_number(org_id UUID, prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  year_part VARCHAR;
  invoice_num VARCHAR;
BEGIN
  -- Get and increment the counter
  UPDATE organizations
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = org_id
  RETURNING next_invoice_number - 1 INTO next_num;

  -- Format: PREFIX-YYYY-00001
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
  invoice_num := prefix || '-' || year_part || '-' || LPAD(next_num::VARCHAR, 5, '0');

  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;
```

### Audit Log Trigger for Sensitive Tables

```sql
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (event_type, event_category, action, resource_type, resource_id, old_values)
    VALUES (TG_TABLE_NAME || '_deleted', TG_TABLE_NAME, 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (event_type, event_category, action, resource_type, resource_id, old_values, new_values)
    VALUES (TG_TABLE_NAME || '_updated', TG_TABLE_NAME, 'update', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (event_type, event_category, action, resource_type, resource_id, new_values)
    VALUES (TG_TABLE_NAME || '_created', TG_TABLE_NAME, 'create', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply to sensitive tables
CREATE TRIGGER audit_organizations AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## Data Retention Policies

### Usage Logs Retention

Keep detailed logs for 12 months, then archive or aggregate:

```sql
-- Run monthly via cron/scheduler
DELETE FROM usage_logs
WHERE created_at < NOW() - INTERVAL '12 months';
```

### Audit Logs Retention

Keep audit logs for 7 years (compliance requirement):

```sql
-- Archive to cold storage after 2 years
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years'
-- Export to S3/archive then delete
```

## Performance Optimization Notes

1. **Partitioning**: Consider partitioning `invoices`, `usage_logs`, and `nav_submissions` by date for high-volume organizations

2. **Indexes**: All foreign keys have indexes. Additional composite indexes added for common query patterns.

3. **Materialized Views**: For heavy reporting queries, create materialized views:
   ```sql
   CREATE MATERIALIZED VIEW mv_monthly_stats AS
   SELECT organization_id, DATE_TRUNC('month', created_at) as month,
          COUNT(*) as invoice_count, SUM(gross_amount) as total_revenue
   FROM invoices WHERE deleted_at IS NULL
   GROUP BY organization_id, month;

   CREATE INDEX idx_mv_monthly_stats ON mv_monthly_stats(organization_id, month);
   ```

4. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries and add indexes as needed.

## Security Considerations

1. **Encryption**: `nav_password_encrypted`, `nav_signature_key_encrypted`, and `nav_exchange_key_encrypted` fields contain AES-256 encrypted data.

2. **Row-Level Security**: Implement PostgreSQL RLS policies:
   ```sql
   ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

   CREATE POLICY organization_isolation ON invoices
     USING (organization_id = current_setting('app.current_organization_id')::UUID);
   ```

3. **No Cascade Deletes**: Partners use `ON DELETE RESTRICT` to prevent accidental data loss when referenced by invoices.

4. **Soft Deletes**: Organizations, partners, and draft invoices use soft deletes (deleted_at) for recovery.

5. **Audit Everything**: Triggers on sensitive tables ensure all changes are logged.

## Migration Strategy

1. Use a migration tool (Prisma Migrate, node-pg-migrate, or Flyway)
2. Version all schema changes
3. Test migrations on staging before production
4. Always write both UP and DOWN migrations
5. Never edit existing migrations, create new ones

## Backup Strategy

1. **Daily full backups** to S3/object storage
2. **WAL archiving** for point-in-time recovery
3. **Test restores** monthly
4. **Replication** to read replica for high availability
5. **Encryption** of backups at rest
