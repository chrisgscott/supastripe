"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PaymentPlan {
  id: string;
  customerName: string;
  totalAmount: number;
  remainingAmount: number;
  nextPaymentDate: string;
  status: string;
}

export default function PaymentPlansPage() {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);

  useEffect(() => {
    // TODO: Fetch payment plans from the API
    // For now, we'll use dummy data
    const dummyData: PaymentPlan[] = [
      {
        id: '1',
        customerName: 'John Doe',
        totalAmount: 1000,
        remainingAmount: 750,
        nextPaymentDate: '2023-07-01',
        status: 'Active',
      },
      // Add more dummy data as needed
    ];
    setPaymentPlans(dummyData);
  }, []);

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Payment Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Remaining Amount</TableHead>
                <TableHead>Next Payment Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.customerName}</TableCell>
                  <TableCell>${plan.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>${plan.remainingAmount.toFixed(2)}</TableCell>
                  <TableCell>{plan.nextPaymentDate}</TableCell>
                  <TableCell>{plan.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}