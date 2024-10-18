"use client";

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPlansTable } from './components/PaymentPlansTable'

const queryClient = new QueryClient();

export default function PaymentPlansPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Payment Plans</h1>
        <PaymentPlansTable />
      </div>
    </QueryClientProvider>
  )
}
