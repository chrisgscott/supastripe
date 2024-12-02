'use client';

import { redirect } from 'next/navigation';
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";

export default function Home() {
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Session data in home:', session, 'Error:', error);
    };
    checkSession();
  }, []);

  // If we're on the root page, just redirect to dashboard
  // The middleware will handle any auth code in the URL
  redirect('/dashboard');
}