import { Money } from './currencyUtils';

export const calculateApplicationFee = (amount: Money): number => {
  const FEE_PERCENTAGE = Number(process.env.FEE_PERCENTAGE || 2);
  return Math.floor(amount.toCents() * (FEE_PERCENTAGE / 100));
};