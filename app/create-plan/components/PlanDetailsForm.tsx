import React from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PlanDetailsForm() {
  const { planDetails, setPlanDetails, setCurrentStep } = useCreatePlan();

  const handleChange = (name: string, value: string | number) => {
    setPlanDetails(prev => ({
      ...prev,
      [name]: ['totalAmount', 'downpaymentAmount', 'numberOfPayments'].includes(name)
        ? Number(value) || 0
        : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Details</CardTitle>
        <CardDescription>Enter the details for your payment plan</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={planDetails.customerName || ''}
              onChange={(e) => handleChange('customerName', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Customer Email</Label>
            <Input
              id="customerEmail"
              type="email"
              value={planDetails.customerEmail || ''}
              onChange={(e) => handleChange('customerEmail', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalAmount">Total Amount</Label>
            <Input
              id="totalAmount"
              type="number"
              value={planDetails.totalAmount || ''}
              onChange={(e) => handleChange('totalAmount', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numberOfPayments">Number of Payments</Label>
            <Input
              id="numberOfPayments"
              type="number"
              value={planDetails.numberOfPayments || ''}
              onChange={(e) => handleChange('numberOfPayments', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentInterval">Payment Interval</Label>
            <Select
              value={planDetails.paymentInterval || 'monthly'}
              onValueChange={(value) => handleChange('paymentInterval', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="downpaymentAmount">Downpayment Amount</Label>
            <Input
              id="downpaymentAmount"
              type="number"
              value={planDetails.downpaymentAmount || ''}
              onChange={(e) => handleChange('downpaymentAmount', e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Next</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
