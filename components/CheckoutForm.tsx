// components/CheckoutForm.tsx
"use client";

import React, { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

interface CheckoutFormProps {
  paymentPlanId: string;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ paymentPlanId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-confirmation/${paymentPlanId}`,
      },
    });

    if (error) {
      setErrorMessage(error.message || "An error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button 
        type="submit" 
        disabled={!stripe || isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
      >
        {isLoading ? "Processing..." : "Pay now"}
      </button>
      {errorMessage && <div className="text-red-500 mt-4">{errorMessage}</div>}
    </form>
  );
};

export default CheckoutForm;
