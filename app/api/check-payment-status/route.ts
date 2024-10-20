import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const paymentStatus = cookies().get('paymentStatus');
  
  if (paymentStatus) {
    cookies().delete('paymentStatus');
    return NextResponse.json({ status: paymentStatus.value });
  } else {
    return NextResponse.json({ status: 'unknown' });
  }
}