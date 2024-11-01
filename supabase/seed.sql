-- Create admin profile
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
  address_country
) VALUES (
  '85eaf624-6683-45c9-b0b5-45613807a262',
  'Chris',
  'Scott',
  true,
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
  'USA'
) ON CONFLICT (id) DO NOTHING;

-- Create Stripe account connection
INSERT INTO public.stripe_accounts (
  id,
  user_id,
  stripe_account_id,
  stripe_onboarding_completed,
  stripe_account_created_at,
  created_at,
  updated_at
) VALUES (
  '58cb63a8-4e93-4a61-a883-fd4679e86784',
  '85eaf624-6683-45c9-b0b5-45613807a262',
  'acct_1Q9pUKIV3zKGSLT3',
  true,
  '2024-10-14 14:43:14.511+00',
  '2024-10-14 14:43:14.744445+00',
  '2024-10-17 05:32:26.362843+00'
) ON CONFLICT (id) DO NOTHING;