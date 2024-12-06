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
import { EventFeed } from './components/EventFeed';
import { createClient } from '@/utils/supabase/server';
import OnboardingProgress from '@/components/OnboardingProgress';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ActivePlansCard } from './components/ActivePlansCard';
import { RevenueCard } from './components/RevenueCard';
import { ScheduledRevenueCard } from './components/ScheduledRevenueCard';
import { NextPayoutCard } from './components/NextPayoutCard';

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
      {!profile?.is_onboarded && <OnboardingProgress user={user} />}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActivePlansCard />
        
        <RevenueCard />
        
        <ScheduledRevenueCard />
        
        <NextPayoutCard />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="h-[350px]">
            <PaymentChart />
          </div>
        </div>

        <div className="lg:col-span-4">
          <EventFeed user={user} limit={10} />
        </div>
      </div>
    </div>
  )
}
