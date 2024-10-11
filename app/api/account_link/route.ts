// app/api/account_link/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { account } = await request.json();

    // Get origin from the request headers or use a default fallback
    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create the account link using the provided account and valid URLs
    const accountLink = await stripe.accountLinks.create({
      account: account,
      refresh_url: `${origin}/refresh/${account}`,
      return_url: `${origin}/return/${account}`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (error: any) {
    console.error(
      "An error occurred when calling the Stripe API to create an account link:",
      error
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
