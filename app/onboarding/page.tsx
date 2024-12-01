'use client';

import { createClient } from '@/utils/supabase/client';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();
  }, []);

  if (!user) {
    return null; // Or a loading state
  }

  return <OnboardingProgress user={user} />;
}
