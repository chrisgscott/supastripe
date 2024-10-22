import React, { createContext, useContext, useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { addWeeks, addMonths } from 'date-fns';

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
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  saveProgress: () => Promise<void>;
  loadProgress: () => Promise<void>;
  createPaymentPlanAndIntent: () => Promise<void>;
  handleStripeReturn: (paymentIntentId: string) => Promise<void>;
  calculatePaymentSchedule: (details: PlanDetails) => Array<{ date: string; amount: number }>;
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveProgress = async () => {
    localStorage.setItem('planProgress', JSON.stringify({ planDetails, currentStep }));
  };

  const loadProgress = async () => {
    const progress = localStorage.getItem('planProgress');
    if (progress) {
      const { planDetails: savedDetails, currentStep: savedStep } = JSON.parse(progress);
      setPlanDetails(savedDetails);
      setCurrentStep(savedStep);
    }
  };

  const createPaymentPlanAndIntent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/create-payment-plan-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planDetails),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'An error occurred while creating the payment plan');
      }
      setPlanDetails(prev => ({
        ...prev,
        paymentPlanId: responseData.paymentPlanId,
        stripeCustomerId: responseData.stripeCustomerId,
        firstTransactionId: responseData.firstTransactionId,
        clientSecret: responseData.clientSecret
      }));
      setCurrentStep(3);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeReturn = useCallback(async (paymentIntentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/handle-stripe-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment confirmation failed');
      }
      setPlanDetails(prevDetails => ({
        ...prevDetails,
        ...data.planDetails
      }));
      setCurrentStep(4);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculatePaymentSchedule = useCallback((details: PlanDetails) => {
    const { totalAmount, numberOfPayments, paymentInterval, downpaymentAmount } = details;
    
    // Convert amounts to cents
    const totalAmountCents = Math.round(totalAmount * 100);
    const downpaymentAmountCents = Math.round(downpaymentAmount * 100) || 0; // Use 0 if no downpayment
    
    // Ensure downpayment is not greater than total amount
    const validDownpaymentCents = Math.min(downpaymentAmountCents, totalAmountCents);
    
    const remainingAmountCents = totalAmountCents - validDownpaymentCents;
    const regularPaymentAmountCents = Math.round(remainingAmountCents / numberOfPayments);
    let schedule: Array<{ date: string; amount: number }> = [];
    let currentDate = new Date();

    // Add downpayment if it exists, otherwise add first regular payment
    schedule.push({ 
      date: currentDate.toISOString(), 
      amount: validDownpaymentCents > 0 ? validDownpaymentCents : regularPaymentAmountCents,
    });

    // Adjust the number of remaining payments
    const remainingPayments = validDownpaymentCents > 0 ? numberOfPayments - 1 : numberOfPayments - 1;

    for (let i = 0; i < remainingPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let amountCents = regularPaymentAmountCents;

      if (i === remainingPayments - 1) {
        const totalPaidCents = schedule.reduce((sum, payment) => sum + payment.amount, 0) + regularPaymentAmountCents;
        amountCents = totalAmountCents - totalPaidCents + regularPaymentAmountCents;
      }

      schedule.push({ date: currentDate.toISOString(), amount: amountCents });
    }

    return schedule;
  }, []);

  const value = {
    planDetails,
    setPlanDetails,
    currentStep,
    setCurrentStep,
    error,
    setError,
    isLoading,
    setIsLoading,
    saveProgress,
    loadProgress,
    createPaymentPlanAndIntent,
    handleStripeReturn,
    calculatePaymentSchedule,
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
