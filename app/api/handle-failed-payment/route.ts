import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId, transactionId } = await request.json();

  try {
    const { error: transactionError } = await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("id", transactionId);

    if (transactionError) throw transactionError;

    const { error: stateError } = await supabase
      .from("payment_plan_states")
      .update({ status: "failed" })
      .eq("payment_plan_id", paymentPlanId);

    if (stateError) throw stateError;

    const idempotencyKey = crypto.randomUUID();
    const { error: logError } = await supabase
      .from("payment_processing_logs")
      .insert({
        transaction_id: transactionId,
        payment_plan_id: paymentPlanId,
        stripe_payment_intent_id: null, // We don't have this for failed payments
        status: "failed",
        idempotency_key: idempotencyKey,
      });

    if (logError) throw logError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error handling failed payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
