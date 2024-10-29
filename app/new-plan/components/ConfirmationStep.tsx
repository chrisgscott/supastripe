import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, Money } from '@/utils/currencyUtils';
import { Mail, Printer, FileText, Plus, LayoutDashboard } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ConfirmationStepProps {
  planDetails?: {
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    numberOfPayments: number;
    paymentInterval: string;
    paymentSchedule?: { 
      amount: number;
      date: string;
      is_downpayment: boolean;
      status?: 'paid' | 'pending';
      cardLastFour?: string;
    }[];
    paymentPlanId?: string;
    businessDetails?: {
      name: string;
      supportPhone: string;
      supportEmail: string;
    };
    paymentMethod?: {
      brand: string;
      last4: string;
    };
  };
  paymentIntent?: string;
}

export default function ConfirmationStep({ planDetails: initialPlanDetails, paymentIntent }: ConfirmationStepProps) {
    console.log('ConfirmationStep: Initial render with props:', { initialPlanDetails, paymentIntent });
    const [isSending, setIsSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [planDetails, setPlanDetails] = useState(initialPlanDetails);
    const [error, setError] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState({
      customerCreated: false,
      paymentPlanCreated: false,
      transactionsCreated: false,
      paymentIntentCreated: false
    });
  
    useEffect(() => {
      console.log('ConfirmationStep: useEffect triggered', { initialPlanDetails, paymentIntent });
      if (!initialPlanDetails && paymentIntent) {
        console.log('Fetching plan details for payment intent:', paymentIntent);
        fetchPlanDetails();
      }
    }, [initialPlanDetails, paymentIntent]);
  
    const fetchPlanDetails = async () => {
      console.log('ConfirmationStep: fetchPlanDetails called');
      let retryCount = 0;
      const maxRetries = 10;
      const retryDelay = 1000; // 1 second

      const attemptFetch = async () => {
        try {
          const response = await fetch(`/api/handle-payment-confirmation?payment_intent=${paymentIntent}`);
          const data = await response.json();
          console.log('ConfirmationStep: Fetched plan details:', data);

          if (data.success) {
            console.log('ConfirmationStep: Setting plan details and loading status');
            setPlanDetails(data.planDetails);
            setLoadingStatus(data.status);
            return true;
          } else {
            console.error('ConfirmationStep: Error in fetched data:', data.error);
            if (retryCount >= maxRetries) {
              setError(data.error || 'Failed to fetch plan details');
              console.error('Error details:', data.details);
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('ConfirmationStep: Error fetching plan details:', error);
          if (retryCount >= maxRetries) {
            setError('An error occurred while fetching plan details');
            return true;
          }
          return false;
        }
      };

      while (retryCount < maxRetries) {
        const isDone = await attemptFetch();
        if (isDone) break;
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
      }
    };
  
    const handleSendEmail = async () => {
      if (!planDetails?.paymentPlanId) {
        console.error('Payment plan ID is undefined');
        return;
      }
      setIsSending(true);
      try {
        const response = await fetch('/api/send-payment-plan-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentPlanId: planDetails.paymentPlanId }),
        });
  
        if (response.ok) {
          console.log('Email sent successfully');
          setEmailSent(true);
        } else {
          setError('Failed to send payment plan email');
        }
      } catch (error) {
        console.error('Error sending payment plan email:', error);
        setError('Error sending payment plan email');
      } finally {
        setIsSending(false);
      }
    };

    const handlePrint = () => {
      window.print();
    };

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
  
    // Replace the loading state (lines 142-154) with this:

if (!planDetails) {
  return (
    <div className="space-y-6">
      <Card className="max-w-3xl mx-auto confirmation-card">
        <CardHeader className="text-center border-b">
          <div className="flex justify-between items-start">
            <div className="text-left space-y-2">
              <div className="h-6 w-40 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-8 w-64 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-5 w-40 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-5 w-32 bg-muted animate-pulse rounded ml-auto" />
              <div className="h-5 w-36 bg-muted animate-pulse rounded ml-auto" />
              <div className="h-4 w-40 bg-muted animate-pulse rounded ml-auto" />
            </div>
          </div>

          <Separator />

          <div>
            <div className="h-5 w-36 bg-muted animate-pulse rounded mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-6 w-20 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="h-4 w-36 bg-muted-foreground/20 animate-pulse rounded mb-2" />
            <div className="h-4 w-full bg-muted-foreground/20 animate-pulse rounded" />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6 card-actions">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-9 bg-muted animate-pulse rounded" />
            ))}
          </div>
          <div className="flex gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
  
    console.log('ConfirmationStep: Rendering with state:', { planDetails, error, loadingStatus });
  
    return (
      <div className="space-y-6">
        <Card className="max-w-3xl mx-auto confirmation-card">
          <CardHeader className="text-center border-b">
            <div className="flex justify-between items-start">
              <div className="text-left">
                <h3 className="font-semibold text-lg">{planDetails.businessDetails?.name}</h3>
                <p className="text-sm text-muted-foreground">{planDetails.businessDetails?.supportPhone}</p>
                <p className="text-sm text-muted-foreground">{planDetails.businessDetails?.supportEmail}</p>
              </div>
              <div className="text-right">
                <CardTitle className="text-2xl">Payment Plan Confirmation</CardTitle>
                <p className="text-sm text-muted-foreground">Plan ID: {planDetails.paymentPlanId}</p>
                <p className="text-sm text-muted-foreground">Date: {format(new Date(), 'MMM dd, yyyy')}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div>
                <h3 className="font-semibold mb-2">Customer Details</h3>
                <p>{planDetails.customerName}</p>
                <p className="text-sm text-muted-foreground">{planDetails.customerEmail}</p>
              </div>
              <div className="text-right">
                <h3 className="font-semibold mb-2">Payment Plan Details</h3>
                <p>Total Amount: {formatCurrency(Money.fromCents(planDetails.totalAmount))}</p>
                <p className="text-sm text-muted-foreground">
                  {planDetails.numberOfPayments} {planDetails.paymentInterval} payments
                </p>
              </div>
            </div>
            
            <Separator />
            
            {planDetails.paymentSchedule && (
              <div>
                <h3 className="font-semibold mb-4">Payment Schedule</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...planDetails.paymentSchedule]
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((payment, index) => (
                        <TableRow key={index}>
                          <TableCell>{format(new Date(payment.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Money.fromCents(payment.amount))}</TableCell>
                          <TableCell className="text-right">
                            {payment.is_downpayment ? (
                              <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                                Paid
                              </span>
                            ) : (
                              <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700">
                                Scheduled
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">Payment Information</p>
              <p>
                Future payments will be automatically processed using the card ending in {planDetails.paymentMethod?.last4}.
                Payments will be charged on the scheduled dates shown above.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-6 card-actions">
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSendEmail}
                      disabled={isSending || emailSent}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send confirmation email</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handlePrint}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print payment plan</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Go to Plan Details Page</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      New Plan
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new payment plan</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button>
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Return to dashboard</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

