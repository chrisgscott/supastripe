import React, { useState, ChangeEvent, useEffect } from 'react';
import { useNewPlan } from '../NewPlanContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReloadIcon } from "@radix-ui/react-icons";
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import './PlanDetailsForm.css';
import { Money } from '@/utils/currencyUtils';

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-muted animate-pulse rounded-md" />
});

interface FormErrors {
  [key: string]: string;
}

type PlanDetailsKeys = 'customerName' | 'customerEmail' | 'totalAmount' | 'numberOfPayments' | 'paymentInterval' | 'downpaymentAmount' | 'notes';

type QuillChangeHandler = (
  content: string,
  delta: any,
  source: string,
  editor: any
) => void;

export default function PlanDetailsForm() {
  const { planDetails, setPlanDetails, calculatePaymentSchedule, createPaymentIntent, setCurrentStep } = useNewPlan();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateField = (name: PlanDetailsKeys, value: string | number) => {
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
        const totalAmount = Money.fromDollars(Number(value));
        if (totalAmount.toCents() <= 0) {
          error = 'Total amount must be greater than 0';
        }
        break;
      case 'numberOfPayments':
        if (typeof value === 'number' && value < 1) {
          error = 'Number of payments must be at least 1';
        }
        break;
      case 'downpaymentAmount':
        const downpayment = Money.fromDollars(Number(value));
        if (downpayment.toCents() < 0) {
          error = 'Downpayment amount cannot be negative';
        }
        if (downpayment.toCents() >= planDetails.totalAmount.toCents()) {
          error = 'Downpayment amount must be less than total amount';
        }
        break;
    }
    return error;
  };

  const handleChange = (name: PlanDetailsKeys, value: string | number) => {
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));

    let processedValue: string | number | Money = value;

    if (name === 'totalAmount' || name === 'downpaymentAmount') {
      processedValue = Money.fromDollars(Number(value));
    } else if (name === 'numberOfPayments') {
      processedValue = value === '' ? 0 : Number(value);
    }

    setPlanDetails(prev => ({
      ...prev,
      [name]: processedValue
    }));

    if (['totalAmount', 'numberOfPayments', 'paymentInterval', 'downpaymentAmount'].includes(name)) {
      const newSchedule = calculatePaymentSchedule();
      setPlanDetails(prev => ({
        ...prev,
        paymentSchedule: newSchedule
      }));
    }
  };

  const isFormValid = () => {
    return Object.values(errors).every(error => !error) &&
           planDetails.customerName &&
           planDetails.customerEmail &&
           planDetails.totalAmount.toCents() > 0 &&
           planDetails.numberOfPayments > 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid()) {
      setIsLoading(true);
      try {
        const newSchedule = calculatePaymentSchedule();
        setPlanDetails(prev => ({
          ...prev,
          paymentSchedule: newSchedule
        }));

        const response = await fetch('/api/create-downpayment-intent-and-pending-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...planDetails,
            paymentSchedule: newSchedule
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setPlanDetails(prev => ({
          ...prev,
          paymentPlanId: data.paymentPlanId,
          clientSecret: data.clientSecret,
          stripeCustomerId: data.stripeCustomerId
        }));

        setCurrentStep(2);
      } catch (error) {
        console.error('Error saving payment plan:', error);
        setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleQuillChange: QuillChangeHandler = (content, delta, source, editor) => {
    const notes = {
      content: content,
      delta: editor.getContents(),
      plaintext: editor.getText()
    };
    
    console.log('Quill content changed:', {
      content,
      notes
    });
    
    setPlanDetails(prev => ({
      ...prev,
      notes: notes
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleNext} className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={planDetails.customerName}
                onChange={(e) => handleChange('customerName', e.target.value)}
                className={errors.customerName ? 'border-red-500' : ''}
              />
              {errors.customerName && <p className="text-red-500 text-sm">{errors.customerName}</p>}
            </div>

            <div className="col-span-3 space-y-2">
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={planDetails.customerEmail}
                onChange={(e) => handleChange('customerEmail', e.target.value)}
                className={errors.customerEmail ? 'border-red-500' : ''}
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
                min="0"
                value={planDetails.totalAmount.toDollars()}
                onChange={(e) => handleChange('totalAmount', e.target.value)}
                className={errors.totalAmount ? 'border-red-500' : ''}
                required
              />
              {errors.totalAmount && <p className="text-red-500 text-sm">{errors.totalAmount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="downpaymentAmount">Down Payment Amount</Label>
              <Input
                id="downpaymentAmount"
                type="number"
                step="0.01"
                min="0"
                value={planDetails.downpaymentAmount.toDollars()}
                onChange={(e) => handleChange('downpaymentAmount', e.target.value)}
                className={errors.downpaymentAmount ? 'border-red-500' : ''}
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
                onChange={(e) => handleChange('numberOfPayments', e.target.value)}
                className={errors.numberOfPayments ? 'border-red-500' : ''}
              />
              {errors.numberOfPayments && <p className="text-red-500 text-sm">{errors.numberOfPayments}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentInterval">Payment Interval</Label>
              <Select
                value={planDetails.paymentInterval}
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <div className="min-h-[200px]">
              <ReactQuill
                theme="snow"
                value={planDetails.notes?.content || ''}
                onChange={handleQuillChange}
                className={errors.notes ? 'border-red-500' : ''}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                  ],
                }}
                placeholder="Add any notes about this payment plan..."
              />
            </div>
            {errors.notes && <p className="text-red-500 text-sm">{errors.notes}</p>}
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <Button 
              type="submit" 
              disabled={!isFormValid() || isLoading}
            >
              {isLoading ? (
                <>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Creating payment...
                </>
              ) : (
                'Next'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
