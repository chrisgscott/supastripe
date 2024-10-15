// app/payment-status/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentStatusInner from "./PaymentStatusInner";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PaymentStatus: React.FC = () => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const secret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );
    setClientSecret(secret);
  }, []);

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentStatusInner />
    </Elements>
  );
};

export default PaymentStatus;
