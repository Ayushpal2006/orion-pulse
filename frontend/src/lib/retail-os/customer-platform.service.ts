// Module 3: Customer Platform & Wallet Engine for Apka Bill V2

export type MembershipTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface CustomerWalletRecord {
  customerId: number;
  walletBalance: number;
  loyaltyPoints: number;
  membershipTier: MembershipTier;
  storeCredit: number;
  totalSpent: number;
  totalOrders: number;
}

export class CustomerPlatformService {
  private static instance: CustomerPlatformService;
  private customerWallets: Map<number, CustomerWalletRecord> = new Map();

  public static getInstance(): CustomerPlatformService {
    if (!CustomerPlatformService.instance) {
      CustomerPlatformService.instance = new CustomerPlatformService();
    }
    return CustomerPlatformService.instance;
  }

  getWallet(customerId: number): CustomerWalletRecord {
    if (!this.customerWallets.has(customerId)) {
      this.customerWallets.set(customerId, {
        customerId,
        walletBalance: 0,
        loyaltyPoints: 0,
        membershipTier: "Bronze",
        storeCredit: 0,
        totalSpent: 0,
        totalOrders: 0,
      });
    }
    return this.customerWallets.get(customerId)!;
  }

  addWalletFunds(customerId: number, amount: number): CustomerWalletRecord {
    const w = this.getWallet(customerId);
    w.walletBalance += amount;
    return w;
  }

  deductWalletFunds(customerId: number, amount: number): CustomerWalletRecord {
    const w = this.getWallet(customerId);
    if (w.walletBalance < amount) throw new Error("Insufficient wallet balance");
    w.walletBalance -= amount;
    return w;
  }

  recordSaleTransaction(customerId: number, totalAmount: number): CustomerWalletRecord {
    const w = this.getWallet(customerId);
    w.totalSpent += totalAmount;
    w.totalOrders += 1;

    // Earn 1 loyalty point for every ₹100 spent
    const pointsEarned = Math.floor(totalAmount / 100);
    w.loyaltyPoints += pointsEarned;

    // Upgrade Membership Tier dynamically based on LTV
    if (w.totalSpent >= 100000) {
      w.membershipTier = "Platinum";
    } else if (w.totalSpent >= 50000) {
      w.membershipTier = "Gold";
    } else if (w.totalSpent >= 15000) {
      w.membershipTier = "Silver";
    }

    return w;
  }
}

export const customerPlatformService = CustomerPlatformService.getInstance();
