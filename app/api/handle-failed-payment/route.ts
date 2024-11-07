import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId, transactionId } = await request.json();

  try {
    const { error } = await supabase.rpc('handle_failed_payment', {
      p_payment_plan_id: paymentPlanId,
      p_transaction_id: transactionId,
      p_idempotency_key: crypto.randomUUID()
    });

    if (error) {
      console.error('Error handling failed payment:', error);
      return NextResponse.json({ 
        error: 'Failed to process payment failure' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in handle-failed-payment:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
