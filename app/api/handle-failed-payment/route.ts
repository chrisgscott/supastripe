import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";
import crypto from "crypto";

type TransactionStatusType = Database['public']['Enums']['transaction_status_type'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId, transactionId } = await request.json();

  try {
    // Begin transaction
    await supabase.rpc('begin_transaction');

    try {
      const { error: transactionError } = await supabase
        .from("transactions")
        .update({ 
          status: 'failed' as TransactionStatusType,
          updated_at: new Date().toISOString()
        })
        .eq("id", transactionId);

      if (transactionError) throw transactionError;

      const { error: planError } = await supabase
        .from("payment_plans")
        .update({ 
          status: 'failed' as PaymentStatusType,
          status_updated_at: new Date().toISOString()
        })
        .eq("id", paymentPlanId);

      if (planError) throw planError;

      const idempotencyKey = crypto.randomUUID();
      const { error: logError } = await supabase
        .from("email_logs")
        .insert({
          email_type: 'user_payment_failed_alert',
          status: 'pending',
          related_id: transactionId,
          related_type: 'transaction',
          idempotency_key: idempotencyKey,
          recipient_email: '', // Will be populated by trigger
          user_id: '', // Will be populated by trigger
        });

      if (logError) throw logError;

      // Commit transaction
      await supabase.rpc('commit_transaction');

      return NextResponse.json({ success: true });

    } catch (innerError) {
      // Rollback on any error
      await supabase.rpc('rollback_transaction');
      throw innerError;
    }

  } catch (error: any) {
    console.error("Error handling failed payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
