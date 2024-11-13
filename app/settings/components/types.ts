import { User } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']
type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row']

export interface ProfileSettingsProps {
  user: User
  profile: Profile
}

export interface StripeSettingsProps {
  user: User
  profile: Profile
  stripeAccount: StripeAccount | null
  error: string | null
}

export interface EmailSettingsProps {
  user: User
}