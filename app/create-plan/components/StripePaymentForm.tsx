import React, { useEffect, useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useCreatePlan } from '@/app/create-plan/CreatePlanContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function StripePaymentForm() {
  const { planDetails, setCurrentStep } = useCreatePlan();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !isPaymentElementReady) {
      return;
    }

    setIsLoading(true);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/create-plan?step=4`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'An unexpected error occurred.');
      }
    } catch (error) {
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
        <CardDescription>Save your payment details to start the payment plan</CardDescription>
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
          variant="default"
          type="submit"
          onClick={handleSubmit}
          disabled={!stripe || !elements || !isPaymentElementReady || isLoading}
        >
          {isLoading ? "Processing..." : "Save and Pay Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
