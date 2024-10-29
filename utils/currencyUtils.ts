import Money from './Money';

export const formatCurrency = (amount: Money | number): string => {
  if (amount instanceof Money) {
    return amount.toString();
  }
  return Money.fromDollars(amount).toString();
};

export { Money };