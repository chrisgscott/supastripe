import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BadgePlus } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-background shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex-shrink-0">
              <img className="h-6 w-auto" src="/images/logo.png" alt="PayKit" />
            </Link>
            <nav className="ml-6 flex space-x-8">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/payment-plans"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Payment Plans
              </Link>
              <Link
                href="/settings"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            <Link href="/new-plan">
              <Button variant="default">
                <BadgePlus className="w-4 h-4 mr-2" />
                Create Payment Plan
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
