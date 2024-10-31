import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function InvalidPaymentLink() {
  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Invalid Payment Link</CardTitle>
          </div>
          <CardDescription>
            This payment link is no longer valid or has already been used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This could be because:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>The payment has already been completed</li>
            <li>The payment plan has expired</li>
            <li>The payment link is incorrect</li>
          </ul>
          <div className="pt-4">
            <Button asChild>
              <Link href="/">
                Return Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}