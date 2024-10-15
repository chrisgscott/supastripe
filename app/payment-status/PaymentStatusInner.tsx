import React, { useState, useEffect } from "react";
import { useStripe } from "@stripe/react-stripe-js";

const PaymentStatusInner: React.FC = () => {
  const stripe = useStripe();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe) return;

    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );

    if (!clientSecret) {
      setMessage("No payment intent found.");
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!paymentIntent) {
        setMessage("Payment intent not found.");
        return;
      }

      switch (paymentIntent.status) {
        case "succeeded":
          setMessage("Success! Payment received.");
          break;
        case "processing":
          setMessage("Payment processing. We'll update you when it's complete.");
          break;
        case "requires_payment_method":
          setMessage("Payment failed. Please try another payment method.");
          break;
        default:
          setMessage("Something went wrong.");
      }
    });
  }, [stripe]);

  return <div>{message}</div>;
};

export default PaymentStatusInner;