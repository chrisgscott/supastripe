'use client';

import React from 'react';

interface StripeAccountInfoProps {
  account: {
    id: string;
    user_id: string;
    stripe_account_id: string;
    stripe_onboarding_completed: boolean;
    stripe_account_created_at: string;
    stripe_account_details_url: string | null;
  } | null;
  profile: {
    business_name: string | null;
    business_url: string | null;
    business_phone: string | null;
    business_email: string | null;
  } | null;
  accountEmail: string | null;
  error?: string | null;
}

export default function StripeAccountInfo({ account, profile, accountEmail, error }: StripeAccountInfoProps) {
  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!account) {
    return <div>No Stripe account connected. Please connect your Stripe account to view details.</div>;
  }

  return (
    <div className="stripe-account-info">
      <h2>Stripe Connect Account Information</h2>
      <p>Account ID: {account.stripe_account_id}</p>
      <p>Onboarding Completed: {account.stripe_onboarding_completed ? 'Yes' : 'No'}</p>
      <p>Account Created At: {new Date(account.stripe_account_created_at).toLocaleString()}</p>
      <h3>Business Information</h3>
      <p>Business Name: {profile?.business_name || 'Not provided'}</p>
      <p>Business URL: {profile?.business_url || 'Not provided'}</p>
      <p>Business Phone: {profile?.business_phone || 'Not provided'}</p>
      <p>Account Email: {accountEmail || 'Not provided'}</p>
      <p>Stripe Account Email: {profile?.business_email || 'Not provided'}</p>
      {account.stripe_account_details_url && (
        <p>
          <a href={account.stripe_account_details_url} target="_blank" rel="noopener noreferrer">
            View Account Details
          </a>
        </p>
      )}
    </div>
  );
}
