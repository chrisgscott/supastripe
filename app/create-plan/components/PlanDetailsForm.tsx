import React, { useState, useEffect } from 'react';
import { useCreatePlan } from '../CreatePlanContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormErrors {
  customerName?: string;
  customerEmail?: string;
  totalAmount?: string;
  numberOfPayments?: string;
  downpaymentAmount?: string;
}

export default function PlanDetailsForm() {
  const { planDetails, setPlanDetails, setCurrentStep, calculatePaymentSchedule, createPaymentPlanAndIntent } = useCreatePlan();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (name: string, value: string | number) => {
    let error = '';
    switch (name) {
      case 'customerName':
        if (typeof value === 'string' && value.trim().length < 2) {
          error = 'Name must be at least 2 characters long';
        }
        break;
      case 'customerEmail':
        if (typeof value === 'string' && !/\S+@\S+\.\S+/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
      case 'totalAmount':
        if (typeof value === 'number' && value <= 0) {
          error = 'Total amount must be greater than 0';
        }
        break;
      case 'numberOfPayments':
        if (typeof value === 'number' && value < 1) {
          error = 'Number of payments must be at least 1';
        }
        break;
      case 'downpaymentAmount':
        if (typeof value === 'number' && value < 0) {
          error = 'Downpayment amount cannot be negative';
        }
        if (typeof value === 'number' && value >= planDetails.totalAmount) {
          error = 'Downpayment amount must be less than total amount';
        }
        break;
    }
    return error;
  };

  const handleChange = (name: string, value: string | number) => {
    const updatedPlanDetails = {
      ...planDetails,
      [name]: value === '' ? 0 : value
    };
    setPlanDetails(updatedPlanDetails);
    
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));

    if (['totalAmount', 'numberOfPayments', 'paymentInterval', 'downpaymentAmount'].includes(name)) {
      const newSchedule = calculatePaymentSchedule(updatedPlanDetails);
      setPlanDetails(prev => ({ ...prev, paymentSchedule: newSchedule }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(errors).every(error => !error)) {
      setIsLoading(true);
      try {
        await createPaymentPlanAndIntent();
        setCurrentStep(2);
      } catch (error) {
        console.error('Error creating payment plan:', error);
        // Handle error (e.g., show error message to user)
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isFormValid = () => {
    return Object.values(errors).every(error => !error) &&
           planDetails.customerName &&
           planDetails.customerEmail &&
           planDetails.totalAmount > 0 &&
           planDetails.numberOfPayments > 0;
  };

  useEffect(() => {
    // Validate all fields on component mount
    const newErrors: FormErrors = {};
    Object.entries(planDetails).forEach(([key, value]) => {
      if (key in errors) {
        newErrors[key as keyof FormErrors] = validateField(key, value);
      }
    });
    setErrors(newErrors);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Details</CardTitle>
        <CardDescription>Enter the details for your payment plan</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={planDetails.customerName || ''}
                onChange={(e) => handleChange('customerName', e.target.value)}
                required
              />
              {errors.customerName && <p className="text-red-500 text-sm">{errors.customerName}</p>}
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
              {errors.customerEmail && <p className="text-red-500 text-sm">{errors.customerEmail}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={planDetails.totalAmount || ''}
                onChange={(e) => handleChange('totalAmount', parseFloat(e.target.value))}
                required
              />
              {errors.totalAmount && <p className="text-red-500 text-sm">{errors.totalAmount}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="downpaymentAmount">Downpayment Amount</Label>
              <Input
                id="downpaymentAmount"
                type="number"
                step="0.01"
                value={planDetails.downpaymentAmount || ''}
                onChange={(e) => handleChange('downpaymentAmount', parseFloat(e.target.value))}
              />
              {errors.downpaymentAmount && <p className="text-red-500 text-sm">{errors.downpaymentAmount}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfPayments">Number of Payments</Label>
              <Input
                id="numberOfPayments"
                type="number"
                value={planDetails.numberOfPayments || ''}
                onChange={(e) => handleChange('numberOfPayments', parseInt(e.target.value, 10))}
                required
              />
              {errors.numberOfPayments && <p className="text-red-500 text-sm">{errors.numberOfPayments}</p>}
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
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isFormValid() || isLoading}>
            {isLoading ? 'Processing...' : 'Next'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
