import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Stripe, StripeElements } from '@stripe/stripe-js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

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
  const [zipCode, setZipCode] = useState('');

  useEffect(() => {
    async function createSetupIntent() {
      const response = await fetch('/api/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeCustomerId }),
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    }
    createSetupIntent();
  }, [stripeCustomerId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardNumberElement)!,
          billing_details: {
            address: {
              postal_code: zipCode,
            },
          },
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
    <Card>
      <CardHeader>
        <CardTitle>Update Card Details</CardTitle>
        <CardDescription>Update your payment method for this payment plan</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700">Card Number</label>
              <CardNumberElement id="cardNumber" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="cardExpiry" className="block text-sm font-medium text-gray-700">Expiration Date</label>
                <CardExpiryElement id="cardExpiry" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
              </div>
              <div className="flex-1">
                <label htmlFor="cardCvc" className="block text-sm font-medium text-gray-700">CVC</label>
                <CardCvcElement id="cardCvc" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
              </div>
            </div>
            <div>
              <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">Zip Code</label>
              <input
                type="text"
                id="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                placeholder="Enter zip code"
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="button" variant="outline" onClick={onClose} className="mr-2">Cancel</Button>
        <Button type="submit" onClick={handleSubmit} disabled={!stripe || isLoading}>
          {isLoading ? "Updating..." : "Update Card"}
        </Button>
      </CardFooter>
    </Card>
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
