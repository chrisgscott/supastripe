import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { createClient } from '@/utils/supabase/server';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Your App Name",
  description: "Your app description",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={GeistSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {user ? (
            <div className="flex flex-col min-h-screen">
              <Header />
              <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-4">
                  {children}
                </main>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-screen bg-background">
              <main className="w-full max-w-md p-6">
                {children}
              </main>
            </div>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
