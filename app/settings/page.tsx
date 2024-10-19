"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProfileSettings from './components/ProfileSettings';
import StripeSettings from './components/StripeSettings';
import EmailSettings from './components/EmailSettings';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Wallet, Mail, CircleUser } from "lucide-react";


type SettingsTab = 'profile' | 'stripe' | 'email';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [stripeAccount, setStripeAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          setError('Failed to fetch profile data');
        } else {
          setProfile(profileData);
        }

        const { data: stripeData, error: stripeError } = await supabase
          .from('stripe_accounts')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (stripeError) {
          setError('Failed to fetch Stripe account data');
        } else {
          setStripeAccount(stripeData);
        }
      }
    };

    fetchData();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'stripe':
        return <StripeSettings stripeAccount={stripeAccount} profile={profile} user={user} error={error} />;
      case 'email':
        return <EmailSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-10 flex">
      <div className="w-1/4 pr-4">
        <Card>
          <CardContent className="p-4">
            <nav className="space-y-2">
              <Button
                variant={activeTab === 'profile' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('profile')}
              >
                <CircleUser className="h-5 w-5 mr-3" />
                Profile
              </Button>
              <Button
                variant={activeTab === 'stripe' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('stripe')}
              >
                <Wallet className="h-5 w-5 mr-3" />
                Stripe
              </Button>
              <Button
                variant={activeTab === 'email' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('email')}
              >
                <Mail className="h-5 w-5 mr-3" />
                Email
              </Button>
            </nav>
          </CardContent>
        </Card>
      </div>
      <div className="w-3/4 pl-4">
      {renderContent()}
      </div>
    </div>
  );
}
