import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendEmail } from "@/utils/core-email-service";
import { Money } from "@/utils/currencyUtils";
import { formatPaymentScheduleHtml } from "@/app/utils/email-utils";
import { Database } from "@/types/supabase";

type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type EmailLog = Database['public']['Tables']['email_logs']['Insert'];
type PaymentStatusType = Database['public']['Enums']['payment_status_type'];

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch payment plan details with current status
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from("payment_plans")
      .select(`
        *,
        customers (
          name,
          email
        ),
        transactions (
          amount,
          due_date,
          transaction_type
        )
      `)
      .eq("id", paymentPlanId)
      .single();

    if (paymentPlanError || !paymentPlan) {
      console.error("Error fetching payment plan:", paymentPlanError);
      return NextResponse.json({ error: "Payment plan not found" }, { status: 404 });
    }

    // If user is authenticated, verify they own this payment plan
    if (user && paymentPlan.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate current status allows transition to pending_payment
    if (!['draft', 'pending_approval'].includes(paymentPlan.status as PaymentStatusType)) {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 400 }
      );
    }

    // Update payment plan status
    let query = supabase
      .from("payment_plans")
      .update({ 
        status: 'pending_payment' satisfies PaymentStatusType,
        status_updated_at: new Date().toISOString()
      })
      .eq("id", paymentPlanId);

    // Add user_id check only if user is authenticated
    if (user) {
      query = query.eq("user_id", user.id);
    }

    const { error: updateError } = await query;

    if (updateError) throw updateError;

    // Fetch business details
    const { data: businessInfo, error: businessError } = await supabase
      .from("profiles")
      .select("business_name, support_email, support_phone")
      .single();

    if (businessError) throw businessError;

    const emailTemplate = {
      templateId: 2,
      params: {
        business_name: businessInfo.business_name,
        business_phone: businessInfo.support_phone,
        business_email: businessInfo.support_email,
        plan_id: paymentPlan.id,
        date: new Date().toLocaleDateString(),
        customer_name: paymentPlan.customers.name,
        customer_email: paymentPlan.customers.email,
        total_amount: Money.fromCents(paymentPlan.total_amount).toString(),
        number_of_payments: `${paymentPlan.number_of_payments} ${paymentPlan.payment_interval} payments`,
        payment_schedule_html: formatPaymentScheduleHtml(
          paymentPlan.transactions
        ),
        card_last_four: paymentPlan.card_last_four,
        notes_html: paymentPlan.notes?.content || "",
        payment_link: `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${paymentPlanId}`,
      },
    };

    console.log(
      "Email parameters being sent to Brevo:",
      JSON.stringify(emailTemplate, null, 2)
    );

    const success = await sendEmail(
      paymentPlan.customers.email,
      emailTemplate.templateId,
      emailTemplate.params
    );

    console.log("Response from sendEmail function:", success);

    // Create a unique idempotency key
    const idempotencyKey = `payment_plan_${paymentPlanId}_${new Date().toISOString().split("T")[0]}`;

    // Prepare log data
    const logData = {
      email_type: "payment_plan",
      recipient_email: paymentPlan.customers.email,
      status: success ? "sent" : "failed",
      related_id: paymentPlanId,
      related_type: "payment_plan",
      idempotency_key: idempotencyKey,
    };

    // Log the email attempt
    const { error: logError } = await supabase
      .from("email_logs")
      .insert(logData);

    if (logError) {
      console.error("Error logging email attempt:", logError);
      // Don't throw the error, just log it
    }

    if (success) {
      return NextResponse.json({
        message: "Payment plan email sent successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send payment plan email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending payment plan email:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
