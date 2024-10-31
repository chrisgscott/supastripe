-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUMs first
DO $$ BEGIN
    CREATE TYPE payment_interval_type AS ENUM ('weekly', 'monthly');
    CREATE TYPE payment_status_type AS ENUM ('draft', 'pending_payment', 'active', 'paused', 'completed', 'cancelled', 'failed');
    CREATE TYPE transaction_status_type AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    CREATE TYPE transaction_type AS ENUM ('downpayment', 'installment');
    CREATE TYPE processing_status_type AS ENUM ('started', 'completed', 'failed');
    CREATE TYPE email_status_type AS ENUM ('sent', 'failed', 'bounced');
    CREATE TYPE payout_status_type AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'cancelled');
    CREATE TYPE email_type AS ENUM (
        'customer_payment_plan_created', 'customer_payment_plan_ready',
        'customer_payment_plan_modified', 'customer_payment_plan_approved',
        'customer_payment_plan_rejected', 'customer_payment_link_sent',
        'customer_payment_reminder', 'customer_payment_confirmation',
        'customer_payment_failed', 'customer_payment_overdue',
        'customer_payment_plan_completed', 'customer_card_expiring_soon',
        'customer_card_expired', 'customer_card_update_needed',
        'customer_card_updated', 'user_payment_plan_approved',
        'user_payment_plan_rejected', 'user_payment_plan_modified',
        'user_payment_failed_alert', 'user_payment_overdue_alert',
        'user_daily_transactions_summary', 'user_weekly_transactions_summary',
        'user_monthly_transactions_summary', 'user_account_created',
        'user_account_verified', 'user_password_reset', 'user_login_alert',
        'user_stripe_account_connected', 'user_stripe_account_updated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Backup existing data
CREATE TABLE IF NOT EXISTS profiles_backup AS SELECT * FROM profiles;
CREATE TABLE IF NOT EXISTS stripe_accounts_backup AS SELECT * FROM stripe_accounts;
CREATE TABLE IF NOT EXISTS payment_plans_backup AS SELECT * FROM payment_plans;
CREATE TABLE IF NOT EXISTS customers_backup AS SELECT * FROM customers;
CREATE TABLE IF NOT EXISTS transactions_backup AS SELECT * FROM transactions;

-- Modify existing profiles table (preserving data)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name varchar,
ADD COLUMN IF NOT EXISTS last_name varchar,
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS business_description text,
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_postal_code text,
ADD COLUMN IF NOT EXISTS address_country text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT CURRENT_TIMESTAMP;

-- Create trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create new tables
CREATE TABLE IF NOT EXISTS pending_customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, user_id)
);

CREATE TABLE IF NOT EXISTS pending_payment_plans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    customer_id uuid REFERENCES pending_customers(id) NOT NULL,
    total_amount numeric NOT NULL,
    number_of_payments integer NOT NULL,
    payment_interval payment_interval_type NOT NULL,
    downpayment_amount numeric NOT NULL,
    status payment_status_type NOT NULL DEFAULT 'draft',
    status_updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    notes jsonb,
    card_last_four varchar(4),
    card_expiration_month integer,
    card_expiration_year integer,
    payment_link_token text,
    payment_link_expires_at timestamptz,
    change_request_notes text,
    reminder_count integer DEFAULT 0,
    last_reminder_sent_at timestamptz,
    idempotency_key text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_plan_id uuid REFERENCES pending_payment_plans(id),
    amount numeric NOT NULL,
    due_date timestamptz NOT NULL,
    status transaction_status_type NOT NULL,
    next_attempt_date timestamptz,
    stripe_payment_intent_id text,
    transaction_type transaction_type NOT NULL,
    error_message text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create customers table (if not exists)
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, user_id)
);

-- Modify payment_plans table to match new structure
DROP TABLE IF EXISTS payment_plans CASCADE;
CREATE TABLE payment_plans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    customer_id uuid REFERENCES customers(id) NOT NULL,
    total_amount numeric NOT NULL,
    number_of_payments integer NOT NULL,
    payment_interval payment_interval_type NOT NULL,
    downpayment_amount numeric NOT NULL,
    status payment_status_type NOT NULL DEFAULT 'draft',
    status_updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    notes jsonb,
    card_last_four varchar(4),
    card_expiration_month integer,
    card_expiration_year integer,
    payment_link_token text,
    payment_link_expires_at timestamptz,
    change_request_notes text,
    reminder_count integer DEFAULT 0,
    last_reminder_sent_at timestamptz,
    idempotency_key text,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- First add the new column to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS transaction_type transaction_type;

