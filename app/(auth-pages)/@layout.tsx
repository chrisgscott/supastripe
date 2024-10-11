import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import "../globals.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={GeistSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex items-center justify-center min-h-screen bg-background">
            <main className="w-full max-w-md p-6">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}