import React, { createContext, useContext, useState } from 'react';

interface PlanDetails {
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  numberOfPayments: number;
  paymentInterval: string;
  downpaymentAmount: number;
  paymentSchedule: Array<{ date: Date; amount: number }>;
  paymentPlanId?: string; // Add this line
  clientSecret?: string;
}

interface CreatePlanContextType {
  planDetails: PlanDetails;
  setPlanDetails: React.Dispatch<React.SetStateAction<PlanDetails>>;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
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

  return (
    <CreatePlanContext.Provider value={{ planDetails, setPlanDetails, currentStep, setCurrentStep }}>
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
