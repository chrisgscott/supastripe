# PayKit API Endpoints

## Overview

PayKit provides a set of secure API endpoints for managing payment plans, processing payments, and handling customer data. All endpoints are protected by authentication and follow RESTful conventions.

## Authentication

All API endpoints require authentication using a valid session token. The token should be included in the `Authorization` header as a Bearer token:

```
Authorization: Bearer <session-token>
```

## Payment Plan Endpoints

### Create Payment Plan and Downpayment Intent

```typescript
POST /api/create-downpayment-intent-and-pending-records
```

Creates a new payment plan and initializes a Stripe payment intent for the downpayment.

**Request Body:**
```typescript
{
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  downpaymentAmount: number;
  numberOfPayments: number;
  paymentInterval: 'weekly' | 'monthly';
  notes?: {
    content: string;
    delta: object;
    plaintext: string;
  };
  paymentSchedule: Array<{
    amount: number;
    date: string;
    transaction_type: 'downpayment' | 'installment';
  }>;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    paymentPlanId: string;
    clientSecret: string;
    stripeCustomerId: string;
  };
}
```

### List Payment Plans

```typescript
GET /api/payment-plans
```

Retrieves a list of both active and pending payment plans.

**Query Parameters:**
- `status`: Filter by plan status (optional)
- `search`: Search by customer name or email (optional)
- `sortBy`: Sort field (customerName, totalAmount, nextPaymentDate, status)
- `sortOrder`: Sort direction (asc, desc)

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    customerName: string;
    totalAmount: string;
    nextPaymentDate: string;
    status: string;
    isPending: boolean;
    customer: {
      name: string;
      email: string;
    };
    transactions: Array<{
      id: string;
      amount: number;
      dueDate: string;
      status: string;
      type: string;
    }>;
  }>;
}
```

### Get Plan Details

```typescript
GET /api/get-plan-details/[id]
```

Retrieves detailed information about a specific payment plan.

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    customer: {
      name: string;
      email: string;
      stripeCustomerId: string;
    };
    totalAmount: number;
    downpaymentAmount: number;
    numberOfPayments: number;
    paymentInterval: string;
    status: string;
    cardLastFour?: string;
    cardExpiration?: {
      month: number;
      year: number;
    };
    transactions: Array<{
      id: string;
      amount: number;
      dueDate: string;
      status: string;
      type: string;
      paidAt?: string;
      nextAttemptDate?: string;
    }>;
    notes?: {
      content: string;
      delta: object;
      plaintext: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}
```

### Cancel Payment Plan

```typescript
POST /api/cancel-payment-plan
```

Cancels an active payment plan.

**Request Body:**
```typescript
{
  planId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    status: 'cancelled';
  };
}
```

### Send Payment Link

```typescript
POST /api/send-payment-link
```

Generates and sends a payment link to the customer.

**Request Body:**
```typescript
{
  planId: string;
  customerEmail: string;
  customerName: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    emailId: string;
    paymentUrl: string;
  };
}
```

### Handle Payment Confirmation

```typescript
POST /api/handle-payment-confirmation
```

Processes a successful payment confirmation.

**Request Body:**
```typescript
{
  paymentIntentId: string;
  planId: string;
  cardLastFour: string;
  cardExpirationMonth: number;
  cardExpirationYear: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    planId: string;
    status: string;
    transactionId: string;
  };
}
```

### Update Payment Method

```typescript
POST /api/update-payment-method
```

Updates the payment method for a plan.

**Request Body:**
```typescript
{
  planId: string;
  paymentMethodId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    cardLastFour: string;
    cardExpiration: {
      month: number;
      year: number;
    };
  };
}
```

## Activity and Monitoring

### Plan Activity Logs

```typescript
GET /api/plan-activity-logs
```

Retrieves activity logs for a payment plan.

**Query Parameters:**
- `planId`: Payment plan ID

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    action: string;
    details: object;
    createdAt: string;
  }>;
}
```

### Failed Transactions

```typescript
GET /api/failed-transactions
```

Retrieves a list of failed transactions.

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    planId: string;
    customerName: string;
    amount: number;
    dueDate: string;
    nextAttemptDate: string;
    failureReason: string;
  }>;
}
```

## Error Handling

All endpoints follow a consistent error response format:

```typescript
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

Common error codes:
- `UNAUTHORIZED`: Authentication required or invalid token
- `FORBIDDEN`: User doesn't have permission to access the resource
- `NOT_FOUND`: Requested resource not found
- `VALIDATION_ERROR`: Invalid request parameters
- `STRIPE_ERROR`: Error from Stripe API
- `PAYMENT_ERROR`: Payment processing error
- `MIGRATION_ERROR`: Error during plan migration
- `EMAIL_ERROR`: Error sending email
- `RATE_LIMIT`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse. The current limits are:
- 100 requests per minute per IP address
- 1000 requests per hour per user

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```
