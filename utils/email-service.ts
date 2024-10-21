// /utils/email-service.ts
// @ts-nocheck


import { createClient } from '@supabase/supabase-js'
import * as SibApiV3Sdk from '@getbrevo/brevo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const brevoApiKey = typeof Deno !== 'undefined' ? Deno.env.get('BREVO_API_KEY') : process.env.BREVO_API_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()

if (!brevoApiKey) {
  throw new Error('BREVO_API_KEY is not set in the environment variables')
}

apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey)

interface EmailParams {
  [key: string]: string | number;
}

async function sendEmail(to: string, templateId: number, params: EmailParams) {
  const emailData = {
    to: [{ email: to }],
    templateId: templateId,
    params: params
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify(emailData)
    })

    if (!response.ok) {
      throw new Error(`Failed to send email: ${await response.text()}`)
    }

    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

export async function sendPaymentReminderEmail(
  recipientEmail: string,
  params: {
    customer_name: string;
    amount: number;
    due_date: string;
    business_name: string;
    support_email: string;
    support_phone: string;
  }
): Promise<boolean> {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()
    sendSmtpEmail.to = [{ email: recipientEmail }]
    sendSmtpEmail.templateId = 1 // Make sure this matches your Brevo template ID
    sendSmtpEmail.params = params

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('Email sent successfully:', response)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}
