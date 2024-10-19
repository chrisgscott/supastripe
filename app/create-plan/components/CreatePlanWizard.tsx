import React, { useState, useEffect } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import PlanDetailsForm from './PlanDetailsForm';
import PaymentSchedule from './PaymentSchedule';
import StripePaymentForm from './StripePaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CreatePlanWizard() {
  const { currentStep, planDetails } = useCreatePlan();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    console.log('CreatePlanWizard: Component mounted');
    console.log('CreatePlanWizard: Initial currentStep:', currentStep);
    console.log('CreatePlanWizard: Initial clientSecret:', clientSecret);
    console.log('CreatePlanWizard: Initial planDetails:', planDetails);
  }, []);

  useEffect(() => {
    console.log('CreatePlanWizard: Effect triggered');
    console.log('CreatePlanWizard: currentStep:', currentStep);
    console.log('CreatePlanWizard: clientSecret:', clientSecret);
    console.log('CreatePlanWizard: planDetails.paymentPlanId:', planDetails.paymentPlanId);
    
    if (currentStep === 3 && !clientSecret && planDetails.paymentPlanId) {
      console.log('CreatePlanWizard: Calling createPaymentIntent');
      createPaymentIntent();
    }
  }, [currentStep, clientSecret, planDetails.paymentPlanId]);

  const createPaymentIntent = async () => {
    console.log('CreatePlanWizard: Creating payment intent');
    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPlanId: planDetails.paymentPlanId }),
      });
      const data = await response.json();
      console.log('CreatePlanWizard: Payment intent response:', data);
      if (data.error) {
        throw new Error(data.error);
      }
      setClientSecret(data.clientSecret);
      console.log('CreatePlanWizard: Client secret set');
    } catch (error) {
      console.error('CreatePlanWizard: Error creating payment intent:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Create Payment Plan</h2>
        <div className="flex justify-between">
          <span className={`${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Plan Details</span>
          <span className={`${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Payment Schedule</span>
          <span className={`${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Payment Details</span>
        </div>
        <div className="flex h-1 mt-2">
          <div className={`w-1/3 ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`w-1/3 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`w-1/3 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        </div>
      </div>
      {currentStep === 1 && <PlanDetailsForm />}
      {currentStep === 2 && <PaymentSchedule />}
      {currentStep === 3 && clientSecret && (
        <Elements stripe={stripePromise} options={{ 
          clientSecret,
          appearance: { theme: 'stripe', variables: { fontFamily: '"Outfit", sans-serif' } }
        }}>
          <StripePaymentForm />
        </Elements>
      )}
    </div>
  );
}
