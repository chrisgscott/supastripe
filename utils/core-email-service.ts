import fetch from 'node-fetch';

const brevoApiKey = process.env.BREVO_API_KEY;

if (!brevoApiKey) {
  throw new Error('BREVO_API_KEY is not set in the environment variables');
}

interface EmailParams {
  [key: string]: string | number;
}

export async function sendEmail(to: string, templateId: number, params: EmailParams): Promise<boolean> {
  const emailData = {
    to: [{ email: to }],
    templateId: templateId,
    params: params
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      } as Record<string, string>,
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${await response.text()}`);
    }

    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
