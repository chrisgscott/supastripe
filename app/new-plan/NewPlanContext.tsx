"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { addWeeks, addMonths } from 'date-fns';
import { Money, formatCurrency } from '@/utils/currencyUtils';
import { useSearchParams } from 'next/navigation';
import { Database } from '@/types/supabase';

interface PlanDetails {
  id?: string;
  customerName: string;
  customerEmail: string;
  totalAmount: Money;
  numberOfPayments: number;
  paymentInterval: Database['public']['Enums']['payment_interval_type'];
  downpaymentAmount: Money;
  paymentSchedule: PaymentScheduleItem[];
  paymentPlanId?: string;
  stripeCustomerId?: string;
  clientSecret?: string;
  notes?: {
    content: string;
    delta: any;
    plaintext: string;
  };
  paymentMethod: 'collect_now' | 'send_link' | null;
}

interface PaymentScheduleItem {
  date: string;
  amount: Money;
  transaction_type: Database['public']['Enums']['transaction_type'];
}

interface NewPlanContextType {
  planDetails: PlanDetails;
  setPlanDetails: React.Dispatch<React.SetStateAction<PlanDetails>>;
  createPaymentIntent: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsStripeReady: (ready: boolean) => void;
  setCurrentStep: (step: number) => void;
  currentStep: number;
  loadProgress: number;
  calculatePaymentSchedule: () => PaymentScheduleItem[];
  isStripeReady: boolean;
  setPaymentMethod: (method: 'collect_now' | 'send_link') => void;
}

const NewPlanContext = createContext<NewPlanContextType | undefined>(undefined);

export const useNewPlan = () => {
  const context = useContext(NewPlanContext);
  if (!context) {
    throw new Error('useNewPlan must be used within a NewPlanProvider');
  }
  return context;
};

interface NewPlanProviderProps {
  children: ReactNode;
}

export const NewPlanProvider: React.FC<NewPlanProviderProps> = ({ children }) => {
  const searchParams = useSearchParams();  
  const [planDetails, setPlanDetails] = useState<PlanDetails>({
    customerName: '',
    customerEmail: '',
    totalAmount: Money.fromCents(0),
    numberOfPayments: 1,
    paymentInterval: 'monthly',
    downpaymentAmount: Money.fromCents(0),
    paymentSchedule: [],
    paymentMethod: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const createPaymentIntent = useCallback(async () => {
    console.log('Creating payment intent with details:', planDetails);
    setIsLoading(true);
    try {
      const firstPayment = planDetails.paymentSchedule?.[0];
      if (!firstPayment) {
        throw new Error('Payment schedule is not available');
      }
      const response = await fetch('/api/create-downpayment-intent-and-pending-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planDetails,
          amount: firstPayment.amount,
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }
      
      setPlanDetails(prev => ({ 
        ...prev, 
        clientSecret: data.clientSecret,
        paymentPlanId: data.paymentPlanId,
        stripeCustomerId: data.stripeCustomerId
      }));
    } catch (error) {
      console.error('Error creating payment intent:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [planDetails, setError, setPlanDetails]);

  const calculatePaymentSchedule = () => {
    const { totalAmount, numberOfPayments, paymentInterval, downpaymentAmount } = planDetails;
    
    const validDownpayment = Money.fromCents(Math.min(downpaymentAmount.toCents(), totalAmount.toCents()));
    const remainingAmount = totalAmount.subtract(validDownpayment);
    const regularPaymentAmount = remainingAmount.divide(numberOfPayments - (validDownpayment.toCents() > 0 ? 1 : 0));
    
    let schedule: PaymentScheduleItem[] = [];
    let currentDate = new Date();

    schedule.push({ 
      date: currentDate.toISOString(),
      amount: validDownpayment.toCents() > 0 ? validDownpayment : regularPaymentAmount,
      transaction_type: validDownpayment.toCents() > 0 ? 'downpayment' : 'installment'
    });

    let totalScheduled = validDownpayment.toCents() > 0 ? validDownpayment : regularPaymentAmount;

    for (let i = 1; i < numberOfPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let paymentAmount = regularPaymentAmount;

      if (i === numberOfPayments - 1) {
        paymentAmount = totalAmount.subtract(totalScheduled);
      }

      schedule.push({ 
        date: currentDate.toISOString(),
        amount: paymentAmount,
        transaction_type: 'installment'
      });

      totalScheduled = totalScheduled.add(paymentAmount);
    }

    return schedule;
  };

  const setPaymentMethod = (method: 'collect_now' | 'send_link') => {
    setPlanDetails(prev => ({
      ...prev,
      paymentMethod: method
    }));
  };

  return (
    <NewPlanContext.Provider value={{
      planDetails,
      setPlanDetails,
      createPaymentIntent,
      isLoading,
      error,
      setError,
      setIsStripeReady,
      setCurrentStep,
      currentStep,
      loadProgress: 0,
      calculatePaymentSchedule,
      isStripeReady,
      setPaymentMethod,
    }}>
      {children}
    </NewPlanContext.Provider>
  );
}
