/**
 * Apka Bill Mobile - Authenticated POS & Local-First Offline Billing Screen
 *
 * Phase 6 Capabilities:
 * - Offline Product Catalog & Instant Search
 * - Interactive POS Cart (Add, Increase, Decrease, Remove)
 * - Customer Details & Payment Method Selection (Cash / UPI / Card)
 * - Real-time Deterministic Calculation (Subtotal, GST, Grand Total)
 * - Atomic Offline Checkout in SQLite (Sale, Items, Payment, Inventory Movement, Sync Queue)
 * - Offline Sales History View with Server Association
 * - Real-time Sync Queue Badge ("ALL BILLS SYNCED" vs "⏳ N BILLS WAITING")
 * - Manual "Sync Bills" Upload Trigger
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components';
import { CONFIG } from '../config/env';
import { ApiClient } from '../api/client';
import {
  initDatabase,
  ProductRepository,
  CustomerRepository,
  StoreRepository,
  SaleRepository,
  SyncQueueRepository,
  LocalProduct,
  LocalStore,
  LocalSale,
  CartItem,
} from '../db';
import { SyncService, syncStateManager, SyncState } from '../sync';
import { LocalBillingService } from '../services';

export const HomeScreen: React.FC = () => {
  const { user, organization, store: authStore, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [dbReady, setDbReady] = useState<boolean>(false);

  // Sync state
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState());
  const [pendingBills, setPendingBills] = useState<number>(0);

  // Local SQLite state
  const [localStore, setLocalStore] = useState<LocalStore | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [offlineSales, setOfflineSales] = useState<LocalSale[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLatencyMs, setSearchLatencyMs] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Active View Tab ('pos' | 'history')
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  // POS Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [syncingBills, setSyncingBills] = useState<boolean>(false);

  // 1. Subscribe to Sync State
  useEffect(() => {
    const unsubscribe = syncStateManager.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // 2. Initialize SQLite Database & Load Local Data
  const loadLocalData = useCallback(async () => {
    try {
      await initDatabase();
      await syncStateManager.init();
      setDbReady(true);

      const storeId = authStore?.id || (user?.store_id as number) || 1;
      const [cachedStore, localProds, recentSales, pendingCount] = await Promise.all([
        StoreRepository.getStore(storeId),
        ProductRepository.getAll({ storeId, limit: 100 }),
        SaleRepository.getAllSales(storeId, 20),
        SyncQueueRepository.countPending(),
      ]);

      setLocalStore(cachedStore);
      setProducts(localProds);
      setOfflineSales(recentSales);
      setPendingBills(pendingCount);
    } catch (err: any) {
      console.error('[HomeScreen] Error loading local SQLite data:', err);
      setStatusMessage(`DB Error: ${err.message}`);
    }
  }, [authStore?.id, user?.store_id]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // 3. Instant Offline Search from SQLite
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      const startTime = Date.now();
      try {
        const storeId = authStore?.id || (user?.store_id as number) || 1;
        const results = await ProductRepository.search(query, storeId, 100);
        const elapsed = Date.now() - startTime;
        setProducts(results);
        setSearchLatencyMs(elapsed);
      } catch (err: any) {
        console.error('[HomeScreen] Search error:', err);
      }
    },
    [authStore?.id, user?.store_id]
  );

  // 4. Cart Operations
  const addToCart = (product: LocalProduct) => {
    if (product.stock <= 0) {
      Alert.alert('Out of Stock', `"${product.name}" is currently out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert('Stock Limit Reached', `Only ${product.stock} units available.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const increaseQuantity = (productId: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (item.quantity >= item.product.stock) {
            Alert.alert('Stock Limit', `Cannot exceed available stock (${item.product.stock}).`);
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQuantity = (productId: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // 5. Checkout Calculations
  const totals = LocalBillingService.calculateTotals(cart);

  // 6. Complete Offline Checkout (Creates Sale + Sync Queue Entry Atomically)
  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart before checking out.');
      return;
    }

    setCheckingOut(true);
    const storeId = authStore?.id || (user?.store_id as number) || 1;
    const orgId = organization?.id || (user?.organization_id as number) || 1;

    try {
      const checkoutRes = await LocalBillingService.checkout({
        storeId,
        organizationId: orgId,
        items: cart,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        cashierName: user?.name || 'Cashier',
        paymentMethod,
        discount: 0,
      });

      if (checkoutRes.success && checkoutRes.sale) {
        setStatusMessage(
          `✅ Offline Sale Created: ${checkoutRes.sale.local_invoice_number} (₹${(checkoutRes.sale.grand_total / 100).toFixed(2)}) • PENDING SYNC`
        );
        clearCart();
        setCustomerName('');
        setCustomerPhone('');
        await loadLocalData();
      } else {
        setStatusMessage(`❌ Checkout Failed: ${checkoutRes.error}`);
        Alert.alert('Checkout Failed', checkoutRes.error || 'Transaction rejected.');
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    } finally {
      setCheckingOut(false);
    }
  };

  // 7. Upload Offline Bills to Server
  const handleSyncBills = async () => {
    setSyncingBills(true);
    setStatusMessage('Uploading offline sales to server...');
    try {
      const apiClient = new ApiClient(CONFIG.apiBaseUrl);
      const queueRes = await SyncService.syncSalesQueue(apiClient);
      if (queueRes.succeeded > 0) {
        setStatusMessage(`✅ Uploaded ${queueRes.succeeded} offline bills to server!`);
      } else if (queueRes.failed > 0) {
        setStatusMessage(`⚠️ ${queueRes.failed} bills failed to upload (saved locally for retry).`);
      } else {
        setStatusMessage('No offline bills pending sync.');
      }
      await loadLocalData();
    } catch (err: any) {
      setStatusMessage(`⚠️ Bill upload offline: ${err.message}.`);
    } finally {
      setSyncingBills(false);
    }
  };

  // 8. Catalog Sync
  const handleTriggerCatalogSync = async () => {
    setStatusMessage('Syncing catalog with server...');
    try {
      const apiClient = new ApiClient(CONFIG.apiBaseUrl);
      const storeId = authStore?.id || (user?.store_id as number) || 1;
      const result = await SyncService.syncAll(apiClient, { storeId });
      if (result.success) {
        setStatusMessage(`✅ Synced: ${result.productsCount} prods, ${result.customersCount} custs.`);
        await loadLocalData();
      } else {
        setStatusMessage(`⚠️ Sync Notice: ${result.error}. Using local SQLite.`);
      }
    } catch (err: any) {
      setStatusMessage(`⚠️ Sync offline: ${err.message}. Using local SQLite.`);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const formatPrice = (p: number) => `₹${(p / 100).toFixed(2)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.appTitle}>Apka Bill POS</Text>
            <View style={styles.badgeGroup}>
              {pendingBills > 0 ? (
                <TouchableOpacity
                  style={[styles.pendingBillsBadge, { backgroundColor: '#854D0E' }]}
                  onPress={handleSyncBills}
                  disabled={syncingBills}
                >
                  <Text style={styles.pendingBillsBadgeText}>
                    {syncingBills ? 'SYNCING...' : `⏳ ${pendingBills} BILLS WAITING`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.sqliteBadge}>
                  <Text style={styles.sqliteBadgeText}>ALL BILLS SYNCED</Text>
                </View>
              )}
              <View
                style={[
                  styles.syncBadge,
                  { backgroundColor: syncState.status === 'success' ? '#065F46' : '#854D0E', marginLeft: 6 },
                ]}
              >
                <Text style={styles.syncBadgeText}>
                  {syncState.status === 'success' ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.appSubtitle}>
            Store: {localStore?.name || authStore?.name || 'Local Outlet'} • Cashier: {user?.name || 'Cashier'}
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'pos' && styles.tabActive]}
            onPress={() => setActiveTab('pos')}
          >
            <Text style={[styles.tabText, activeTab === 'pos' && styles.tabTextActive]}>
              🛒 POS Terminal ({cart.reduce((a, b) => a + b.quantity, 0)})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              📋 Offline Sales ({offlineSales.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Banner */}
        {!!statusMessage && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusMessage}</Text>
          </View>
        )}

        {activeTab === 'pos' ? (
          <View style={styles.posLayout}>
            {/* Left: Product Catalog & Search */}
            <View style={styles.catalogPanel}>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Search products by name, SKU, barcode..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
              />
              {searchLatencyMs > 0 && (
                <Text style={styles.latencyText}>Query: {searchLatencyMs}ms</Text>
              )}

              <FlatList
                data={products}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.catalogItem}
                    onPress={() => addToCart(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.catalogItemInfo}>
                      <Text style={styles.catalogItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.catalogItemSku}>
                        SKU: {item.sku} • Stock: {item.stock}
                      </Text>
                    </View>
                    <View style={styles.catalogItemRight}>
                      <Text style={styles.catalogItemPrice}>{formatPrice(item.selling_price)}</Text>
                      <Text
                        style={[
                          styles.stockBadge,
                          item.stock <= 0 ? styles.stockOut : styles.stockIn,
                        ]}
                      >
                        {item.stock > 0 ? '+ Add' : 'Out'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Right: Cart & Checkout Drawer */}
            <View style={styles.cartPanel}>
              <View style={styles.cartHeader}>
                <Text style={styles.cartTitle}>Cart ({cart.length})</Text>
                {cart.length > 0 && (
                  <TouchableOpacity onPress={clearCart}>
                    <Text style={styles.clearCartText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              {cart.length === 0 ? (
                <View style={styles.cartEmpty}>
                  <Text style={styles.cartEmptyText}>Cart is empty</Text>
                  <Text style={styles.cartEmptySub}>Tap products on the left to add</Text>
                </View>
              ) : (
                <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
                  {cart.map((item) => (
                    <View key={item.product.id} style={styles.cartItem}>
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.cartItemUnitPrice}>
                          {formatPrice(item.product.selling_price)} each
                        </Text>
                      </View>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => decreaseQuantity(item.product.id)}
                        >
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => increaseQuantity(item.product.id)}
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Customer Inputs */}
              <View style={styles.customerBox}>
                <TextInput
                  style={styles.customerInput}
                  placeholder="Customer Phone (Optional)"
                  placeholderTextColor="#64748B"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.paymentSelector}>
                {(['Cash', 'UPI', 'Card'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.paymentOption,
                      paymentMethod === method && styles.paymentOptionActive,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.paymentText,
                        paymentMethod === method && styles.paymentTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order Summary & Totals */}
              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalVal}>{formatPrice(totals.subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST (Tax)</Text>
                  <Text style={styles.totalVal}>{formatPrice(totals.totalGst)}</Text>
                </View>
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalVal}>{formatPrice(totals.grandTotal)}</Text>
                </View>
              </View>

              {/* Checkout Button */}
              <Button
                title={checkingOut ? 'Processing...' : `⚡ Checkout (${formatPrice(totals.grandTotal)})`}
                onPress={handleCheckout}
                loading={checkingOut}
                disabled={checkingOut || cart.length === 0}
                variant="primary"
                style={styles.checkoutBtn}
              />
            </View>
          </View>
        ) : (
          /* Offline Sales History View */
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Locally Persisted Offline Sales</Text>
              <Text style={styles.historySub}>Saved in SQLite</Text>
            </View>

            {offlineSales.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No offline sales created yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete a sale in the POS tab to view offline receipts here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={offlineSales}
                keyExtractor={(item) => item.local_id}
                renderItem={({ item }) => (
                  <View style={styles.saleCard}>
                    <View style={styles.saleMain}>
                      <Text style={styles.saleInvoice}>
                        {item.invoice_number ? `Server: ${item.invoice_number}` : item.local_invoice_number}
                      </Text>
                      <Text style={styles.saleCustomer}>
                        Customer: {item.customer_name || item.customer_phone || 'Walk-in'} •{' '}
                        {new Date(item.created_at).toLocaleTimeString()}
                      </Text>
                      <Text style={styles.saleMethod}>Payment: {item.payment_method}</Text>
                    </View>
                    <View style={styles.saleRight}>
                      <Text style={styles.saleAmount}>{formatPrice(item.grand_total)}</Text>
                      <View
                        style={[
                          styles.pendingBadge,
                          {
                            backgroundColor: item.sync_status === 'SYNCED' ? '#065F46' : '#854D0E',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pendingBadgeText,
                            { color: item.sync_status === 'SYNCED' ? '#D1FAE5' : '#FEF08A' },
                          ]}
                        >
                          {item.sync_status}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* Footer Actions */}
        <View style={styles.footerToolbar}>
          <TouchableOpacity style={styles.footerAction} onPress={handleSyncBills}>
            <Text style={[styles.footerActionText, { color: '#34D399' }]}>
              📤 Sync Bills ({pendingBills})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction} onPress={handleTriggerCatalogSync}>
            <Text style={styles.footerActionText}>🔄 Sync Catalog</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction} onPress={handleLogout}>
            <Text style={[styles.footerActionText, { color: '#F87171' }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    padding: 12,
  },
  header: {
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sqliteBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  sqliteBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D1FAE5',
  },
  pendingBillsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pendingBillsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FEF08A',
    letterSpacing: 0.5,
  },
  syncBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FEF08A',
  },
  appSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  statusBanner: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
  },
  statusBannerText: {
    fontSize: 11,
    color: '#E0F2FE',
    fontWeight: '500',
  },
  posLayout: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  catalogPanel: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    marginRight: Platform.OS === 'web' ? 8 : 0,
    marginBottom: Platform.OS === 'web' ? 0 : 8,
  },
  searchInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#F8FAFC',
  },
  latencyText: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  catalogItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  catalogItemSku: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  catalogItemRight: {
    alignItems: 'flex-end',
  },
  catalogItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  stockBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  stockIn: {
    color: '#34D399',
  },
  stockOut: {
    color: '#F87171',
  },
  cartPanel: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-between',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  clearCartText: {
    fontSize: 11,
    color: '#F87171',
    fontWeight: '600',
  },
  cartEmpty: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cartEmptySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cartList: {
    maxHeight: 120,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  cartItemUnitPrice: {
    fontSize: 10,
    color: '#94A3B8',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    backgroundColor: '#334155',
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    marginHorizontal: 8,
  },
  customerBox: {
    marginVertical: 4,
  },
  customerInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    color: '#F8FAFC',
  },
  paymentSelector: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  paymentOptionActive: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  paymentTextActive: {
    color: '#F8FAFC',
  },
  totalsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  totalVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 3,
    paddingTop: 3,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  grandTotalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  checkoutBtn: {
    paddingVertical: 8,
  },
  historyPanel: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
  },
  historyHeader: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  historySub: {
    fontSize: 11,
    color: '#34D399',
    marginTop: 2,
  },
  saleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  saleMain: {
    flex: 1,
    marginRight: 8,
  },
  saleInvoice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  saleCustomer: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  saleMethod: {
    fontSize: 10,
    color: '#64748B',
  },
  saleRight: {
    alignItems: 'flex-end',
  },
  saleAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  pendingBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  footerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  footerAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
});

export default HomeScreen;
