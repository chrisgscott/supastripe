'use client';

import { createClient } from '@/utils/supabase/client';
import OnboardingProgress from '@/components/OnboardingProgress';
import OnboardingProfileForm from '@/components/OnboardingProfileForm';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';

interface OnboardingClientProps {
  initialUser: User | null;
}

export default function OnboardingClient({ initialUser }: OnboardingClientProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (initialUser) return;

    // If no initial session, try to get it client-side
    setLoading(true);
    supabase.auth.getUser()
      .then(({ data: { user }, error }) => {
        if (error) throw error;
        setUser(user);
      })
      .catch(err => {
        console.error('Error fetching user:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
      })
      .finally(() => {
        setLoading(false);
      });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialUser]);

  useEffect(() => {
    if (!user) return;

    // Fetch user's profile
    setLoading(true);
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Please sign in to continue</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <OnboardingProfileForm 
        user={user} 
        profile={profile}
        onComplete={() => {
          // Refresh profile data
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              if (data) setProfile(data);
            });
        }}
      />
    </div>
  );
}
