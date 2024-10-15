import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    const { error } = await supabase
      .from('payment_plans')
      .update({ status: 'cancelled' })
      .eq('id', paymentPlanId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error cancelling payment plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}