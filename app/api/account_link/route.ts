// app/api/account_link/route.ts
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('POST /api/account_link - Starting...');
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('POST /api/account_link - No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('POST /api/account_link - Request body:', JSON.stringify(body, null, 2));

    if (!body.account) {
      console.log('POST /api/account_link - No account ID provided. Body:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { error: 'No account ID provided' },
        { status: 400 }
      );
    }

    // Use the URLs from the request if provided, otherwise use environment variables
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000';
    const refreshUrl = body.refresh_url || `${baseUrl}/onboarding`;
    const returnUrl = body.return_url || `${baseUrl}/onboarding`;

    console.log('POST /api/account_link - Creating account link with:', {
      account: body.account,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: body.type || 'account_onboarding',
      collect: 'currently_due'
    });

    const accountLink = await stripe.accountLinks.create({
      account: body.account,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: body.type || 'account_onboarding',
      collect: 'currently_due',
    });

    console.log('POST /api/account_link - Account link created successfully:', accountLink);

    return NextResponse.json(accountLink);
  } catch (error) {
    console.error('POST /api/account_link - Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
