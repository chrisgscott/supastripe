import { User } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']
type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row']

export interface StripeSettingsProps {
  stripeAccount: StripeAccount | null
  profile: Profile
  user: User
  error?: string | null
}

export interface ProfileSettingsProps {
  user: User
  profile: Profile
}