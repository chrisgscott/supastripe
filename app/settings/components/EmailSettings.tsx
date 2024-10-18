import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from '@/utils/supabase/client';

export default function EmailSettings() {
  const [ccOnClientEmails, setCcOnClientEmails] = useState(false);
  const [welcomeTemplate, setWelcomeTemplate] = useState('');
  const [invoiceTemplate, setInvoiceTemplate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  const fetchEmailSettings = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching email settings:', error);
      } else if (data) {
        setCcOnClientEmails(data.cc_on_client_emails);
        setWelcomeTemplate(data.welcome_template || '');
        setInvoiceTemplate(data.invoice_template || '');
      }
    }
  };

  const saveEmailSettings = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('email_settings')
        .upsert({
          user_id: user.id,
          cc_on_client_emails: ccOnClientEmails,
          welcome_template: welcomeTemplate,
          invoice_template: invoiceTemplate
        });

      if (error) {
        console.error('Error saving email settings:', error);
        setMessage('Failed to save email settings');
      } else {
        setMessage('Email settings saved successfully');
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Email Settings</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="cc-emails"
              checked={ccOnClientEmails}
              onCheckedChange={setCcOnClientEmails}
            />
            <Label htmlFor="cc-emails">CC me on all client emails</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="welcome-template">Welcome Email Template</Label>
            <Textarea
              id="welcome-template"
              value={welcomeTemplate}
              onChange={(e) => setWelcomeTemplate(e.target.value)}
              rows={5}
              placeholder="Enter your welcome email template here..."
            />
          </div>
          <div>
            <Label htmlFor="invoice-template">Invoice Email Template</Label>
            <Textarea
              id="invoice-template"
              value={invoiceTemplate}
              onChange={(e) => setInvoiceTemplate(e.target.value)}
              rows={5}
              placeholder="Enter your invoice email template here..."
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveEmailSettings}>Save Email Settings</Button>

      {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
    </div>
  );
}
