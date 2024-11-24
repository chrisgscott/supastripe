# PayKit Database Schema

## Overview

PayKit uses a PostgreSQL database hosted on Supabase. The schema is designed around the concept of payment plans and their associated transactions, with a strong focus on data integrity and audit trails.

## Core Tables

### customers
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### payment_plans
```sql
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  total_amount INTEGER NOT NULL,
  downpayment_amount INTEGER NOT NULL,
  number_of_payments INTEGER NOT NULL,
  payment_interval payment_interval_type NOT NULL,
  status payment_status_type NOT NULL DEFAULT 'pending',
  card_last_four TEXT,
  card_expiration_month INTEGER,
  card_expiration_year INTEGER,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_updated_at TIMESTAMPTZ
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  transaction_type transaction_type NOT NULL,
  status transaction_status_type NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  next_attempt_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Pending Tables
These tables mirror their active counterparts but store temporary data during plan creation:

### pending_customers
```sql
CREATE TABLE pending_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### pending_payment_plans
```sql
CREATE TABLE pending_payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES pending_customers(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  total_amount INTEGER NOT NULL,
  downpayment_amount INTEGER NOT NULL,
  number_of_payments INTEGER NOT NULL,
  payment_interval payment_interval_type NOT NULL,
  status payment_status_type NOT NULL DEFAULT 'pending',
  idempotency_key UUID NOT NULL,
  notes JSONB,
  card_last_four TEXT,
  card_expiration_month INTEGER,
  card_expiration_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_updated_at TIMESTAMPTZ
);
```

### pending_transactions
```sql
CREATE TABLE pending_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_plan_id UUID NOT NULL REFERENCES pending_payment_plans(id),
  amount INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status transaction_status_type NOT NULL DEFAULT 'pending',
  transaction_type transaction_type NOT NULL,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Support Tables

### activity_logs
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### email_logs
```sql
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_type TEXT NOT NULL,
  status TEXT NOT NULL,
  related_id UUID NOT NULL,
  related_type TEXT NOT NULL,
  idempotency_key UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
```

## Enums

### payment_interval_type
```sql
CREATE TYPE payment_interval_type AS ENUM (
  'weekly',
  'monthly'
);
```

### transaction_type
```sql
CREATE TYPE transaction_type AS ENUM (
  'downpayment',
  'installment'
);
```

### payment_status_type
```sql
CREATE TYPE payment_status_type AS ENUM (
  'pending',
  'pending_payment',
  'ready_to_migrate',
  'active',
  'completed',
  'failed',
  'cancelled'
);
```

### transaction_status_type
```sql
CREATE TYPE transaction_status_type AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);
```

## RLS Policies

### customers
```sql
CREATE POLICY "Users can view their own customers"
  ON customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create customers"
  ON customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### payment_plans
```sql
CREATE POLICY "Users can view their own payment plans"
  ON payment_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create payment plans"
  ON payment_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_payment_plans_user_id ON payment_plans(user_id);
CREATE INDEX idx_transactions_payment_plan_id ON transactions(payment_plan_id);
CREATE INDEX idx_transactions_due_date ON transactions(due_date);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
```

### Unique Constraints
```sql
ALTER TABLE pending_payment_plans 
  ADD CONSTRAINT unique_idempotency_key 
  UNIQUE (idempotency_key);

ALTER TABLE email_logs 
  ADD CONSTRAINT unique_email_idempotency_key 
  UNIQUE (idempotency_key);
```

## Common Queries

### Get Active Payment Plans
```sql
SELECT 
  pp.*,
  c.name as customer_name,
  c.email as customer_email,
  (
    SELECT COUNT(*) 
    FROM transactions t 
    WHERE t.payment_plan_id = pp.id 
    AND t.status = 'completed'
  ) as completed_payments
FROM payment_plans pp
JOIN customers c ON c.id = pp.customer_id
WHERE pp.user_id = auth.uid()
AND pp.status = 'active';
```

### Get Upcoming Payments
```sql
SELECT 
  t.*,
  pp.customer_id,
  c.name as customer_name,
  c.email as customer_email
FROM transactions t
JOIN payment_plans pp ON pp.id = t.payment_plan_id
JOIN customers c ON c.id = pp.customer_id
WHERE t.status = 'pending'
AND t.due_date <= NOW() + INTERVAL '7 days'
ORDER BY t.due_date ASC;
```
