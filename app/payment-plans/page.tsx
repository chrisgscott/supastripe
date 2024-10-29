"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPlansTable } from './components/PaymentPlansTable'

const queryClient = new QueryClient();

export default function PaymentPlansPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentPlansTable />
    </QueryClientProvider>
  )
}
