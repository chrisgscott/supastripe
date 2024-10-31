"use client"

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Money } from '@/utils/currencyUtils';
import StripePaymentForm from '@/app/new-plan/components/StripePaymentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentPageClientProps {
  customerName: string;
  downpaymentAmount: number;
  totalAmount: number;
  numberOfPayments: number;
}

export default function PaymentPageClient({ 
  customerName, 
  downpaymentAmount, 
  totalAmount, 
  numberOfPayments 
}: PaymentPageClientProps) {
  const options = {
    mode: 'payment' as const,
    amount: downpaymentAmount,
    currency: 'usd',
    setup_future_usage: 'off_session' as const,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0F172A',
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <CardDescription>
          Payment for {customerName}'s payment plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Payment Details:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Initial Payment: {Money.fromCents(downpaymentAmount).toString()}</li>
            <li>Total Plan Amount: {Money.fromCents(totalAmount).toString()}</li>
            <li>Number of Payments: {numberOfPayments}</li>
          </ul>
        </div>
        <Elements stripe={getStripe()} options={options}>
          <StripePaymentForm amount={downpaymentAmount} />
        </Elements>
      </CardContent>
    </Card>
  );
}