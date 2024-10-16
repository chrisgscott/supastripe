// app/payment-status/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentStatusInner from "./PaymentStatusInner";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PaymentStatus: React.FC = () => {
  const [status, setStatus] = useState<'success' | 'processing' | 'error' | null>(null);

  useEffect(() => {
    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );
    const redirectStatus = new URLSearchParams(window.location.search).get(
      "redirect_status"
    );

    if (redirectStatus === 'succeeded') {
      setStatus('success');
    } else if (clientSecret) {
      setStatus('processing');
    } else {
      setStatus('error');
    }
  }, []);

  if (!status) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {status === 'success' && <h1>Payment Successful!</h1>}
      {status === 'processing' && <Elements stripe={stripePromise} options={{ clientSecret: status }}>
        <PaymentStatusInner />
      </Elements>}
      {status === 'error' && <h1>Payment Failed. Please try again.</h1>}
    </div>
  );
};

export default PaymentStatus;
