'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/utils/currencyUtils';
import { useState } from 'react';
import { toast } from 'sonner';
import { EventTracker } from '@/components/EventTracker';

interface PaymentSuccessClientProps {
  planId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  numberOfPayments: number;
  paymentInterval: string;
  track?: string;
  metadata?: Record<string, any>;
}

export default function PaymentSuccessClient({ 
  planId,
  customerName,
  customerEmail,
  totalAmount,
  numberOfPayments,
  paymentInterval,
  track,
  metadata
}: PaymentSuccessClientProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/send-payment-plan-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPlanId: planId })
      });

      if (!response.ok) throw new Error('Failed to send email');
      
      toast.success('Payment plan details sent to ' + customerEmail);
    } catch (error) {
      toast.error('Failed to send payment plan details');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      {track === 'first_plan_created' && (
        <EventTracker 
          event="first_plan_created"
          description="User created their first payment plan"
          metadata={metadata}
        />
      )}
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Payment Successful!</CardTitle>
            <CardDescription>
              Your payment plan has been set up successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-medium">Payment Plan Details</h3>
              <p>Name: {customerName}</p>
              <p>Email: {customerEmail}</p>
              <p>Total Amount: {Money.fromCents(totalAmount).toString()}</p>
              <p>Payment Schedule: {numberOfPayments} {paymentInterval} payments</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Would you like to receive your payment plan details via email?
              </p>
              <Button 
                onClick={handleSendEmail} 
                disabled={isSending}
                className="w-full"
              >
                {isSending ? 'Sending...' : 'Send Plan Details'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}