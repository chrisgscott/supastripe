import Link from 'next/link';
import { AuthHero } from './AuthHero';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="fixed inset-0 flex">
      <div className="hidden w-1/3 md:block">
        <AuthHero />
      </div>
      <div className="flex w-full items-center justify-start p-16 md:w-2/3">
        <div className="w-full max-w-[350px]">
          <div className="mb-6">
            <Link href="/" className="text-lg font-semibold">
              PayKit
            </Link>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
