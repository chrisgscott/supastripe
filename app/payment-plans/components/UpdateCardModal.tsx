import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Stripe, StripeElements } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpdateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stripeCustomerId: string;
  paymentPlanId: string;
}

function UpdateCardForm({ stripeCustomerId, onClose, paymentPlanId }: { stripeCustomerId: string; onClose: () => void; paymentPlanId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    async function createSetupIntent() {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPlanId, isSetupIntent: true }),
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    }
    createSetupIntent();
  }, [paymentPlanId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (result.error) {
        setError(result.error.message || 'An unexpected error occurred.');
      } else {
        onClose();
      }
    } catch (error) {
      setError('An unexpected error occurred during card update.');
    }

    setIsLoading(false);
  };

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-4 flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!stripe || isLoading}>
          {isLoading ? "Updating..." : "Update Card"}
        </Button>
      </div>
    </form>
  );
}

export default function UpdateCardModal({ isOpen, onClose, stripeCustomerId, paymentPlanId }: UpdateCardModalProps & { paymentPlanId: string }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Card Details</DialogTitle>
        </DialogHeader>
        <Elements stripe={stripePromise}>
          <UpdateCardForm stripeCustomerId={stripeCustomerId} onClose={onClose} paymentPlanId={paymentPlanId} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}
