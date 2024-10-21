import React, { useEffect, useCallback } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { format, addMonths, addWeeks } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/utils/formatCurrency';

interface PaymentScheduleItem {
  date: Date;
  amount: number;
  is_downpayment: boolean;
}

export default function PaymentSchedule() {
  const { planDetails, setPlanDetails, setCurrentStep, createPaymentPlan } = useCreatePlan();

  const calculatePaymentSchedule = useCallback(() => {
    const { totalAmount, numberOfPayments, paymentInterval, downpaymentAmount } = planDetails;
    
    // Convert amounts to cents
    const totalAmountCents = Math.round(totalAmount * 100);
    const downpaymentAmountCents = Math.round(downpaymentAmount * 100);
    
    // Ensure downpayment is not greater than total amount
    const validDownpaymentCents = Math.min(downpaymentAmountCents, totalAmountCents);
    
    const remainingAmountCents = totalAmountCents - validDownpaymentCents;
    const regularPaymentAmountCents = Math.round(remainingAmountCents / (numberOfPayments - (validDownpaymentCents > 0 ? 1 : 0)));
    let schedule: PaymentScheduleItem[] = [];
    let currentDate = new Date();

    // Always add first payment (either downpayment or first installment)
    schedule.push({ 
      date: currentDate, 
      amount: validDownpaymentCents > 0 ? validDownpaymentCents : regularPaymentAmountCents,
      is_downpayment: validDownpaymentCents > 0
    });

    for (let i = 1; i < numberOfPayments; i++) {
      currentDate = paymentInterval === "weekly" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
      let amountCents = regularPaymentAmountCents;

      if (i === numberOfPayments - 1) {
        const totalPaidCents = schedule.reduce((sum, payment) => sum + payment.amount, 0) + regularPaymentAmountCents;
        amountCents = totalAmountCents - totalPaidCents + regularPaymentAmountCents;
      }

      schedule.push({ date: currentDate, amount: amountCents, is_downpayment: false });
    }

    return schedule;
  }, [planDetails]);

  useEffect(() => {
    const schedule = calculatePaymentSchedule();
    const stringSchedule = schedule.map(item => ({
      ...item,
      date: item.date.toISOString()
    }));
    setPlanDetails(prev => ({ ...prev, paymentSchedule: stringSchedule }));
  }, [planDetails.totalAmount, planDetails.numberOfPayments, planDetails.paymentInterval, planDetails.downpaymentAmount, calculatePaymentSchedule, setPlanDetails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPaymentPlan();
      setCurrentStep(3);
    } catch (error) {
      // Handle error
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
                <TableCell>{formatCurrency(item.amount)}</TableCell>
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
