import React, { useEffect, useState } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import PlanDetailsForm from './PlanDetailsForm';
import PaymentScheduleDisplay from './PaymentScheduleDisplay';
import StripePaymentForm from './StripePaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import ConfirmationStep from './ConfirmationStep';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CreatePlanWizard() {
  const { currentStep, planDetails, createPaymentIntent, handleStripeReturn } = useCreatePlan();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (currentStep === 2 && !planDetails.clientSecret && planDetails.paymentPlanId) {
      createPaymentIntent();
    }
  }, [currentStep, planDetails.clientSecret, planDetails.paymentPlanId, createPaymentIntent]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const step = urlParams.get('step');
    const paymentIntent = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');

    if (step === '3' && paymentIntent && paymentIntentClientSecret && redirectStatus === 'succeeded' && !isProcessingPayment) {
      setIsProcessingPayment(true);
      handleStripeReturn(paymentIntent).finally(() => setIsProcessingPayment(false));
    }
  }, [handleStripeReturn, isProcessingPayment]);

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold mb-4">Create Payment Plan</h2>
      <div className="flex justify-between mb-8">
        <span className={`${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Plan Details</span>
        <span className={`${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Payment Details</span>
        <span className={`${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Confirmation</span>
      </div>
      <div className="flex h-1 mb-8">
        <div className={`w-1/3 ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        <div className={`w-1/3 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        <div className={`w-1/3 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
      </div>
      <div className="flex space-x-8">
        <div className="w-2/3">
          {currentStep === 1 && <PlanDetailsForm />}
          {currentStep === 2 && (
            <Elements stripe={stripePromise} options={{ 
              clientSecret: planDetails.clientSecret,
              appearance: { theme: 'stripe', variables: { fontFamily: '"Outfit", sans-serif' } }
            }}>
              <StripePaymentForm />
            </Elements>
          )}
          {currentStep === 3 && planDetails.paymentPlanId && <ConfirmationStep planDetails={planDetails} />}
        </div>
        <div className="w-1/3">
          <PaymentScheduleDisplay />
        </div>
      </div>
    </div>
  );
}
