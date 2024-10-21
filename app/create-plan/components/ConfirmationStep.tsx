import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from '@/utils/formatCurrency';

interface ConfirmationStepProps {
  planDetails: {
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    numberOfPayments: number;
    paymentInterval: string;
    paymentSchedule?: { amount: number; date: string }[];
  };
}

export default function ConfirmationStep({ planDetails }: ConfirmationStepProps) {
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/send-payment-plan-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planDetails),
      });

      if (response.ok) {
        setEmailSent(true);
      } else {
        console.error('Failed to send payment plan email');
      }
    } catch (error) {
      console.error('Error sending payment plan email:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan Confirmed</CardTitle>
        <CardDescription>Your payment plan has been successfully created and the first payment processed.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p>Customer Name: {planDetails.customerName}</p>
          <p>Customer Email: {planDetails.customerEmail}</p>
          <p>Total Amount: {formatCurrency(planDetails.totalAmount)}</p>
          <p>Number of Payments: {planDetails.numberOfPayments}</p>
          <p>Payment Interval: {planDetails.paymentInterval}</p>
          {planDetails.paymentSchedule && planDetails.paymentSchedule.length > 0 && (
            <p>First Payment Amount: {formatCurrency(planDetails.paymentSchedule[0].amount)}</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-2">
        <Button onClick={() => window.location.href = '/dashboard'}>
          Go to Dashboard
        </Button>
        <Button 
          onClick={handleSendEmail} 
          disabled={isSending || emailSent}
        >
          {isSending ? 'Sending...' : emailSent ? 'Email Sent' : 'Send Payment Plan Details'}
        </Button>
      </CardFooter>
    </Card>
  );
}
