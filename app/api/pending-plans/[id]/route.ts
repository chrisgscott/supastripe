import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Money } from '@/utils/currencyUtils'
import { Tables } from '@/types/supabase'

interface Customer {
  name?: string;
  email?: string;
  stripe_customer_id?: string;
}

type PaymentPlanWithRelations = Tables<'payment_plans'> & {
  customers: Customer | Customer[] | null;
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('payment_plans')
      .select(`
        id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        customers (
          name,
          email
        )
      `)
      .eq('id', params.id)
      .eq('plan_creation_status', 'pending')
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const customerName = (() => {
      if (Array.isArray(data.customers)) {
        return data.customers[0]?.name || 'Unknown'
      } else if (data.customers && typeof data.customers === 'object') {
        return (data.customers as Customer).name || 'Unknown'
      }
      return 'Unknown'
    })()

    const formattedData = {
      id: data.id,
      customerName,
      totalAmount: data.total_amount,
      numberOfPayments: data.number_of_payments || 3,
      paymentInterval: data.payment_interval || 'monthly'
    }

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch plan details' }, { status: 500 })
  }
}
