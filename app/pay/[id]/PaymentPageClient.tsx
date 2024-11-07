"use client"

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Money } from '@/utils/currencyUtils';
import StripePaymentForm from '@/app/new-plan/components/StripePaymentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewPlanProvider } from '@/app/new-plan/NewPlanContext';
import { format } from 'date-fns';
import { CalendarClock, DollarSign } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useState, useEffect } from 'react';

const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentScheduleItem {
  date: string;
  amount: number;
  transaction_type: 'downpayment' | 'installment';
}

interface PaymentPageClientProps {
  customerName: string;
  customerEmail: string;
  downpaymentAmount: number;
  totalAmount: number;
  numberOfPayments: number;
  paymentPlanId: string;
  paymentSchedule: PaymentScheduleItem[];
}

export default function PaymentPageClient({ 
  customerName, 
  customerEmail,
  downpaymentAmount, 
  totalAmount, 
  numberOfPayments,
  paymentPlanId,
  paymentSchedule
}: PaymentPageClientProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    async function createPaymentIntent() {
      console.log('Creating payment intent for plan:', paymentPlanId);
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: downpaymentAmount,
          paymentPlanId,
          setupFutureUsage: 'off_session'
        }),
      });
      const data = await response.json();
      console.log('Payment intent created:', { hasClientSecret: !!data.clientSecret });
      setClientSecret(data.clientSecret);
    }
    createPaymentIntent();
  }, [downpaymentAmount, paymentPlanId]);

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0F172A',
      },
    },
  };

  const sortedPayments = [...paymentSchedule].sort((a, b) => {
    if (a.transaction_type === "downpayment") return -1;
    if (b.transaction_type === "downpayment") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <NewPlanProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customerName}</h1>
            <p className="text-muted-foreground mt-1">{customerEmail}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p><strong>Plan ID:</strong> {paymentPlanId}</p>
            <p><strong>Created:</strong> {format(new Date(), "MMM dd, yyyy")}</p>
          </div>
        </div>

        {/* Payment Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Down Payment</p>
                  <p className="text-2xl font-bold">
                    {Money.fromCents(downpaymentAmount).toString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <CalendarClock className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Total Plan Amount</p>
                  <p className="text-2xl font-bold">
                    {Money.fromCents(totalAmount).toString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Schedule */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
                <CardDescription>
                  Your payment plan breakdown:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayments.map((payment, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {payment.transaction_type === 'downpayment' 
                            ? "Due Now" 
                            : format(new Date(payment.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Money.fromCents(payment.amount).toString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
                <Elements stripe={getStripe()} options={options}>
                  <StripePaymentForm 
                    amount={Money.fromCents(downpaymentAmount)}
                    clientSecret={clientSecret}
                    paymentPlanId={paymentPlanId}
                  />
                </Elements>
          </div>
        </div>
      </div>
    </NewPlanProvider>
  );
}