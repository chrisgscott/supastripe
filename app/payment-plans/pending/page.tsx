"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PendingPlansTable } from '../components/PendingPlansTable'

const queryClient = new QueryClient();

export default function PendingPlansPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PendingPlansTable />
    </QueryClientProvider>
  )
}