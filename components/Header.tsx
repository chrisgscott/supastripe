"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BadgePlus, Bell, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from '@/utils/supabase/client';

export default function Header() {
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/sign-in';
  };

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
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="frill-launcher">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <LogOut className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
