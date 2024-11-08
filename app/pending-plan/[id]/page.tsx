"use client"

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/currencyUtils";
import { format } from "date-fns";
import { Mail, Printer, Pause, XCircle } from "lucide-react";
import { PendingPlanSkeleton } from "../components/PendingPlanSkeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Database } from "@/types/supabase";

type TransactionStatusType = Database['public']['Enums']['transaction_status_type'];
type TransactionType = Database['public']['Enums']['transaction_type'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];
type PaymentIntervalType = Database['public']['Enums']['payment_interval_type'];

interface PendingCustomer {
  id: string;
  name: string;
  email: string;
  user_id: string;
  stripe_customer_id: string | null;
}

interface PendingTransaction {
  id: string;
  amount: number;
  due_date: string;
  status: TransactionStatusType;
  transaction_type: TransactionType;
}

interface PendingPlan {
  id: string;
  pending_customers: PendingCustomer;
  total_amount: number;
  down_payment_amount: number;
  payment_amount: number;
  number_of_payments: number;
  payment_interval: PaymentIntervalType;
  status: PaymentStatusType;
  created_at: string;
  notes: string | null;
  pending_transactions: PendingTransaction[];
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch (error) {
    console.error("Invalid date:", dateString);
    return "Invalid date";
  }
}

async function fetchPendingPlanDetails(id: string): Promise<PendingPlan> {
  const response = await fetch(`/api/pending-plans/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch pending plan details');
  }
  const data = await response.json();
  
  // Convert amounts from cents to dollars for display
  return {
    ...data,
    total_amount: data.total_amount / 100,
    down_payment_amount: data.down_payment_amount / 100,
    payment_amount: data.payment_amount / 100,
    pending_transactions: data.pending_transactions.map((tx: any) => ({
      ...tx,
      amount: tx.amount / 100
    }))
  };
}

export default function PendingPlanDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ['pendingPlan', id],
    queryFn: () => fetchPendingPlanDetails(id),
  });

  if (isLoading) return <PendingPlanSkeleton />;
  if (isError) return <div>Error loading plan details</div>;
  if (!plan) return <div>Plan not found</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{plan.pending_customers?.name}</h1>
          <p className="text-muted-foreground">{plan.pending_customers?.email}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Plan ID: {plan.id}</p>
          <p className="text-sm text-muted-foreground">Created: {formatDate(plan.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">{formatCurrency(plan.total_amount)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="text-2xl font-bold">{formatCurrency(plan.down_payment_amount || 0)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Scheduled</p>
          <p className="text-2xl font-bold">{formatCurrency(plan.total_amount - (plan.down_payment_amount || 0))}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Schedule</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Payments will be automatically processed on this schedule:
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plan.pending_transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="py-2">{formatDate(transaction.due_date)}</td>
                    <td className="py-2">{formatCurrency(transaction.amount)}</td>
                    <td className="py-2">
                      <StatusBadge status={transaction.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Plan Actions</h2>
            <div className="space-y-2">
              <Button className="w-full" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Email Plan Details
              </Button>
              <Button className="w-full" variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Print Plan Details
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Manage Plan</h2>
            <div className="space-y-2">
              <Button className="w-full" variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause Plan
              </Button>
              <Button className="w-full" variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Plan
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}