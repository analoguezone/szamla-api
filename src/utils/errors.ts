// Custom error classes

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

// Billing errors
export class InsufficientCreditsError extends AppError {
  constructor(available: number, required: number) {
    super(
      `Insufficient credits. Available: ${available}, Required: ${required}`,
      402,
      'INSUFFICIENT_CREDITS',
      { available, required }
    );
  }
}

export class PaymentFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 402, 'PAYMENT_FAILED', details);
  }
}

// NAV errors
export class NavError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, 'NAV_ERROR', details);
  }
}

// Invoice errors
export class InvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Invoice', id);
  }
}

export class PartnerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Partner', id);
  }
}

export class OrganizationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Organization', id);
  }
}
