import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

type PendingTransaction = Database['public']['Tables']['pending_transactions']['Row'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('Fetching pending plan details for ID:', params.id);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('No authenticated user found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get business info first
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (businessError) {
      if (businessError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: 'Business profile not found' 
        }, { status: 404 });
      }
      throw businessError;
    }

    // Fetch pending plan details
    const { data: pendingPlan, error: pendingError } = await supabase
      .from('pending_payment_plans')
      .select(`
        *,
        pending_customers (
          name,
          email
        ),
        pending_transactions (
          id,
          amount,
          due_date,
          transaction_type,
          status
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (pendingError) {
      if (pendingError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: 'Pending plan not found' 
        }, { status: 404 });
      }
      throw pendingError;
    }

    if (!pendingPlan) {
      return NextResponse.json({ error: 'Pending plan not found' }, { status: 404 });
    }

    // Extract the first customer from the array
    const customer = Array.isArray(pendingPlan.pending_customers) 
      ? pendingPlan.pending_customers[0] 
      : pendingPlan.pending_customers;

    return NextResponse.json({
      success: true,
      planDetails: {
        customerName: customer?.name || "Unknown",
        customerEmail: customer?.email || "",
        totalAmount: pendingPlan.total_amount,
        numberOfPayments: pendingPlan.number_of_payments,
        paymentInterval: pendingPlan.payment_interval,
        notes: pendingPlan.notes,
        paymentSchedule: Array.isArray(pendingPlan.pending_transactions) 
          ? pendingPlan.pending_transactions.map((t: PendingTransaction) => ({
              amount: t.amount,
              date: t.due_date,
              transaction_type: t.transaction_type,
              status: t.status
            }))
          : [],
        businessDetails: businessInfo ? {
          name: businessInfo.business_name,
          supportPhone: businessInfo.support_phone,
          supportEmail: businessInfo.support_email
        } : undefined,
        paymentMethod: pendingPlan.card_last_four ? {
          brand: 'card',
          last4: pendingPlan.card_last_four
        } : undefined,
        status: pendingPlan.status,
        isPending: true
      }
    });

  } catch (error) {
    console.error('Error in get-pending-plan-details:', {
      error,
      planId: params.id,
      userId: user.id,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}