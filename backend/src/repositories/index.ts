import { IProductRepository } from "./interfaces/IProductRepository";
import { ICustomerRepository } from "./interfaces/ICustomerRepository";
import { ISaleRepository } from "./interfaces/ISaleRepository";
import { ICheckoutRepository } from "./interfaces/ICheckoutRepository";
import { IDashboardRepository } from "./interfaces/IDashboardRepository";
import { IReportsRepository } from "./interfaces/IReportsRepository";
import { ISettingsRepository } from "./interfaces/ISettingsRepository";
import { ISyncRepository } from "./interfaces/ISyncRepository";
import { ISupplierRepository } from "./interfaces/ISupplierRepository";
import { IPurchaseRepository } from "./interfaces/IPurchaseRepository";
import { IStockAdjustmentRepository } from "./interfaces/IStockAdjustmentRepository";
import { ISupplierPaymentRepository } from "./interfaces/ISupplierPaymentRepository";
import { ISupplierLedgerRepository } from "./interfaces/ISupplierLedgerRepository";
import { IProfitRepository } from "./interfaces/IProfitRepository";

import { PostgresProductRepository } from "./postgres/product.repository";
import { PostgresCustomerRepository } from "./postgres/customer.repository";
import { PostgresSaleRepository } from "./postgres/sale.repository";
import { PostgresCheckoutRepository } from "./postgres/checkout.repository";
import { PostgresDashboardRepository } from "./postgres/dashboard.repository";
import { PostgresReportsRepository } from "./postgres/reports.repository";
import { PostgresSettingsRepository } from "./postgres/settings.repository";
import { PostgresSyncRepository } from "./postgres/sync.repository";
import { PostgresSupplierRepository } from "./postgres/supplier.repository";
import { PostgresPurchaseRepository } from "./postgres/purchase.repository";
import { PostgresStockAdjustmentRepository } from "./postgres/stock-adjustment.repository";
import { PostgresSupplierPaymentRepository } from "./postgres/supplier-payment.repository";
import { PostgresSupplierLedgerRepository } from "./postgres/supplier-ledger.repository";
import { PostgresProfitRepository } from "./postgres/profit.repository";

export let productRepository: IProductRepository;
export let customerRepository: ICustomerRepository;
export let saleRepository: ISaleRepository;
export let checkoutRepository: ICheckoutRepository;
export let dashboardRepository: IDashboardRepository;
export let reportsRepository: IReportsRepository;
export let settingsRepository: ISettingsRepository;
export let syncRepository: ISyncRepository;
export let supplierRepository: ISupplierRepository;
export let purchaseRepository: IPurchaseRepository;
export let stockAdjustmentRepository: IStockAdjustmentRepository;
export let supplierPaymentRepository: ISupplierPaymentRepository;
export let supplierLedgerRepository: ISupplierLedgerRepository;
export let profitRepository: IProfitRepository;

export function initializeRepositories(): void {
  productRepository = new PostgresProductRepository();
  customerRepository = new PostgresCustomerRepository();
  saleRepository = new PostgresSaleRepository();
  checkoutRepository = new PostgresCheckoutRepository();
  dashboardRepository = new PostgresDashboardRepository();
  reportsRepository = new PostgresReportsRepository();
  settingsRepository = new PostgresSettingsRepository();
  syncRepository = new PostgresSyncRepository();
  supplierRepository = new PostgresSupplierRepository();
  purchaseRepository = new PostgresPurchaseRepository();
  stockAdjustmentRepository = new PostgresStockAdjustmentRepository();
  supplierPaymentRepository = new PostgresSupplierPaymentRepository();
  supplierLedgerRepository = new PostgresSupplierLedgerRepository();
  profitRepository = new PostgresProfitRepository();
}

// Automatically initialize repositories on module import
initializeRepositories();
