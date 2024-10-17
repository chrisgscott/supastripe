"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, UserIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const queryClient = new QueryClient();

export default function DashboardWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

function Dashboard() {
  const [paidTimeFrame, setPaidTimeFrame] = useState('30');
  const [pendingTimeFrame, setPendingTimeFrame] = useState('30');

  const fetchNextPayout = async () => {
    const response = await fetch('/api/next-payout');
    if (!response.ok) throw new Error('Failed to fetch next payout');
    return response.json();
  };

  const fetchRevenue = async (timeFrame: string) => {
    const response = await fetch(`/api/revenue?days=${timeFrame}`);
    if (!response.ok) throw new Error('Failed to fetch revenue');
    return response.json();
  };

  const fetchScheduledRevenue = async (timeFrame: string) => {
    const response = await fetch(`/api/scheduled-revenue?days=${timeFrame}`);
    if (!response.ok) throw new Error('Failed to fetch scheduled revenue');
    return response.json();
  };

  const fetchActivePlans = async () => {
    const response = await fetch('/api/active-plans-count');
    if (!response.ok) throw new Error('Failed to fetch active plans count');
    return response.json();
  };

  const { data: nextPayout, isLoading: isLoadingNextPayout } = useQuery({
    queryKey: ['nextPayout'],
    queryFn: fetchNextPayout,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: revenue, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['revenue', paidTimeFrame],
    queryFn: () => fetchRevenue(paidTimeFrame),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: scheduledRevenue, isLoading: isLoadingScheduledRevenue } = useQuery({
    queryKey: ['scheduledRevenue', pendingTimeFrame],
    queryFn: () => fetchScheduledRevenue(pendingTimeFrame),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: activePlans, isLoading: isLoadingActivePlans } = useQuery({
    queryKey: ['activePlans'],
    queryFn: fetchActivePlans,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingActivePlans ? 'Loading...' : activePlans?.count}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Payments</CardTitle>
            <Select value={paidTimeFrame} onValueChange={setPaidTimeFrame}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="7">7 days</SelectItem>
                <SelectItem className="text-xs" value="30">30 days</SelectItem>
                <SelectItem className="text-xs" value="90">90 days</SelectItem>
                <SelectItem className="text-xs" value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRevenue ? 'Loading...' : revenue?.revenue}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Select value={pendingTimeFrame} onValueChange={setPendingTimeFrame}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="7">7 days</SelectItem>
                <SelectItem className="text-xs" value="30">30 days</SelectItem>
                <SelectItem className="text-xs" value="90">90 days</SelectItem>
                <SelectItem className="text-xs" value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingScheduledRevenue ? 'Loading...' : scheduledRevenue?.scheduledRevenue}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingNextPayout ? 'Loading...' : nextPayout?.amount}
            </div>
            {nextPayout?.date && (
              <div className="text-xs text-muted-foreground">
                {nextPayout.date}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
