import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { format } from 'date-fns'
import { Database } from '@/types/supabase'
import { Money } from '@/utils/currencyUtils'

type PaymentStatusType = Database['public']['Enums']['payment_status_type']

interface PaymentPlanResponse {
  id: string
  total_amount: number
  created_at: string
  status: PaymentStatusType
  customer_id: string
  customers: Array<{
    id: string
    name: string
  }>
  transactions: Array<{
    due_date: string
    status: string
  }>
}

interface PendingPaymentPlanResponse {
  id: string
  total_amount: number
  created_at: string
  status: PaymentStatusType
  customer_id: string
  pending_customers: Array<{
    id: string
    name: string
  }>
  pending_transactions: Array<{
    due_date: string
    status: string
  }>
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  
  const statusFilter = searchParams.get('status')?.split(',') as PaymentStatusType[] | undefined
  const search = searchParams.get('search')?.toLowerCase()
  const sortBy = searchParams.get('sortBy') || 'created_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: activePlans, error: activePlansError }, { data: pendingPlans, error: pendingPlansError }] = await Promise.all([
      supabase
        .from('payment_plans')
        .select(`
          id,
          total_amount,
          created_at,
          status,
          customer_id,
          customers!inner (
            id,
            name
          ),
          transactions (
            due_date,
            status
          )
        `)
        .eq('user_id', user.id),
      
      supabase
        .from('pending_payment_plans')
        .select(`
          id,
          total_amount,
          created_at,
          status,
          customer_id,
          pending_customers!inner (
            id,
            name
          ),
          pending_transactions (
            due_date,
            status
          )
        `)
        .eq('user_id', user.id)
    ])

    console.log('Debug - Active Plans Query Result:', JSON.stringify(activePlans, null, 2))
    console.log('Debug - Pending Plans Query Result:', JSON.stringify(pendingPlans, null, 2))

    if (activePlansError || pendingPlansError) {
      console.error('Error fetching plans:', { activePlansError, pendingPlansError })
      return NextResponse.json({ error: 'Failed to fetch payment plans' }, { status: 500 })
    }

    console.log('Active Plans:', JSON.stringify(activePlans, null, 2))
    console.log('Pending Plans:', JSON.stringify(pendingPlans, null, 2))

    console.log('Raw Active Plans:', JSON.stringify(activePlans, null, 2))
    console.log('First active plan customers:', activePlans?.[0]?.customers)
    console.log('First active plan customer_id:', activePlans?.[0]?.customer_id)

    console.log('Raw Pending Plans:', JSON.stringify(pendingPlans, null, 2))
    console.log('First pending plan pending_customers:', pendingPlans?.[0]?.pending_customers)
    console.log('First pending plan customer_id:', pendingPlans?.[0]?.customer_id)

    let allPlans = [
      ...(activePlans || []).map((plan: PaymentPlanResponse) => ({
        ...plan,
        customerName: plan.customers?.[0]?.name || "Unknown",
        totalAmount: Money.fromCents(plan.total_amount || 0).toString(),
        nextPaymentDate: getNextPaymentDate(plan.transactions || []),
        next_payment_date: getNextPaymentDate(plan.transactions || []),
        isPending: false
      })),
      ...(pendingPlans || []).map((plan: PendingPaymentPlanResponse) => ({
        ...plan,
        customerName: plan.pending_customers?.[0]?.name || "Unknown",
        totalAmount: Money.fromCents(plan.total_amount || 0).toString(),
        nextPaymentDate: getNextPaymentDate(plan.pending_transactions || []),
        next_payment_date: getNextPaymentDate(plan.pending_transactions || []),
        isPending: true
      }))
    ]

    console.log('Transformed Plans:', JSON.stringify(allPlans, null, 2))

    if (statusFilter?.length) {
      allPlans = allPlans.filter(plan => statusFilter.includes(plan.status))
    }

    if (search) {
      allPlans = allPlans.filter(plan => 
        plan.customerName.toLowerCase().includes(search) ||
        plan.totalAmount.toLowerCase().includes(search)
      )
    }

    allPlans.sort((a, b) => {
      switch (sortBy) {
        case 'customerName':
          return sortOrder === 'asc' 
            ? a.customerName.localeCompare(b.customerName)
            : b.customerName.localeCompare(a.customerName)
        case 'totalAmount':
          const amountA = Money.fromCents(parseInt(a.totalAmount.replace(/[^0-9]/g, '')))
          const amountB = Money.fromCents(parseInt(b.totalAmount.replace(/[^0-9]/g, '')))
          return sortOrder === 'asc'
            ? amountA.toCents() - amountB.toCents()
            : amountB.toCents() - amountA.toCents()
        case 'nextPaymentDate':
          const dateA = a.nextPaymentDate ? new Date(a.nextPaymentDate).getTime() : 0
          const dateB = b.nextPaymentDate ? new Date(b.nextPaymentDate).getTime() : 0
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        case 'status':
          return sortOrder === 'asc'
            ? a.status.localeCompare(b.status)
            : b.status.localeCompare(a.status)
        default:
          return sortOrder === 'asc'
            ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return NextResponse.json(allPlans)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

function getNextPaymentDate(transactions: Array<{ due_date: string, status: string }>): string | null {
  if (!transactions || transactions.length === 0) return null
  
  const pendingTransactions = transactions.filter(t => t.status === 'pending')
  if (pendingTransactions.length === 0) return null

  const nextDueDate = new Date(Math.min(...pendingTransactions.map(t => new Date(t.due_date).getTime())))
  return format(nextDueDate, 'yyyy-MM-dd')
}
