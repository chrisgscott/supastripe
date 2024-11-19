import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StripeAccountInfo from '@/app/account/stripe-account-info';
import { StripeSettingsProps } from './types';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row'];

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

export default function StripeSettings({ stripeAccount, profile, user, error }: StripeSettingsProps) {
  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/disconnect-stripe', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        window.location.reload();
      } else {
        throw new Error(data.error || 'Failed to disconnect Stripe account');
      }
    } catch (err: any) {
      console.error('Error disconnecting Stripe account:', err);
      alert('Error disconnecting account: ' + (err.message || 'Unknown error'));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Settings</CardTitle>
        <CardDescription>
          Manage your Stripe account connection and payment settings
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!formattedStripeAccount ? (
          <Alert>
            <AlertDescription>
              You haven't connected a Stripe account yet. Visit the onboarding page to get started.
            </AlertDescription>
          </Alert>
        ) : !formattedStripeAccount.stripe_onboarding_completed ? (
          <>
            <Alert>
              <AlertDescription>
                Your Stripe account is connected but pending verification. This process typically takes 5-7 business days.
                You can check the status or submit additional verification documents through your Stripe dashboard.
              </AlertDescription>
            </Alert>
            <Button 
              className="mt-4"
              onClick={() => window.open(formattedStripeAccount.stripe_account_details_url || 'https://dashboard.stripe.com', '_blank')}
            >
              Open Stripe Dashboard
            </Button>
          </>
        ) : (
          <>
            <StripeAccountInfo 
              account={formattedStripeAccount} 
              profile={formattedProfile}
              accountEmail={user?.email || null}
              error={error}
            />
            <Button 
              onClick={handleDisconnect} 
              variant="destructive" 
              className="mt-4"
            >
              Disconnect Stripe Account
            </Button>
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
