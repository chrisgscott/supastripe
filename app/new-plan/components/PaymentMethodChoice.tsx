import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Mail } from "lucide-react";
import { useNewPlan } from "../NewPlanContext";

export default function PaymentMethodChoice() {
  const { setPlanDetails, setCurrentStep } = useNewPlan();

  const handleChoice = (method: 'collect_now' | 'send_link') => {
    setPlanDetails(prev => ({
      ...prev,
      paymentMethod: method
    }));
    setCurrentStep(method === 'collect_now' ? 3 : 4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Payment Method</CardTitle>
        <CardDescription>How would you like to collect the payment?</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button
          variant="outline"
          className="w-1/2 h-32 flex flex-col items-center justify-center gap-2"
          onClick={() => handleChoice('collect_now')}
        >
          <CreditCard className="h-6 w-6" />
          <span>Collect Payment Now</span>
          <span className="text-xs text-muted-foreground">
            Customer pays immediately
          </span>
        </Button>

        <Button
          variant="outline"
          className="w-1/2 h-32 flex flex-col items-center justify-center gap-2"
          onClick={() => handleChoice('send_link')}
        >
          <Mail className="h-6 w-6" />
          <span>Send Payment Link</span>
          <span className="text-xs text-muted-foreground">
            Email link to customer
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}