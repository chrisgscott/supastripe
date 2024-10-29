class Money {
  private cents: number;

  constructor(amount: number, isCents: boolean = false) {
    this.cents = isCents ? Math.round(amount) : Math.round(amount * 100);
  }

  static fromCents(cents: number): Money {
    return new Money(cents, true);
  }

  static fromDollars(dollars: number): Money {
    return new Money(dollars);
  }

  toCents(): number {
    return this.cents;
  }

  toDollars(): number {
    return Number((this.cents / 100).toFixed(2));
  }

  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return Money.fromCents(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return Money.fromCents(Math.round(this.cents * factor));
  }

  divide(divisor: number): Money {
    return Money.fromCents(Math.round(this.cents / divisor));
  }

  toString(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(this.toDollars());
  }

  percentageOf(total: Money): number {
    return (this.cents / total.cents) * 100;
  }
}

export default Money;
