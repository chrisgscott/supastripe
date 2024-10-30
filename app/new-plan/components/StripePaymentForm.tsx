"use client"

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
import { useRouter } from "next/navigation";

interface StripePaymentFormProps {
  amount?: number;
}

export default function StripePaymentForm({ amount }: StripePaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();
  const { planDetails, setError, createPaymentIntent, setIsStripeReady } = useNewPlan();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (!planDetails.clientSecret) {
        throw new Error('Client secret is not available');
      }

      const { error: submitError } = await elements!.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error: confirmError, paymentIntent } = await stripe!.confirmPayment({
        elements: elements!,
        clientSecret: planDetails.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/plan/${planDetails.paymentPlanId}`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent) {
        setIsRedirecting(true);
        
        // Poll for plan creation
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount < maxRetries) {
          const response = await fetch(
            `/api/handle-payment-confirmation?payment_intent=${paymentIntent.id}`
          );
          const data = await response.json();
          
          if (data.success && data.planDetails?.paymentPlanId) {
            router.push(`/plan/${data.planDetails.paymentPlanId}`);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        }
        
        throw new Error('Timeout waiting for plan creation');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      setIsRedirecting(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isRedirecting) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center space-y-4">
            <ReloadIcon className="h-8 w-8 animate-spin" />
            <div className="text-center">
              <h3 className="font-semibold">Processing Payment</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we finalize your payment plan...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

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
