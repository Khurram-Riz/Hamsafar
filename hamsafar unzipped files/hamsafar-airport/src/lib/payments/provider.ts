import { DepositStatus, PaymentMethod, PaymentStatus } from '@/types/database';

export interface PaymentAuthorizationInput {
  bookingCode: string;
  amountPkr: number;
  depositPkr: number;
  method: PaymentMethod;
}

export interface PaymentAuthorizationResult {
  paymentStatus: PaymentStatus;
  depositStatus: DepositStatus;
  referenceId: string;
  message: string;
}

export interface PaymentProvider {
  authorizeBooking(
    input: PaymentAuthorizationInput
  ): Promise<PaymentAuthorizationResult>;
  refundDeposit(bookingCode: string, depositPkr: number): Promise<DepositStatus>;
  forfeitDeposit(bookingCode: string, depositPkr: number): Promise<DepositStatus>;
}

export class MockPaymentProvider implements PaymentProvider {
  async authorizeBooking(
    input: PaymentAuthorizationInput
  ): Promise<PaymentAuthorizationResult> {
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const depositStatus: DepositStatus = input.depositPkr > 0 ? 'held' : 'none';

    if (input.method === 'cash') {
      return {
        paymentStatus: 'pending',
        depositStatus,
        referenceId: `CASH-${suffix}`,
        message: 'Pay fixed fare directly to your verified driver upon boarding.',
      };
    }

    const walletLabel =
      input.method === 'easypaisa' ? 'Easypaisa (Simulated)' : 'JazzCash (Simulated)';
    return {
      paymentStatus: 'paid',
      depositStatus,
      referenceId: `${input.method.toUpperCase()}-MOCK-${suffix}`,
      message: `${walletLabel} payment of Rs ${input.amountPkr} authorized.`,
    };
  }

  async refundDeposit(
    bookingCode: string,
    depositPkr: number
  ): Promise<DepositStatus> {
    if (depositPkr <= 0) return 'none';
    console.info(
      `[Hamsafar Payments] Refunded Rs ${depositPkr} deposit for ${bookingCode}`
    );
    return 'refunded';
  }

  async forfeitDeposit(
    bookingCode: string,
    depositPkr: number
  ): Promise<DepositStatus> {
    if (depositPkr <= 0) return 'none';
    console.info(
      `[Hamsafar Payments] Forfeited Rs ${depositPkr} deposit due to no-show for ${bookingCode}`
    );
    return 'forfeited';
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}
