-- Drop triggers first
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Find and drop all triggers that depend on these functions
    FOR trigger_record IN 
        SELECT tgname, relname 
        FROM pg_trigger t 
        JOIN pg_class c ON t.tgrelid = c.oid 
        WHERE tgfoid IN (
            SELECT oid FROM pg_proc WHERE proname IN ('log_email_activity', 'log_payment_plan_activity')
        )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_record.tgname, trigger_record.relname);
    END LOOP;

    -- Now it's safe to drop the functions
    DROP FUNCTION IF EXISTS public.log_email_activity() CASCADE;
    DROP FUNCTION IF EXISTS public.log_payment_plan_activity() CASCADE;
END;
$$;
