import { User } from '@supabase/supabase-js';
import { Database } from './supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row'];

export interface OnboardingData {
  first_name: string;
  last_name: string;
  business_name: string;
  business_type: string;
  business_url: string;
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  support_email: string;
  support_phone: string;
}

export interface StepProps {
  data: Partial<OnboardingData>;
  onSubmit: (data: Partial<OnboardingData>) => Promise<void>;
}

export interface OnboardingFlowProps {
  user: User;
  profile: Profile;
  stripeAccount: StripeAccount | null;
}

export type { Profile, StripeAccount };