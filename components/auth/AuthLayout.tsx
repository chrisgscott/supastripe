import Link from 'next/link';
import { AuthHero } from './AuthHero';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
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
          {children}
        </div>
      </div>
    </div>
  );
}
