import React from 'react';
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
    paymentSchedule?: { amount: number }[];
  };
}

export default function ConfirmationStep({ planDetails }: ConfirmationStepProps) {
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
      <CardFooter>
        <Button onClick={() => window.location.href = '/dashboard'}>
          Go to Dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
