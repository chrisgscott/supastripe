import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, password } = await request.json();

    // Update email if provided and different
    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        console.error('Error updating email:', emailError);
        return NextResponse.json(
          { error: 'Failed to update email' },
          { status: 500 }
        );
      }
    }

    // Update password if provided
    if (password) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return NextResponse.json(
          { error: 'Failed to update password' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: 'Credentials updated successfully' });
  } catch (error) {
    console.error('Error updating credentials:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