-- Migrate the data from is_downpayment to transaction_type
UPDATE transactions
SET transaction_type = CASE 
    WHEN is_downpayment = true THEN 'downpayment'::transaction_type 
    ELSE 'installment'::transaction_type 
END;

-- Make transaction_type NOT NULL after migration
ALTER TABLE transactions
ALTER COLUMN transaction_type SET NOT NULL;

-- Remove the old column
ALTER TABLE transactions
DROP COLUMN IF EXISTS is_downpayment;

-- Add user_id column to payment_processing_logs
ALTER TABLE payment_processing_logs
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id column to email_logs
ALTER TABLE email_logs
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id column to payouts
ALTER TABLE payouts
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update stripe_accounts table structure
ALTER TABLE stripe_accounts
ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
ADD COLUMN IF NOT EXISTS stripe_onboarding_completed boolean,
ADD COLUMN IF NOT EXISTS stripe_account_created_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_account_details_url text,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT CURRENT_TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_customers_user_id_email ON pending_customers(user_id, email);
CREATE INDEX IF NOT EXISTS idx_pending_customers_email ON pending_customers(email);
CREATE INDEX IF NOT EXISTS idx_pending_customers_stripe_customer_id ON pending_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_pending_payment_plans_payment_link_token ON pending_payment_plans(payment_link_token);
CREATE INDEX IF NOT EXISTS idx_pending_payment_plans_status_user_id ON pending_payment_plans(status, user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payment_plans_customer_id ON pending_payment_plans(customer_id);

CREATE INDEX IF NOT EXISTS idx_pending_transactions_payment_plan_status ON pending_transactions(payment_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_stripe_payment_intent ON pending_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_plan_type ON pending_transactions(payment_plan_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_customers_user_id_email ON customers(user_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_plans_payment_link_token ON payment_plans(payment_link_token);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status_user_id ON payment_plans(status, user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_customer_id ON payment_plans(customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_plan_status ON transactions(payment_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent ON transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plan_type ON transactions(payment_plan_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_payment_processing_logs_user_created ON payment_processing_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_processing_logs_payment_plan ON payment_processing_logs(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_processing_logs_transaction ON payment_processing_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_processing_logs_created ON payment_processing_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_sent ON email_logs(user_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_related ON email_logs(related_id, related_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON email_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_payouts_user_status ON payouts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_stripe_id ON payouts(stripe_payout_id);
CREATE INDEX IF NOT EXISTS idx_payouts_arrival ON payouts(arrival_date);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account ON profiles(stripe_account_id);

-- Create updated_at triggers for all relevant tables
CREATE TRIGGER update_pending_customers_updated_at
    BEFORE UPDATE ON pending_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_payment_plans_updated_at
    BEFORE UPDATE ON pending_payment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_plans_updated_at
    BEFORE UPDATE ON payment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_accounts_updated_at
    BEFORE UPDATE ON stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE pending_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can only access their own data"
    ON pending_customers
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON pending_payment_plans
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON pending_transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM pending_payment_plans
        WHERE id = pending_transactions.payment_plan_id
        AND user_id = auth.uid()
    ));

CREATE POLICY "Users can only access their own data"
    ON customers
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON payment_plans
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM payment_plans
        WHERE id = transactions.payment_plan_id
        AND user_id = auth.uid()
    ));

CREATE POLICY "Users can only access their own data"
    ON payment_processing_logs
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON email_logs
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON payouts
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own data"
    ON profiles
    FOR ALL
    USING (auth.uid() = id);

CREATE POLICY "Users can only access their own data"
    ON stripe_accounts
    FOR ALL
    USING (auth.uid() = user_id);

-- Migrate payment_plan_states data to payment_plans status field
UPDATE payment_plans pp
SET status = pps.status::payment_status_type,
    status_updated_at = pps.created_at
FROM payment_plan_states pps
WHERE pps.payment_plan_id = pp.id;

UPDATE pending_payment_plans pp
SET status = pps.status::payment_status_type,
    status_updated_at = pps.created_at
FROM payment_plan_states pps
WHERE pps.payment_plan_id = pp.id;

-- Drop unused tables and views
DROP VIEW IF EXISTS customer_payment_details CASCADE;
DROP VIEW IF EXISTS detailed_transactions CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS payment_plan_states CASCADE;
DROP TABLE IF EXISTS stripe_reviews;

-- Grant Permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create migration completion verification
CREATE TABLE IF NOT EXISTS migration_20240415000000_completed (
    completed_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO migration_20240415000000_completed DEFAULT VALUES;