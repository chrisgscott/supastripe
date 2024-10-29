import { headers } from 'next/headers'

export default function PaymentPlanDetailsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1">
      <div className="container mx-auto py-6">
        {children}
      </div>
    </div>
  )
}