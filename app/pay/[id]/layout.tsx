export default function PaymentLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="container mx-auto py-6">
        {children}
      </div>
    );
  }