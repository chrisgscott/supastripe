import fetch from 'node-fetch';

interface EmailParams {
  [key: string]: string | number;
}

export async function sendEmail(to: string, templateId: number, params: EmailParams): Promise<boolean> {
  const brevoApiKey = process.env.BREVO_API_KEY;

  if (!brevoApiKey) {
    throw new Error('BREVO_API_KEY is not set in the environment variables');
  }

  const emailData = {
    to: [{ email: to }],
    templateId: templateId,
    params: params
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
