import React, { useEffect, useMemo } from 'react';
import { useNewPlan } from '../NewPlanContext';
import PlanDetailsForm from './PlanDetailsForm';
import PaymentSchedule from './PaymentSchedule';
import StripePaymentForm from './StripePaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { getStripe } from '@/app/utils/stripe';
import { Money } from '@/utils/currencyUtils';

export default function NewPlanWizard() {
  const { 
    currentStep,
    planDetails, 
    error,
    isLoading,
    setError,
    setIsStripeReady
  } = useNewPlan();

  const stripePromise = useMemo(() => getStripe(), []);

  const options = useMemo(() => ({
    mode: 'payment' as const,
    amount: Money.fromDollars(planDetails.paymentSchedule?.[0]?.amount || 0).toCents(),
    currency: 'usd',
    setup_future_usage: 'off_session' as const,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0F172A',
      },
    },
    loader: 'auto' as const,
  }), [planDetails.paymentSchedule]);

  useEffect(() => {
    if (currentStep === 2) {
      console.log('NewPlanWizard: Starting Stripe initialization');
      const loadStripeElements = async () => {
        try {
          console.log('NewPlanWizard: Awaiting stripePromise');
          const stripe = await stripePromise;
          console.log('NewPlanWizard: Stripe loaded:', !!stripe);
          if (stripe) {
            // Add a small delay to ensure Elements is ready
            setTimeout(() => {
              console.log('NewPlanWizard: Setting isStripeReady to true');
              setIsStripeReady(true);
            }, 100);
          }
        } catch (error) {
          console.error('NewPlanWizard: Error loading Stripe:', error);
          setError('Failed to load payment form. Please try again.');
        }
      };
      loadStripeElements();
    }
  }, [currentStep, stripePromise, setIsStripeReady, setError]);

  return (
    <div className="container mx-auto py-8 px-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="w-[100px] h-[20px] rounded-full" />
            <Skeleton className="w-[80px] h-[20px] rounded-full mt-4" />
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          <div className="flex-grow">
            {currentStep === 1 && <PlanDetailsForm />}
            {currentStep === 2 && (
              <Elements stripe={stripePromise} options={options}>
                <StripePaymentForm amount={Money.fromDollars(planDetails.downpaymentAmount).toCents()} />
              </Elements>
            )}
          </div>
          <div className="w-1/3">
            <PaymentSchedule />
          </div>
        </div>
      )}
    </div>
  );
}
