import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update the payment plan status directly
    const { error } = await supabase
      .from("payment_plans")
      .update({ status: "cancelled" })
      .eq("id", paymentPlanId)
      .eq("user_id", user.id); // Add user check for security

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error cancelling payment plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
