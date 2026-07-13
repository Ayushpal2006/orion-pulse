import dbProxy from "../database";
import { databaseConfig } from "../config/database";
import { IProductRepository } from "./interfaces/IProductRepository";
import { ICustomerRepository } from "./interfaces/ICustomerRepository";
import { ISaleRepository } from "./interfaces/ISaleRepository";
import { ICheckoutRepository } from "./interfaces/ICheckoutRepository";
import { IDashboardRepository } from "./interfaces/IDashboardRepository";
import { IReportsRepository } from "./interfaces/IReportsRepository";
import { ISettingsRepository } from "./interfaces/ISettingsRepository";
import { ISyncRepository } from "./interfaces/ISyncRepository";

import { SQLiteProductRepository } from "./sqlite/product.repository";
import { SQLiteCustomerRepository } from "./sqlite/customer.repository";
import { SQLiteSaleRepository } from "./sqlite/sale.repository";
import { SQLiteCheckoutRepository } from "./sqlite/checkout.repository";
import { SQLiteDashboardRepository } from "./sqlite/dashboard.repository";
import { SQLiteReportsRepository } from "./sqlite/reports.repository";
import { SQLiteSettingsRepository } from "./sqlite/settings.repository";
import { SQLiteSyncRepository } from "./sqlite/sync.repository";

import { PostgresProductRepository } from "./postgres/product.repository";
import { PostgresCustomerRepository } from "./postgres/customer.repository";
import { PostgresSaleRepository } from "./postgres/sale.repository";
import { PostgresCheckoutRepository } from "./postgres/checkout.repository";
import { PostgresDashboardRepository } from "./postgres/dashboard.repository";
import { PostgresReportsRepository } from "./postgres/reports.repository";
import { PostgresSettingsRepository } from "./postgres/settings.repository";
import { PostgresSyncRepository } from "./postgres/sync.repository";

export let productRepository: IProductRepository;
export let customerRepository: ICustomerRepository;
export let saleRepository: ISaleRepository;
export let checkoutRepository: ICheckoutRepository;
export let dashboardRepository: IDashboardRepository;
export let reportsRepository: IReportsRepository;
export let settingsRepository: ISettingsRepository;
export let syncRepository: ISyncRepository;

export function initializeRepositories(): void {
  if (databaseConfig.type === "postgres") {
    productRepository = new PostgresProductRepository(dbProxy);
    customerRepository = new PostgresCustomerRepository(dbProxy);
    saleRepository = new PostgresSaleRepository(dbProxy);
    checkoutRepository = new PostgresCheckoutRepository(dbProxy);
    dashboardRepository = new PostgresDashboardRepository(dbProxy);
    reportsRepository = new PostgresReportsRepository(dbProxy);
    settingsRepository = new PostgresSettingsRepository(dbProxy);
    syncRepository = new PostgresSyncRepository(dbProxy);
  } else {
    productRepository = new SQLiteProductRepository(dbProxy);
    customerRepository = new SQLiteCustomerRepository(dbProxy);
    saleRepository = new SQLiteSaleRepository(dbProxy);
    checkoutRepository = new SQLiteCheckoutRepository(dbProxy);
    dashboardRepository = new SQLiteDashboardRepository(dbProxy);
    reportsRepository = new SQLiteReportsRepository(dbProxy);
    settingsRepository = new SQLiteSettingsRepository(dbProxy);
    syncRepository = new SQLiteSyncRepository(dbProxy);
  }
}

// Automatically initialize repositories on module import
initializeRepositories();
