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
    console.log('POST /api/account_link - Request body:', body);

    if (!body.account) {
      console.log('POST /api/account_link - No account ID provided');
      return NextResponse.json(
        { error: 'No account ID provided' },
        { status: 400 }
      );
    }

    // Use the URLs from the request if provided, otherwise use environment variables
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const refreshUrl = body.refresh_url || `${baseUrl}/settings`;
    const returnUrl = body.return_url || `${baseUrl}/settings`;

    console.log('POST /api/account_link - Creating account link with URLs:', {
      refreshUrl,
      returnUrl
    });

    const accountLink = await stripe.accountLinks.create({
      account: body.account,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: body.type || 'account_onboarding',
      collect: 'eventually_due',
    });

    console.log('POST /api/account_link - Account link created:', accountLink);

    // Store the account link URL in the database
    const { error: dbError } = await supabase
      .from('stripe_accounts')
      .update({
        stripe_account_details_url: accountLink.url,
      })
      .eq('stripe_account_id', body.account);

    if (dbError) {
      console.error('POST /api/account_link - Database error:', dbError);
    }

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('POST /api/account_link - Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account link' },
      { status: 500 }
    );
  }
}
