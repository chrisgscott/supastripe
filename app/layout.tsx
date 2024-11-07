import { Noto_Sans } from 'next/font/google';
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Header from "@/components/Header";
import { createClient } from '@/utils/supabase/server';
import { loadStripe } from '@stripe/stripe-js';
import { Metadata } from 'next'
import Script from 'next/script'
import { Toaster } from "@/components/ui/toaster"

const notoSans = Noto_Sans({ subsets: ['latin'] });

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  title: 'PayKit.io',
  description: 'Simple payment plan software for small business owners',
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={notoSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex flex-col min-h-screen">
            {user && <Header />}
            <main className="flex-1 p-4 bg-gray-50">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
          <Script src="https://js.stripe.com/v3/" strategy="afterInteractive" />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
