import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from '@/utils/supabase/client';
import { Input } from "@/components/ui/input";

interface EmailTemplate {
  subject: string;
  content: string;
}

interface EmailSettings {
  ccOnClientEmails: boolean;
  newPlanWelcome: EmailTemplate;
  upcomingPaymentReminder: EmailTemplate;
  paymentSuccessful: EmailTemplate;
  paymentFailed: EmailTemplate;
  planCompleted: EmailTemplate;
  planCanceled: EmailTemplate;
}

export default function EmailSettings() {
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    ccOnClientEmails: false,
    newPlanWelcome: { subject: '', content: '' },
    upcomingPaymentReminder: { subject: '', content: '' },
    paymentSuccessful: { subject: '', content: '' },
    paymentFailed: { subject: '', content: '' },
    planCompleted: { subject: '', content: '' },
    planCanceled: { subject: '', content: '' },
  });
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
        setEmailSettings(data);
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
          ...emailSettings
        });

      if (error) {
        console.error('Error saving email settings:', error);
        setMessage('Failed to save email settings');
      } else {
        setMessage('Email settings saved successfully');
      }
    }
  };

  const handleTemplateChange = (template: keyof EmailSettings, field: 'subject' | 'content', value: string) => {
    setEmailSettings(prev => ({
      ...prev,
      [template]: {
        ...(prev[template] as EmailTemplate),
        [field]: value
      }
    }));
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
              checked={emailSettings.ccOnClientEmails}
              onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, ccOnClientEmails: checked }))}
            />
            <Label htmlFor="cc-emails">CC me on all client emails</Label>
          </div>
        </CardContent>
      </Card>

      {Object.entries(emailSettings).map(([key, value]) => {
        if (key === 'ccOnClientEmails') return null;
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`${key}-subject`}>Subject</Label>
                <Input
                  id={`${key}-subject`}
                  value={value.subject}
                  onChange={(e) => handleTemplateChange(key as keyof EmailSettings, 'subject', e.target.value)}
                  placeholder="Enter email subject..."
                />
              </div>
              <div>
                <Label htmlFor={`${key}-content`}>Email Content</Label>
                <Textarea
                  id={`${key}-content`}
                  value={value.content}
                  onChange={(e) => handleTemplateChange(key as keyof EmailSettings, 'content', e.target.value)}
                  rows={5}
                  placeholder="Enter email content..."
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={saveEmailSettings}>Save Email Settings</Button>
      {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
    </div>
  );
}
