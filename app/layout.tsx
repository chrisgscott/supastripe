import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from "next-themes"
import { createClient } from '@/utils/supabase/server'
import { Metadata } from 'next'
import Script from 'next/script'
import { Toaster } from "sonner"
import Template from '@/components/Template'

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
  variable: '--font-plus-jakarta-sans',
})

export const metadata: Metadata = {
  title: 'PayKit',
  description: 'Accept payments and manage subscriptions with ease.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={plusJakarta.className}>
      <head>
        <Script
          src="https://js.stripe.com/v3/"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Template>
            {children}
          </Template>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
