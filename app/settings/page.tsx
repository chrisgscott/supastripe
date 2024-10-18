"use client";

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProfileSettings from './components/ProfileSettings';
import StripeSettings from './components/StripeSettings';
import EmailSettings from './components/EmailSettings';

type SettingsTab = 'profile' | 'stripe' | 'email';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'stripe':
        return <StripeSettings />;
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
                Profile
              </Button>
              <Button
                variant={activeTab === 'stripe' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('stripe')}
              >
                Stripe
              </Button>
              <Button
                variant={activeTab === 'email' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('email')}
              >
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
