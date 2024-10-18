import React, { useEffect } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { format, addMonths, addWeeks } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PaymentScheduleItem {
  date: Date;
  amount: number;
}

export default function PaymentSchedule() {
  const { planDetails, setPlanDetails, setCurrentStep } = useCreatePlan();

  useEffect(() => {
    calculatePaymentSchedule();
  }, [planDetails.totalAmount, planDetails.numberOfPayments, planDetails.paymentInterval, planDetails.downpaymentAmount]);

  const calculatePaymentSchedule = () => {
    const { totalAmount, numberOfPayments, paymentInterval, downpaymentAmount } = planDetails;
    const remainingAmount = totalAmount - downpaymentAmount;
    const regularPaymentAmount = Number((remainingAmount / numberOfPayments).toFixed(2));
    let schedule: PaymentScheduleItem[] = [];
    let currentDate = new Date();

    if (downpaymentAmount > 0) {
      schedule.push({ date: currentDate, amount: downpaymentAmount });
    }

    for (let i = 0; i < numberOfPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let amount = regularPaymentAmount;

      if (i === numberOfPayments - 1) {
        const totalPaid = schedule.reduce((sum, payment) => sum + payment.amount, 0) + regularPaymentAmount;
        amount = Number((totalAmount - totalPaid + regularPaymentAmount).toFixed(2));
      }

      schedule.push({ date: currentDate, amount });
    }

    setPlanDetails(prev => ({ ...prev, paymentSchedule: schedule }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting plan details:', planDetails);
      const response = await fetch('/api/create-payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planDetails),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPlanDetails(prev => ({ ...prev, paymentPlanId: data.paymentPlanId }));
      setCurrentStep(3);
    } catch (error) {
      console.error('Error creating payment plan:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Schedule</CardTitle>
        <CardDescription>Review your payment schedule</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planDetails.paymentSchedule?.map((item: PaymentScheduleItem, index: number) => (
              <TableRow key={index}>
                <TableCell>{format(item.date, 'MM/dd/yyyy')}</TableCell>
                <TableCell>${item.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="secondary" onClick={() => setCurrentStep(1)}>Back</Button>
        <Button variant="default" onClick={handleSubmit}>Next</Button>
      </CardFooter>
    </Card>
  );
}
