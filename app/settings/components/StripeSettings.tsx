import React from 'react';
import { Button } from "@/components/ui/button";
import StripeAccountInfo from '@/app/account/stripe-account-info';

interface StripeSettingsProps {
  stripeAccount: any;
  profile: any;
  user: any;
  error: string | null;
}

export default function StripeSettings({ stripeAccount, profile, user, error }: StripeSettingsProps) {
  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/stripe-disconnect', { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to disconnect Stripe account');
      }
      // You might want to refresh the page or update the state here
    } catch (err) {
      console.error('Error disconnecting Stripe account:', err);
    }
  };

  const handleReconnect = async () => {
    try {
      const response = await fetch('/api/stripe-reconnect', { method: 'POST' });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to initiate Stripe reconnection');
      }
    } catch (err) {
      console.error('Error reconnecting Stripe account:', err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Stripe Settings</h2>
      <StripeAccountInfo 
        account={stripeAccount} 
        profile={profile} 
        accountEmail={user?.email || null} 
        error={error} 
      />
      {stripeAccount ? (
        <Button onClick={handleDisconnect} className="mt-4">
          Disconnect Stripe Account
        </Button>
      ) : (
        <Button onClick={handleReconnect} className="mt-4">
          Connect Stripe Account
        </Button>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
