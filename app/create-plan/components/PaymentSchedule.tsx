import React, { useEffect } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { format, addMonths, addWeeks } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PaymentScheduleItem {
  date: Date;
  amount: number;
  is_downpayment: boolean;
}

export default function PaymentSchedule() {
  const { planDetails, setPlanDetails, setCurrentStep } = useCreatePlan();

  useEffect(() => {
    calculatePaymentSchedule();
  }, [planDetails.totalAmount, planDetails.numberOfPayments, planDetails.paymentInterval, planDetails.downpaymentAmount]);

  const calculatePaymentSchedule = () => {
    const { totalAmount, numberOfPayments, paymentInterval, downpaymentAmount } = planDetails;
    
    // Ensure downpayment is not greater than total amount
    const validDownpayment = Math.min(downpaymentAmount, totalAmount);
    
    const remainingAmount = totalAmount - validDownpayment;
    const regularPaymentAmount = Number((remainingAmount / (numberOfPayments - (validDownpayment > 0 ? 1 : 0))).toFixed(2));
    let schedule: PaymentScheduleItem[] = [];
    let currentDate = new Date();

    // Always add first payment (either downpayment or first installment)
    schedule.push({ 
      date: currentDate, 
      amount: validDownpayment > 0 ? validDownpayment : regularPaymentAmount,
      is_downpayment: validDownpayment > 0
    });

    for (let i = 1; i < numberOfPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let amount = regularPaymentAmount;

      if (i === numberOfPayments - 1) {
        const totalPaid = schedule.reduce((sum, payment) => sum + payment.amount, 0) + regularPaymentAmount;
        amount = Number((totalAmount - totalPaid + regularPaymentAmount).toFixed(2));
      }

      schedule.push({ date: currentDate, amount, is_downpayment: false });
    }

    setPlanDetails(prev => ({ ...prev, paymentSchedule: schedule, downpaymentAmount: validDownpayment }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting plan details:', planDetails);

      // Create Stripe customer
      const createCustomerResponse = await fetch('/api/create-stripe-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planDetails.customerName,
          email: planDetails.customerEmail,
        }),
      });
      const { stripeCustomerId } = await createCustomerResponse.json();

      // Create payment plan
      const response = await fetch('/api/create-payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planDetails,
          stripeCustomerId,
          paymentSchedule: planDetails.paymentSchedule.map((item, index) => ({
            ...item,
            is_downpayment: index === 0 && planDetails.downpaymentAmount > 0
          }))
        }),
      });
      const responseData = await response.json();
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      setPlanDetails(prev => ({ ...prev, paymentPlanId: responseData.paymentPlanId }));
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
        <CardDescription>Payments will be <i>automatically processed</i> on this schedule:</CardDescription>
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
            {planDetails.paymentSchedule?.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index === 0 ? "Due Now" : format(item.date, 'MM/dd/yyyy')}</TableCell>
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
