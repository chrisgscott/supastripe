'use client'

import Header from '@/components/Header'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isOnboarding = pathname === '/onboarding'
  const isAuthPage = pathname?.startsWith('/sign-')

  if (isOnboarding || isAuthPage) {
    return children
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 p-4 bg-background">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
