import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

type Transaction = Database['public']['Tables']['transactions']['Row'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: paymentPlan, error: planError } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers (
          name,
          email
        ),
        transactions (*)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (planError) throw planError;

    const { data: businessInfo, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (businessError) throw businessError;

    return NextResponse.json({
      success: true,
      planDetails: {
        customerName: paymentPlan.customers.name,
        customerEmail: paymentPlan.customers.email,
        totalAmount: paymentPlan.total_amount,
        numberOfPayments: paymentPlan.number_of_payments,
        paymentInterval: paymentPlan.payment_interval,
        notes: paymentPlan.notes,
        paymentSchedule: paymentPlan.transactions.map((t: Transaction) => ({
          amount: t.amount,
          date: t.due_date,
          transaction_type: t.transaction_type,
          status: t.status
        })),
        businessDetails: {
          name: businessInfo.business_name,
          supportPhone: businessInfo.support_phone,
          supportEmail: businessInfo.support_email
        },
        paymentMethod: {
          brand: paymentPlan.card_brand,
          last4: paymentPlan.card_last_four
        }
      }
    });

  } catch (error) {
    console.error('Error in get-plan-details:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}