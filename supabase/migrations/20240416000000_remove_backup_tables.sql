-- Drop backup tables
DROP TABLE IF EXISTS "public"."customers_backup";
DROP TABLE IF EXISTS "public"."payment_plans_backup";
DROP TABLE IF EXISTS "public"."profiles_backup";
DROP TABLE IF EXISTS "public"."stripe_accounts_backup";
DROP TABLE IF EXISTS "public"."transactions_backup";

-- Verify tables are dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN (
            'customers_backup',
            'payment_plans_backup',
            'profiles_backup',
            'stripe_accounts_backup',
            'transactions_backup'
        )
    ) THEN
        RAISE EXCEPTION 'Backup tables still exist after attempted drop';
    END IF;
END
$$;
