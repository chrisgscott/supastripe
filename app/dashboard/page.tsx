"use client";

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, UserIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format, isFuture, startOfMonth, addMonths, endOfMonth, isAfter, isBefore, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PaymentChart } from './components/PaymentChart';
import { formatCurrency } from '@/utils/currencyUtils';
import { DashboardCardSkeleton } from "./components/DashboardCardSkeleton"
import { Money } from '@/utils/currencyUtils';
import { ActivityLogsTable } from './components/ActivityLogsTable';


const queryClient = new QueryClient();

export default function DashboardWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

interface PaymentDataItem {
  month: string;
  collected: number;
  forecasted: number;
}

function Dashboard() {
  const [paymentData, setPaymentData] = useState<PaymentDataItem[]>([]);
  const [isLoadingActivePlans, setIsLoadingActivePlans] = useState(true);
  const [activePlans, setActivePlans] = useState(0);
  const [paidTimeFrame, setPaidTimeFrame] = useState('30');
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);
  const [revenue, setRevenue] = useState<Money>(Money.fromCents(0));
  const [pendingTimeFrame, setPendingTimeFrame] = useState('30');
  const [isLoadingScheduledRevenue, setIsLoadingScheduledRevenue] = useState(true);
  const [scheduledRevenue, setScheduledRevenue] = useState<Money>(Money.fromCents(0));
  const [isLoadingNextPayout, setIsLoadingNextPayout] = useState(true);
  const [nextPayout, setNextPayout] = useState<{ amount: Money | null; date: string | null }>({
    amount: null,
    date: null
  });
  const [userName, setUserName] = useState('');
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState(true);

  const fetchUserName = async () => {
    try {
      const response = await fetch('/api/user-name');
      const data = await response.json();
      setUserName(data.firstName || '');
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
  };

  useEffect(() => {
    fetchPaymentData();
    fetchActivePlans();
    fetchNextPayout();
    fetchUserName();
  }, []);

  useEffect(() => {
    fetchRevenue(paidTimeFrame);
  }, [paidTimeFrame]);

  useEffect(() => {
    fetchScheduledRevenue(pendingTimeFrame);
  }, [pendingTimeFrame]);

  const fetchPaymentData = async () => {
    setIsLoadingPaymentData(true);
    try {
      const response = await fetch('/api/get-payment-chart-data');
      const data = await response.json();
      setPaymentData(data);
    } catch (error) {
      console.error('Error fetching payment data:', error);
    }
    setIsLoadingPaymentData(false);
  };

  const fetchActivePlans = async () => {
    setIsLoadingActivePlans(true);
    try {
      const response = await fetch('/api/active-plans-count');
      const data = await response.json();
      setActivePlans(data.activePlans);
    } catch (error) {
      console.error('Error fetching active plans:', error);
    }
    setIsLoadingActivePlans(false);
  };

  const fetchRevenue = async (timeframe: string) => {
    setIsLoadingRevenue(true);
    try {
      const response = await fetch(`/api/revenue?days=${timeframe}`);
      const data = await response.json();
      setRevenue(Money.fromCents(data.revenue));
    } catch (error) {
      console.error('Error fetching revenue:', error);
    }
    setIsLoadingRevenue(false);
  };

  const fetchScheduledRevenue = async (days: string) => {
    setIsLoadingScheduledRevenue(true);
    try {
      const response = await fetch(`/api/scheduled-revenue?days=${days}`);
      const data = await response.json();
      setScheduledRevenue(Money.fromCents(data.scheduledRevenue));
    } catch (error) {
      console.error('Error fetching scheduled revenue:', error);
    }
    setIsLoadingScheduledRevenue(false);
  };

  const fetchNextPayout = async () => {
    setIsLoadingNextPayout(true);
    try {
      const response = await fetch('/api/next-payout');
      const data = await response.json();
      setNextPayout({
        amount: data.amount ? Money.fromCents(data.amount) : null,
        date: data.date
      });
    } catch (error) {
      console.error('Error fetching next payout:', error);
    }
    setIsLoadingNextPayout(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">
        {userName ? `Welcome to PayKit, ${userName}.` : 'Welcome to PayKit'}
      </h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingActivePlans ? <DashboardCardSkeleton /> : (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingActivePlans ? 'Loading...' : activePlans}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingRevenue ? <DashboardCardSkeleton /> : (
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
                {formatCurrency(revenue)}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingScheduledRevenue ? <DashboardCardSkeleton /> : (
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
                {formatCurrency(scheduledRevenue)}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingNextPayout ? <DashboardCardSkeleton /> : (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {nextPayout.amount ? formatCurrency(nextPayout.amount) : 'None scheduled'}
              </div>
              {nextPayout.date && (
                <div className="text-xs text-muted-foreground">
                  {nextPayout.date}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New row of cards */}
      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <div className="md:col-span-2">
          <PaymentChart
            data={paymentData}
            isLoading={isLoadingPaymentData}
          />
        </div>

        <div>
          <ActivityLogsTable />
        </div>
      </div>
    </div>
  );
}
