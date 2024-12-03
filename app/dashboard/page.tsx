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
import { createClient } from '@/utils/supabase/server';
import OnboardingProgress from '@/components/OnboardingProgress';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  // Call cookies() to opt out of caching
  cookies()
  const supabase = await createClient()

  // Use getUser() for secure token validation
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/sign-in')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching profile:', profileError)
  }

  return (
    <div className="space-y-4">
      {!profile?.is_onboarded && <OnboardingProgress />}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <Select defaultValue="30">
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7d</SelectItem>
                <SelectItem value="30">30d</SelectItem>
                <SelectItem value="90">90d</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Revenue</CardTitle>
            <Select defaultValue="30">
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7d</SelectItem>
                <SelectItem value="30">30d</SelectItem>
                <SelectItem value="90">90d</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <PaymentChart data={[]} />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityLogsTable />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
