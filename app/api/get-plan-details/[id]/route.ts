import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

type Transaction = Database['public']['Tables']['transactions']['Row'];
type PendingTransaction = Database['public']['Tables']['pending_transactions']['Row'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('Fetching plan details for ID:', params.id);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('No authenticated user found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Authenticated user:', user.id);

  try {
    // First try regular payment plans
    console.log('Attempting to fetch from payment_plans...');
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
      .maybeSingle();

    if (planError) {
      if (planError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: 'Plan not found' 
        }, { status: 404 });
      }
      throw planError;
    }

    // Get business info (needed for both cases)
    console.log('Fetching business info...');
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    console.log('business_profiles result:', { data: businessInfo, error: businessError });

    if (businessError) {
      if (businessError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: 'Business profile not found' 
        }, { status: 404 });
      }
      throw businessError;
    }

    // If not found in payment_plans, try pending_payment_plans
    if (!paymentPlan) {
      console.log('Plan not found in payment_plans, trying pending_payment_plans...');
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

      console.log('pending_payment_plans result:', { 
        data: pendingPlan, 
        error: pendingError,
        pendingCustomers: pendingPlan?.pending_customers,
        pendingTransactions: pendingPlan?.pending_transactions 
      });

      if (pendingError) {
        if (pendingError.code === 'PGRST116') {
          return NextResponse.json({ 
            success: false, 
            error: 'Plan not found' 
          }, { status: 404 });
        }
        throw pendingError;
      }
      if (!pendingPlan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
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
    }

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
        },
        status: paymentPlan.status,
        isPending: false
      }
    });

  } catch (error) {
    console.error('Error in get-plan-details:', {
      error,
      planId: params.id,
      userId: user.id,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { 
        code: string; 
        details: string; 
        message: string;
      };
      
      console.error('Database error details:', {
        code: dbError.code,
        details: dbError.details,
        message: dbError.message
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error && typeof error === 'object' ? error : undefined
    }, { status: 500 });
  }
}