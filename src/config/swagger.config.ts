import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

/**
 * Swagger/OpenAPI Configuration
 *
 * Defines the OpenAPI specification for the Hungarian Invoice Management API
 */

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Számlázó NAV API',
    version,
    description: `
      Hungarian Invoice Management API with NAV integration.

      This API provides comprehensive invoice management capabilities including:
      - Organization management
      - Partner (customer/supplier) management
      - Invoice creation and management
      - Hungarian NAV (Tax Authority) integration
      - Billing and usage tracking

      ## Authentication

      All API endpoints require authentication using an API key. Include your API key in the Authorization header:

      \`Authorization: Bearer YOUR_API_KEY\`

      ## Rate Limiting

      API requests are rate-limited to prevent abuse:
      - Standard endpoints: 100 requests per minute
      - Invoice creation: 10 requests per minute
      - NAV endpoints: 5 requests per minute

      ## Multi-tenancy

      All data is scoped to your organization. You can only access and modify resources that belong to your organization.
    `,
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development server',
    },
    {
      url: 'https://api.szamlaz.example.com/api/v1',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Enter your API key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'error',
          },
          message: {
            type: 'string',
            example: 'An error occurred',
          },
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          details: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          taxNumber: {
            type: 'string',
            description: 'Hungarian tax number (8 digits)',
          },
          address: {
            type: 'string',
          },
          city: {
            type: 'string',
          },
          postalCode: {
            type: 'string',
          },
          country: {
            type: 'string',
            default: 'HU',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          phone: {
            type: 'string',
          },
          bankAccountNumber: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Partner: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: ['customer', 'supplier', 'both'],
          },
          taxNumber: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          city: {
            type: 'string',
          },
          postalCode: {
            type: 'string',
          },
          country: {
            type: 'string',
            default: 'HU',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          phone: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          partnerId: {
            type: 'string',
            format: 'uuid',
          },
          invoiceNumber: {
            type: 'string',
          },
          invoiceType: {
            type: 'string',
            enum: ['normal', 'proforma', 'deposit', 'final', 'corrective', 'storno'],
          },
          issuedAt: {
            type: 'string',
            format: 'date-time',
          },
          dueAt: {
            type: 'string',
            format: 'date-time',
          },
          paymentMethod: {
            type: 'string',
            enum: ['cash', 'transfer', 'card', 'other'],
          },
          currency: {
            type: 'string',
            default: 'HUF',
          },
          exchangeRate: {
            type: 'number',
            format: 'decimal',
          },
          subtotal: {
            type: 'number',
            format: 'decimal',
          },
          vatAmount: {
            type: 'number',
            format: 'decimal',
          },
          total: {
            type: 'number',
            format: 'decimal',
          },
          navStatus: {
            type: 'string',
            enum: ['draft', 'pending', 'submitted', 'failed'],
          },
          navTransactionId: {
            type: 'string',
            nullable: true,
          },
          navConfirmedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          navError: {
            type: 'string',
            nullable: true,
          },
          stornoInvoiceId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/InvoiceItem',
            },
          },
        },
      },
      InvoiceItem: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          invoiceId: {
            type: 'string',
            format: 'uuid',
          },
          lineNumber: {
            type: 'integer',
          },
          description: {
            type: 'string',
          },
          quantity: {
            type: 'number',
            format: 'decimal',
          },
          unitOfMeasure: {
            type: 'string',
          },
          unitPrice: {
            type: 'number',
            format: 'decimal',
          },
          vatRate: {
            type: 'number',
            format: 'decimal',
            description: 'VAT rate as percentage (e.g., 27 for 27%)',
          },
          vatAmount: {
            type: 'number',
            format: 'decimal',
          },
          lineTotal: {
            type: 'number',
            format: 'decimal',
          },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          key: {
            type: 'string',
            description: 'Only returned when creating a new API key',
          },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          lastUsedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      UsageStats: {
        type: 'object',
        properties: {
          periodStart: {
            type: 'string',
            format: 'date-time',
          },
          periodEnd: {
            type: 'string',
            format: 'date-time',
          },
          totalRequests: {
            type: 'integer',
          },
          totalCredits: {
            type: 'integer',
          },
          successfulRequests: {
            type: 'integer',
          },
          failedRequests: {
            type: 'integer',
          },
          avgResponseTimeMs: {
            type: 'number',
            format: 'decimal',
          },
          totalRequestBytes: {
            type: 'integer',
          },
          totalResponseBytes: {
            type: 'integer',
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Unauthorized - Missing or invalid API key',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      BadRequest: {
        description: 'Bad Request - Invalid input',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Too Many Requests - Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Organizations',
      description: 'Organization management endpoints',
    },
    {
      name: 'API Keys',
      description: 'API key management endpoints',
    },
    {
      name: 'Partners',
      description: 'Partner (customer/supplier) management endpoints',
    },
    {
      name: 'Invoices',
      description: 'Invoice management and NAV integration endpoints',
    },
    {
      name: 'Usage',
      description: 'API usage tracking and analytics endpoints',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
