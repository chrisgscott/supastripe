import { createClient } from '@/utils/supabase/server';
import OnboardingClient from './OnboardingClient';

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  return <OnboardingClient initialUser={session?.user || null} />;
}