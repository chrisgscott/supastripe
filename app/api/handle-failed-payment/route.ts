import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId, transactionId } = await request.json();

  try {
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({ status: 'failed' })
      .eq('id', transactionId);

    if (transactionError) throw transactionError;

    const { error: planError } = await supabase
      .from('payment_plans')
      .update({ status: 'failed' })
      .eq('id', paymentPlanId);

    if (planError) throw planError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error handling failed payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}