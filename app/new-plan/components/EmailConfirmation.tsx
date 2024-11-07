import { useState } from "react";
import { useNewPlan } from "../NewPlanContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReloadIcon, CheckCircledIcon } from "@radix-ui/react-icons";

export default function EmailConfirmation() {
  const { planDetails, setError } = useNewPlan();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSendEmail = async () => {
    if (!planDetails.paymentPlanId) {
      setError('Payment plan ID is missing');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPlanId: planDetails.paymentPlanId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setIsSent(true);
    } catch (error) {
      console.error('Error sending payment link:', error);
      setError(error instanceof Error ? error.message : 'Failed to send payment link');
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center space-y-4">
            <CheckCircledIcon className="h-8 w-8 text-green-500" />
            <div className="text-center">
              <h3 className="font-semibold">Email Sent Successfully</h3>
              <p className="text-sm text-muted-foreground">
                The payment link has been sent to {planDetails.customerEmail}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                You can now close this window or create another payment plan
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Payment Link</CardTitle>
        <CardDescription>
          Send the payment link to {planDetails.customerEmail}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>An email will be sent to your customer with:</p>
            <ul className="list-disc list-inside mt-2">
              <li>Payment plan details</li>
              <li>Secure payment link</li>
              <li>Your business contact information</li>
            </ul>
          </div>
          <Button
            onClick={handleSendEmail}
            disabled={isSending}
            className="w-full"
          >
            {isSending ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                Sending Email...
              </>
            ) : (
              'Send Payment Link'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}