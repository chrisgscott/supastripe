import React, { createContext, useContext, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

interface PlanDetails {
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  numberOfPayments: number;
  paymentInterval: string;
  downpaymentAmount: number;
  paymentSchedule: Array<{ date: string; amount: number }>;
  paymentPlanId?: string;
  stripeCustomerId?: string;
  clientSecret?: string;
  firstTransactionId?: string;
}

interface CreatePlanContextType {
  planDetails: PlanDetails;
  setPlanDetails: React.Dispatch<React.SetStateAction<PlanDetails>>;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  createPaymentPlan: () => Promise<void>;
  createPaymentIntent: () => Promise<void>;
  handleStripeReturn: (paymentIntentId: string) => Promise<void>;
}

const CreatePlanContext = createContext<CreatePlanContextType | undefined>(undefined);

export function CreatePlanProvider({ children }: { children: React.ReactNode }) {
  const [planDetails, setPlanDetails] = useState<PlanDetails>({
    customerName: '',
    customerEmail: '',
    totalAmount: 0,
    numberOfPayments: 1,
    paymentInterval: 'monthly',
    downpaymentAmount: 0,
    paymentSchedule: [],
  });
  const [currentStep, setCurrentStep] = useState(1);

  const createPaymentPlan = async () => {
    try {
      const response = await fetch('/api/create-payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planDetails),
      });
      const responseData = await response.json();
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      setPlanDetails(prev => ({
        ...prev,
        paymentPlanId: responseData.paymentPlanId,
        stripeCustomerId: responseData.stripeCustomerId,
        firstTransactionId: responseData.firstTransactionId
      }));
    } catch (error) {
      console.error('Error creating payment plan:', error);
      throw error;
    }
  };

  const createPaymentIntent = async () => {
    try {
      if (!planDetails.firstTransactionId) {
        throw new Error('First transaction ID is missing');
      }
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPlanId: planDetails.paymentPlanId,
          amount: planDetails.paymentSchedule[0].amount,
          firstTransactionId: planDetails.firstTransactionId,
          isSetupIntent: false
        }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPlanDetails(prev => ({ ...prev, clientSecret: data.clientSecret }));
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  };

  const handleStripeReturn = async (paymentIntentId: string) => {
    try {
      const response = await fetch('/api/handle-stripe-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      });

      if (response.ok) {
        const data = await response.json();
        setPlanDetails(prevDetails => ({
          ...prevDetails,
          ...data.planDetails
        }));
        setCurrentStep(4);
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (error) {
      console.error('Error handling Stripe return:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  const value = {
    planDetails,
    setPlanDetails,
    currentStep,
    setCurrentStep,
    createPaymentPlan,
    createPaymentIntent,
    handleStripeReturn,
  };

  return (
    <CreatePlanContext.Provider value={value}>
      {children}
    </CreatePlanContext.Provider>
  );
}

export const useCreatePlan = () => {
  const context = useContext(CreatePlanContext);
  if (context === undefined) {
    throw new Error('useCreatePlan must be used within a CreatePlanProvider');
  }
  return context;
};
