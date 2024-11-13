import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { User } from '@supabase/supabase-js';

interface DangerZoneProps {
  user: User;
}

export default function DangerZone({ user }: DangerZoneProps) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // If successful, sign out and redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      setShowDeleteConfirmation(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>Permanently delete your PayKit account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Deleting your PayKit account will:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Remove all your personal and business information from our system</li>
            <li>Disconnect your Stripe Connect account from our platform</li>
            <li>Cancel any ongoing payment plans (customers will not be charged further)</li>
            <li>Make it impossible to recover your account or data</li>
          </ul>
          <p className="mt-2">
            Note: This action will not delete your Stripe account. You'll still be able to access it directly through Stripe.
          </p>
        </div>
        {!showDeleteConfirmation ? (
          <Button variant="destructive" onClick={handleDeleteAccount}>Delete PayKit Account</Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-600">Are you absolutely sure you want to delete your account?</p>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>Yes, Delete My Account</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}