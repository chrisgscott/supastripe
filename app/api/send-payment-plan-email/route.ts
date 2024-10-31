import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendEmail } from "@/utils/core-email-service";
import { Money } from "@/utils/currencyUtils";
import { formatPaymentScheduleHtml } from "@/app/utils/email-utils";

export async function POST(request: Request) {
  const supabase = createClient();
  const { paymentPlanId } = await request.json();

  try {
    // Update plan state to pending_payment
    const { error: stateError } = await supabase
      .from("payment_plan_states")
      .update({ status: "pending_payment" })
      .eq("payment_plan_id", paymentPlanId);

    if (stateError) throw stateError;

    // Fetch payment plan details
    const { data: paymentPlan, error: paymentPlanError } = await supabase
      .from("payment_plans")
      .select(
        `
        *,
        notes,
        customers (name, email),
        transactions (amount, due_date, is_downpayment),
        payment_plan_states (status)
      `
      )
      .eq("id", paymentPlanId)
      .single();

    if (paymentPlanError) {
      console.error("Error fetching payment plan:", {
        error: paymentPlanError,
        paymentPlanId,
        query: "payment_plans with customers and transactions",
      });
      throw paymentPlanError;
    }

    if (!paymentPlan) {
      console.error("Payment plan not found:", { paymentPlanId });
      return NextResponse.json(
        { error: "Payment plan not found" },
        { status: 404 }
      );
    }

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
