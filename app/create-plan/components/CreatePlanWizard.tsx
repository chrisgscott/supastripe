import React, { useEffect } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import PlanDetailsForm from './PlanDetailsForm';
import PaymentSchedule from './PaymentSchedule';
import StripePaymentForm from './StripePaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import ConfirmationStep from './ConfirmationStep';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CreatePlanWizard() {
  const { currentStep, planDetails, createPaymentIntent, handleStripeReturn } = useCreatePlan();

  useEffect(() => {
    if (currentStep === 3 && !planDetails.clientSecret && planDetails.paymentPlanId) {
      createPaymentIntent();
    }
  }, [currentStep, planDetails.clientSecret, planDetails.paymentPlanId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const step = urlParams.get('step');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');

    if (step === '4' && paymentIntentClientSecret) {
      const paymentIntentId = paymentIntentClientSecret.split('_secret_')[0];
      handleStripeReturn(paymentIntentId);
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Create Payment Plan</h2>
        <div className="flex justify-between">
          <span className={`${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Plan Details</span>
          <span className={`${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Payment Schedule</span>
          <span className={`${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Payment Details</span>
          <span className={`${currentStep >= 4 ? 'text-blue-600' : 'text-gray-400'}`}>4. Confirmation</span>
        </div>
        <div className="flex h-1 mt-2">
          <div className={`w-1/4 ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`w-1/4 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`w-1/4 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`w-1/4 ${currentStep >= 4 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        </div>
      </div>
      {currentStep === 1 && <PlanDetailsForm />}
      {currentStep === 2 && <PaymentSchedule />}
      {currentStep === 3 && planDetails.clientSecret && (
        <Elements stripe={stripePromise} options={{ 
          clientSecret: planDetails.clientSecret,
          appearance: { theme: 'stripe', variables: { fontFamily: '"Outfit", sans-serif' } }
        }}>
          <StripePaymentForm />
        </Elements>
      )}
      {currentStep === 4 && <ConfirmationStep planDetails={planDetails} />}
    </div>
  );
}
