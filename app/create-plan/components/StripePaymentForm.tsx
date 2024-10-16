import React, { useEffect, useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useCreatePlan } from '@/app/create-plan/CreatePlanContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function StripePaymentForm() {
  const { planDetails } = useCreatePlan();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    console.log('StripePaymentForm: Component mounted');
    console.log('StripePaymentForm: Initial stripe state:', !!stripe);
    console.log('StripePaymentForm: Initial elements state:', !!elements);
    console.log('StripePaymentForm: Initial planDetails:', planDetails);
  }, []);

  useEffect(() => {
    console.log('StripePaymentForm: isPaymentElementReady changed:', isPaymentElementReady);
  }, [isPaymentElementReady]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('StripePaymentForm: Form submitted');
    console.log('StripePaymentForm: stripe state:', !!stripe);
    console.log('StripePaymentForm: elements state:', !!elements);
    console.log('StripePaymentForm: isPaymentElementReady state:', isPaymentElementReady);

    if (!stripe || !elements || !isPaymentElementReady) {
      console.log('StripePaymentForm: Stripe, elements, or PaymentElement not ready');
      return;
    }

    setIsLoading(true);
    console.log('StripePaymentForm: Confirming payment...');

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-status`,
        },
      });

      if (submitError) {
        console.error('StripePaymentForm: Payment confirmation error:', submitError);
        setError(submitError.message || 'An unexpected error occurred.');
      } else {
        console.log('StripePaymentForm: Payment confirmed successfully');
      }
    } catch (error) {
      console.error('StripePaymentForm: Unexpected error during payment confirmation:', error);
      setError('An unexpected error occurred during payment confirmation.');
    }

    setIsLoading(false);
  };

  if (!stripe || !elements) {
    return <div>Loading payment form...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
        <CardDescription>Complete your payment to finalize the plan</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <PaymentElement 
            onReady={() => setIsPaymentElementReady(true)}
            options={{
              layout: "tabs",
              defaultValues: {
                billingDetails: {
                  name: planDetails.customerName,
                  email: planDetails.customerEmail,
                }
              }
            }}
          />
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={!stripe || !elements || !isPaymentElementReady || isLoading}
        >
          {isLoading ? "Processing..." : "Pay Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
