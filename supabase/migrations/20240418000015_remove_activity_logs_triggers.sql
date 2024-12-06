-- Drop old activity log triggers from existing tables
DROP TRIGGER IF EXISTS payment_plan_activity_trigger ON public.payment_plans;
DROP TRIGGER IF EXISTS payout_activity_trigger ON public.payouts;

-- Drop old activity log functions
DROP FUNCTION IF EXISTS public.log_payment_plan_activity();
DROP FUNCTION IF EXISTS public.log_payout_activity();
DROP FUNCTION IF EXISTS public.convert_activity_type_trigger();
DROP FUNCTION IF EXISTS public.text_to_activity_type(text);

-- Drop old type
DROP TYPE IF EXISTS public.activity_type;
