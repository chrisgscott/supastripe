SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Note: User creation is now handled through Supabase Auth API
-- The profile will be created via a trigger when the user signs up

-- Grant necessary permissions
GRANT ALL ON TABLE "public"."activity_logs" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."customers" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."email_logs" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."payment_plans" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."pending_payment_plans" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."pending_customers" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."pending_transactions" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."payment_processing_logs" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."payouts" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."transactions" TO "anon", "authenticated", "service_role";

-- Grant RPC permissions for all stored procedures
GRANT EXECUTE ON FUNCTION public.handle_successful_payment(p_transaction_id uuid, p_paid_at timestamp with time zone) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_failed_payment(p_transaction_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pending_payment_records(p_customer_id uuid, p_payment_plan_id uuid, p_transaction_id uuid, p_customer_name text, p_customer_email text, p_user_id uuid, p_total_amount integer, p_number_of_payments integer, p_payment_interval text, p_downpayment_amount integer, p_payment_schedule jsonb, p_stripe_customer_id text, p_idempotency_key uuid, p_notes jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_payment_confirmation(p_pending_plan_id uuid, p_payment_intent_id text, p_idempotency_key uuid, p_card_last_four text, p_card_expiration_month integer, p_card_expiration_year integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_plan_creation(p_payment_plan_id uuid, p_transaction_id uuid, p_idempotency_key uuid, p_card_last_four text) TO anon, authenticated, service_role;

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";

RESET ALL;