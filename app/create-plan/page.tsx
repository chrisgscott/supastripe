// app/create-plan/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { format, addMonths, addWeeks } from 'date-fns';
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface PaymentSchedule {
  date: Date;
  amount: number;
}

const PaymentPlanFormInner: React.FC<{ 
  setAmount: (amount: number) => void;
  totalAmount: number;
  setTotalAmount: (amount: number) => void;
  onPlanCreated: (id: string) => void;
  setCurrentStep: (step: number) => void;
}> = ({ setAmount, totalAmount, setTotalAmount, onPlanCreated, setCurrentStep }) => {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [numberOfPayments, setNumberOfPayments] = useState(1);
  const [paymentInterval, setPaymentInterval] = useState("monthly");
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    calculatePaymentSchedule();
  }, [totalAmount, numberOfPayments, paymentInterval, downpaymentAmount]);

  const calculatePaymentSchedule = () => {
    const remainingAmount = totalAmount - downpaymentAmount;
    const regularPaymentAmount = Number((remainingAmount / numberOfPayments).toFixed(2));
    let schedule: PaymentSchedule[] = [];
    let currentDate = new Date();

    if (downpaymentAmount > 0) {
      schedule.push({ date: currentDate, amount: downpaymentAmount });
    }

    for (let i = 0; i < numberOfPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let amount = regularPaymentAmount;

      // Adjust the last payment to account for rounding
      if (i === numberOfPayments - 1) {
        const totalPaid = schedule.reduce((sum, payment) => sum + payment.amount, 0) + regularPaymentAmount;
        amount = Number((totalAmount - totalPaid + regularPaymentAmount).toFixed(2));
      }

      schedule.push({ date: currentDate, amount });
    }

    setPaymentSchedule(schedule);
  };

  const handleTotalAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (totalAmount === 0) {
      setTotalAmount(NaN); // This will clear the input
    }
  };

  const handleTotalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setTotalAmount(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/create-payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          totalAmount,
          numberOfPayments,
          paymentInterval,
          downpaymentAmount,
          paymentSchedule
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onPlanCreated(data.paymentPlanId);
        setCurrentStep(2);
      }
    } catch (error) {
      setError("An error occurred while creating the payment plan. Please try again.");
      console.error("Error submitting form:", error);
    }
    
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="mb-4">
        <label htmlFor="totalAmount" className="block mb-2">Total Amount</label>
        <input
          type="number"
          id="totalAmount"
          value={isNaN(totalAmount) ? '' : totalAmount}
          onChange={handleTotalAmountChange}
          onFocus={handleTotalAmountFocus}
          className="w-full p-2 border rounded"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="customerName" className="block mb-2">Customer Name</label>
        <input
          type="text"
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="customerEmail" className="block mb-2">Customer Email</label>
        <input
          type="email"
          id="customerEmail"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="numberOfPayments" className="block mb-2">Number of Payments</label>
        <input
          type="number"
          id="numberOfPayments"
          value={numberOfPayments}
          onChange={(e) => setNumberOfPayments(Number(e.target.value))}
          className="w-full p-2 border rounded"
          min="1"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="paymentInterval" className="block mb-2">Payment Interval</label>
        <select
          id="paymentInterval"
          value={paymentInterval}
          onChange={(e) => setPaymentInterval(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="downpaymentAmount" className="block mb-2">Downpayment Amount</label>
        <input
          type="number"
          id="downpaymentAmount"
          value={downpaymentAmount}
          onChange={(e) => setDownpaymentAmount(Number(e.target.value))}
          className="w-full p-2 border rounded"
          min="0"
          step="0.01"
        />
      </div>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <button 
        type="submit" 
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={isLoading}
      >
        {isLoading ? "Creating Plan..." : "Create Plan and Continue to Payment"}
      </button>
    </form>
  );
};

const PaymentFormInner: React.FC<{ paymentPlanId: string | null }> = ({ paymentPlanId }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (paymentPlanId) {
      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPlanId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setClientSecret(data.clientSecret);
          }
        })
        .catch((err) => {
          setError("Failed to create payment intent");
          console.error(err);
        });
    }
  }, [paymentPlanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!stripe || !elements || !clientSecret) {
      setError("Payment cannot be processed at this time.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-status`,
        },
      });

      if (result.error) {
        setError(result.error.message || 'An unknown error occurred');
      }
    } catch (error) {
      setError("An error occurred while processing the payment. Please try again.");
      console.error("Error processing payment:", error);
    }
    
    setIsLoading(false);
  };

  if (!clientSecret) {
    return <div>Loading payment form...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <button 
        type="submit" 
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={isLoading || !stripe || !elements}
      >
        {isLoading ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
};

const PaymentPlanForm: React.FC<{ setAmount: (amount: number) => void }> = ({ setAmount }) => {
  const [totalAmount, setTotalAmount] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentPlanId, setPaymentPlanId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

  const handleTotalAmountChange = (newAmount: number) => {
    setTotalAmount(newAmount);
    setAmount(newAmount);
  };

  useEffect(() => {
    if (paymentPlanId) {
      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPlanId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error(data.error);
          } else {
            setClientSecret(data.clientSecret);
          }
        })
        .catch((err) => {
          console.error("Failed to create payment intent", err);
        });
    }
  }, [paymentPlanId]);

  return (
    <div>
      <div className="flex mb-4">
        <button
          className={`flex-1 py-2 ${currentStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setCurrentStep(1)}
        >
          Create Plan
        </button>
        <button
          className={`flex-1 py-2 ${currentStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setCurrentStep(2)}
          disabled={!paymentPlanId}
        >
          Payment
        </button>
      </div>
      {currentStep === 1 ? (
        <PaymentPlanFormInner 
          setAmount={setAmount} 
          totalAmount={totalAmount} 
          setTotalAmount={handleTotalAmountChange}
          onPlanCreated={setPaymentPlanId}
          setCurrentStep={setCurrentStep}
        />
      ) : (
        clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentFormInner paymentPlanId={paymentPlanId} />
          </Elements>
        ) : (
          <div>Loading payment form...</div>
        )
      )}
    </div>
  );
};

const CreatePlanPage: React.FC = () => {
  const [amount, setAmount] = useState<number>(0);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Payment Plan</h1>
      <PaymentPlanForm setAmount={setAmount} />
    </div>
  );
};

export default CreatePlanPage;