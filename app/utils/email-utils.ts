import { Tables } from '@/types/supabase';
import { Money } from '@/utils/currencyUtils';
import { format } from 'date-fns';

export const formatPaymentScheduleHtml = (transactions: Tables<'transactions'>[]) => {
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (a.is_downpayment) return -1;
    if (b.is_downpayment) return 1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return `
    <table style="width:100%; border-collapse: collapse; margin-top: 20px; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr>
          <th style="border-bottom: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f9fafb;">Date</th>
          <th style="border-bottom: 1px solid #ddd; padding: 8px; text-align: right; background-color: #f9fafb;">Amount</th>
          <th style="border-bottom: 1px solid #ddd; padding: 8px; text-align: right; background-color: #f9fafb;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${sortedTransactions.map((payment) => `
          <tr>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: left;">
              ${format(new Date(payment.due_date), 'MMM dd, yyyy')}
            </td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: right;">
              ${Money.fromCents(payment.amount).toString()}
            </td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: right;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 12px; 
                ${payment.is_downpayment 
                  ? 'background-color: #f0fdf4; color: #15803d;' 
                  : 'background-color: #f9fafb; color: #4b5563;'
                }">
                ${payment.is_downpayment ? "Paid" : "Scheduled"}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};