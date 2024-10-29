import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, Money } from '@/utils/currencyUtils';

interface ConfirmationStepProps {
  planDetails?: {
    customerName: string;
    customerEmail: string;
    totalAmount: number; // This represents dollars
    numberOfPayments: number;
    paymentInterval: string;
    paymentSchedule?: { 
      amount: number; // This represents dollars
      date: string;
      is_downpayment: boolean;
    }[];
    paymentPlanId?: string;
  };
  paymentIntent?: string;
}

export default function ConfirmationStep({ planDetails: initialPlanDetails, paymentIntent }: ConfirmationStepProps) {
    console.log('ConfirmationStep: Initial render with props:', { initialPlanDetails, paymentIntent });
    const [isSending, setIsSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [planDetails, setPlanDetails] = useState(initialPlanDetails);
    const [error, setError] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState({
      customerCreated: false,
      paymentPlanCreated: false,
      transactionsCreated: false,
      paymentIntentCreated: false
    });
  
    useEffect(() => {
      console.log('ConfirmationStep: useEffect triggered', { initialPlanDetails, paymentIntent });
      if (!initialPlanDetails && paymentIntent) {
        console.log('Fetching plan details for payment intent:', paymentIntent);
        fetchPlanDetails();
      }
    }, [initialPlanDetails, paymentIntent]);
  
    const fetchPlanDetails = async () => {
      console.log('ConfirmationStep: fetchPlanDetails called');
      let retryCount = 0;
      const maxRetries = 10;
      const retryDelay = 1000; // 1 second

      const attemptFetch = async () => {
        try {
          const response = await fetch(`/api/handle-payment-confirmation?payment_intent=${paymentIntent}`);
          const data = await response.json();
          console.log('ConfirmationStep: Fetched plan details:', data);

          if (data.success) {
            console.log('ConfirmationStep: Setting plan details and loading status');
            setPlanDetails(data.planDetails);
            setLoadingStatus(data.status);
            return true;
          } else {
            console.error('ConfirmationStep: Error in fetched data:', data.error);
            if (retryCount >= maxRetries) {
              setError(data.error || 'Failed to fetch plan details');
              console.error('Error details:', data.details);
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('ConfirmationStep: Error fetching plan details:', error);
          if (retryCount >= maxRetries) {
            setError('An error occurred while fetching plan details');
            return true;
          }
          return false;
        }
      };

      while (retryCount < maxRetries) {
        const isDone = await attemptFetch();
        if (isDone) break;
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
      }
    };
  
    const handleSendEmail = async () => {
      if (!planDetails?.paymentPlanId) {
        console.error('Payment plan ID is undefined');
        return;
      }
      setIsSending(true);
      try {
        const response = await fetch('/api/send-payment-plan-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentPlanId: planDetails.paymentPlanId }),
        });
  
        if (response.ok) {
          console.log('Email sent successfully');
          setEmailSent(true);
        } else {
          setError('Failed to send payment plan email');
        }
      } catch (error) {
        console.error('Error sending payment plan email:', error);
        setError('Error sending payment plan email');
      } finally {
        setIsSending(false);
      }
    };
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
  
    if (!planDetails) {
      return (
        <div>
          <h2>Processing your payment...</h2>
          <ul>
            <li>{loadingStatus.customerCreated ? '✅' : '⏳'} Creating customer</li>
            <li>{loadingStatus.paymentPlanCreated ? '✅' : '⏳'} Creating payment plan</li>
            <li>{loadingStatus.transactionsCreated ? '✅' : '⏳'} Adding transactions</li>
            <li>{loadingStatus.paymentIntentCreated ? '✅' : '⏳'} Processing payment</li>
          </ul>
        </div>
      );
    }
  
    console.log('ConfirmationStep: Rendering with state:', { planDetails, error, loadingStatus });
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Plan Confirmed</CardTitle>
          <CardDescription>Your payment plan has been successfully created and the first payment processed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Customer Name:</strong> {planDetails.customerName}</p>
            <p><strong>Customer Email:</strong> {planDetails.customerEmail}</p>
            <p>
              <strong>Total Amount:</strong> {formatCurrency(Money.fromCents(planDetails.totalAmount))}
            </p>
            <p><strong>Number of Payments:</strong> {planDetails.numberOfPayments}</p>
            <p><strong>Payment Interval:</strong> {planDetails.paymentInterval}</p>
            {planDetails.paymentSchedule && planDetails.paymentSchedule.length > 0 && (
              <p><strong>First Payment Amount:</strong> {formatCurrency(planDetails.paymentSchedule[0].amount)}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start space-y-2">
          <Button onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
          <Button 
            onClick={handleSendEmail} 
            disabled={isSending || emailSent || !planDetails.paymentPlanId}
          >
            {isSending ? 'Sending...' : emailSent ? 'Email Sent' : 'Send Payment Plan Details'}
          </Button>
        </CardFooter>
      </Card>
    );
  }

