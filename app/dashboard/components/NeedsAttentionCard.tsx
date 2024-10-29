import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { Mail } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { NeedsAttentionSkeleton } from "./NeedsAttentionSkeleton";

interface FailedTransaction {
  id: string;
  customerName: string;
  amount: number;
  nextAttempt: string;
  email: string;
}

interface NeedsAttentionCardProps {
  failedTransactions: FailedTransaction[];
  isLoading: boolean;
}

export function NeedsAttentionCard({ failedTransactions, isLoading }: NeedsAttentionCardProps) {
  if (isLoading) {
    return <NeedsAttentionSkeleton />
  }

  const handleEmailCustomer = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Loading...</div>
        ) : !Array.isArray(failedTransactions) ? (
          <div>Error loading failed transactions</div>
        ) : failedTransactions.length === 0 ? (
          <div>No failed transactions</div>
        ) : (
          <ul className="space-y-2">
            {failedTransactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {transaction.customerName} - {formatCurrency(transaction.amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {transaction.nextAttempt 
                      ? `Next attempt on ${format(parseISO(transaction.nextAttempt), 'dd MMM yyyy')}`
                      : 'No next attempt scheduled'}
                  </div>
                </div>
                <Button variant="subtle" size="sm" onClick={() => handleEmailCustomer(transaction.email)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
