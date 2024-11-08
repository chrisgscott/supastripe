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
          {/* Frill Script */}
          <Script strategy="afterInteractive" dangerouslySetInnerHTML={{
            __html: `
              (function(t,r){function s(){var a=r.getElementsByTagName("script")[0],e=r.createElement("script");e.type="text/javascript",e.async=!0,e.src="https://widget.frill.co/v2/container.js",a.parentNode.insertBefore(e,a)}if(!t.Frill){var o=0,i={};t.Frill=function(e,p){var n,l=o++,c=new Promise(function(v,d){i[l]={params:[e,p],resolve:function(f){n=f,v(f)},reject:d}});return c.destroy=function(){delete i[l],n&&n.destroy()},c},t.Frill.q=i}r.readyState==="complete"||r.readyState==="interactive"?s():r.addEventListener("DOMContentLoaded",s)})(window,document);
              window.Frill('container', {
                key: '4f93f8d4-3e9e-4e8f-9bfb-eedeca9e1712',
                // Identify your users (optional)
                // user: { email: 'email@domain.com', name: 'my user'}
              });
            `
          }} />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
