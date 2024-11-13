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

-- Create admin user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  email_change_confirm_status,
  is_sso_user,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '85eaf624-6683-45c9-b0b5-45613807a262',
  'authenticated',
  'authenticated',
  'chris@chrisgscott.me',
  '$2a$10$L.X0TdZyRxUWhX3DxAVPb.5O87C4..f.uLf/rihscL9uvgilI4tHS',
  '2024-10-14 14:13:23.441046+00',
  '2024-10-14 14:12:48.168943+00',
  '2024-11-09 19:29:05.622059+00',
  '{"provider":"email","providers":["email"]}',
  '{"sub":"85eaf624-6683-45c9-b0b5-45613807a262","email":"chris@chrisgscott.me","email_verified":false,"phone_verified":false}',
  '2024-10-14 14:12:48.118029+00',
  '2024-11-13 13:30:22.733737+00',
  0,
  false,
  false
);

-- Create corresponding profile
INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  is_onboarded,
  created_at,
  updated_at,
  business_name,
  business_url,
  business_type,
  business_description,
  support_email,
  support_phone,
  address_line1,
  address_line2,
  address_city,
  address_state,
  address_postal_code,
  address_country,
  logo_url,
  stripe_account_id
) VALUES (
  '85eaf624-6683-45c9-b0b5-45613807a262',
  'Chris',
  'Scott',
  'true',
  '2024-10-14 17:57:30.718088+00',
  '2024-10-18 16:32:13.991912+00',
  'PayKit.io',
  'https://paykit.io',
  'LLC',
  'Simple payment plan SaaS for small businesses.',
  'hello@paykit.io',
  '6155127717',
  '2850 Bannock Hwy',
  'Unit 10',
  'Pocatello',
  'ID',
  '83204',
  'USA',
  null,
  null
);

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