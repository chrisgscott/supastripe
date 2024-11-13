import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StripeAccountInfo from '@/app/account/stripe-account-info';
import { Database } from '@/types/supabase';
import { User } from '@supabase/supabase-js';

type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface FormattedStripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  stripe_onboarding_completed: boolean;
  stripe_account_created_at: string;
  stripe_account_details_url: string | null;
}

interface FormattedProfile {
  business_name: string | null;
  business_url: string | null;
  business_phone: string | null;
  business_email: string | null;
}

interface StripeSettingsProps {
  stripeAccount: StripeAccount | null;
  profile: Profile;
  user: User | null;
  error: string | null;
}

export default function StripeSettings({ stripeAccount, profile, user, error }: StripeSettingsProps) {
  const handleConnect = async () => {
    try {
      const accountResponse = await fetch('/api/account', { 
        method: 'POST',
      });
      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        throw new Error(accountData.error);
      }

      const linkResponse = await fetch('/api/account_link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account: accountData.account }),
      });
      const linkData = await linkResponse.json();

      if (linkData.url) {
        window.location.href = linkData.url;
      } else {
        throw new Error('Failed to get Stripe onboarding URL');
      }
    } catch (err) {
      console.error('Error connecting Stripe account:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/disconnect-stripe', { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to disconnect Stripe account');
      }
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting Stripe account:', err);
    }
  };

  const formatStripeAccount = (account: StripeAccount | null): FormattedStripeAccount | null => {
    if (!account) return null;
    return {
      id: account.id,
      user_id: account.user_id || '',
      stripe_account_id: account.stripe_account_id || '',
      stripe_onboarding_completed: account.stripe_onboarding_completed || false,
      stripe_account_created_at: account.stripe_account_created_at || new Date().toISOString(),
      stripe_account_details_url: account.stripe_account_details_url
    };
  };

  const formatProfile = (profile: Profile): FormattedProfile => {
    return {
      business_name: profile.business_name,
      business_url: profile.business_url,
      business_phone: profile.support_phone,
      business_email: profile.support_email
    };
  };

  const formattedStripeAccount = formatStripeAccount(stripeAccount);
  const formattedProfile = formatProfile(profile);

  // Show connect card if no stripe account or if there's a specific error
  const shouldShowConnectCard = !formattedStripeAccount || error === 'Stripe account not connected';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Settings</CardTitle>
        <CardDescription>
          Manage your Stripe account connection and payment settings
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {shouldShowConnectCard ? (
          <Card className="bg-muted">
            <CardHeader>
              <CardTitle className="text-lg">Connect Your Stripe Account</CardTitle>
              <CardDescription>
                To start accepting payments, you'll need to connect your Stripe account. 
                This will allow you to receive payments directly to your bank account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleConnect} 
                className="w-full sm:w-auto"
              >
                Connect Stripe Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <StripeAccountInfo 
              account={formattedStripeAccount!} 
              profile={formattedProfile}
              accountEmail={user?.email || null}
              error={error}
            />
            {formattedStripeAccount && (
              <Button 
                onClick={handleDisconnect} 
                variant="destructive" 
                className="mt-4"
              >
                Disconnect Stripe Account
              </Button>
            )}
          </>
        )}
        
        {error && error !== 'Stripe account not connected' && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}