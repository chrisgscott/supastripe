import React, { useState, useEffect } from 'react';
import { useNewPlan } from '../NewPlanContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { format } from 'date-fns';
import { Money } from '@/utils/currencyUtils';

interface PaymentScheduleItem {
  date: string;
  amount: number;
  is_downpayment: boolean;
}

export default function PaymentSchedule() {
    const { planDetails, calculatePaymentSchedule } = useNewPlan();
    const [localSchedule, setLocalSchedule] = useState<PaymentScheduleItem[]>(planDetails.paymentSchedule || []);

    useEffect(() => {
        const schedule = calculatePaymentSchedule();
        setLocalSchedule(schedule);
    }, [planDetails.totalAmount, planDetails.numberOfPayments, planDetails.paymentInterval, planDetails.downpaymentAmount, calculatePaymentSchedule]);

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
                            <TableHead>Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {localSchedule.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    {index === 0 ? "Due Now" : format(new Date(item.date), 'MM/dd/yyyy')}
                                </TableCell>
                                <TableCell>{Money.fromDollars(item.amount).toString()}</TableCell>
                                <TableCell>{item.is_downpayment ? "Down Payment" : "Installment"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
