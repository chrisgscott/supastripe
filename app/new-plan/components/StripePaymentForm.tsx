import React, { useState, useEffect } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useNewPlan } from "@/app/new-plan/NewPlanContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle, 
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/utils/currencyUtils";
import { ReloadIcon } from "@radix-ui/react-icons";

interface StripePaymentFormProps {
  amount?: number;
}

export default function StripePaymentForm({ amount }: StripePaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();
  const { planDetails, setError, createPaymentIntent, setIsStripeReady } = useNewPlan();

  console.log('StripePaymentForm: Rendering with amount:', amount);
  console.log('StripePaymentForm: Stripe and Elements status:', { stripe: !!stripe, elements: !!elements });

  useEffect(() => {
    console.log('StripePaymentForm: Elements or Stripe updated:', { 
      stripeLoaded: !!stripe, 
      elementsLoaded: !!elements 
    });
  }, [stripe, elements]);

  const firstPaymentAmount = planDetails.paymentSchedule?.[0]?.amount;
  const submitButtonText = firstPaymentAmount 
    ? `Pay ${Money.fromDollars(firstPaymentAmount).toString()} and Create Plan`
    : 'Create Payment Plan';

  if (!stripe || !elements) {
    return (
      <Card className="shadow-none border-none">
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>
            Save your payment details to start the payment plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[38px] w-full rounded" />
            <Skeleton className="h-[38px] w-full rounded" />
            <Skeleton className="h-[38px] w-2/3 rounded" />
            <Button disabled className="w-full mt-4">
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Loading payment form...
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw submitError;

      if (!planDetails.clientSecret) {
        throw new Error('Client secret is not available');
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: planDetails.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/payment-confirmation?payment_intent=${planDetails.clientSecret.split('_secret_')[0]}`,
          payment_method_data: {
            billing_details: {
              // You can add billing details here if needed
            },
          },
        },
      });

      if (confirmError) throw confirmError;

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
        <CardDescription>
          Save your payment details to start the payment plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="min-h-[200px]">
              <PaymentElement 
                options={{
                  layout: {
                    type: 'tabs',
                    defaultCollapsed: false,
                  },
                  fields: {
                    billingDetails: {
                      address: {
                        country: 'auto'
                      }
                    }
                  },
                  wallets: {
                    applePay: 'auto',
                    googlePay: 'auto'
                  }
                }}
              />
            </div>
            {errorMessage && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Button 
              type="submit" 
              variant="default" 
              disabled={isProcessing || !stripe || !elements}
              className="w-full mt-4"
            >
              {isProcessing ? 'Processing...' : submitButtonText}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
