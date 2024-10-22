import React from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/utils/formatCurrency';

export default function PaymentScheduleDisplay() {
  const { planDetails } = useCreatePlan();

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
                <TableCell>{index === 0 ? "Due Now" : format(new Date(item.date), 'MM/dd/yyyy')}</TableCell>
                <TableCell>{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
