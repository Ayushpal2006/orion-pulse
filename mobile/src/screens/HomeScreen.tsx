/**
 * Apka Bill Mobile - Authenticated Home & Local SQLite Verification Screen
 *
 * Requirements:
 * - Displays Store Name, Product Count, Customer Count from Local SQLite
 * - Displays searchable list of products read strictly from Local SQLite
 * - Displays "Data source: LOCAL SQLITE" indicator
 * - Downloads catalog from existing REST API into SQLite on demand
 * - Proves offline capability: works instantly when backend / network is unavailable
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge } from '../components';
import { CONFIG } from '../config/env';
import { ApiClient } from '../api/client';
import {
  initDatabase,
  ProductRepository,
  CustomerRepository,
  StoreRepository,
  LocalProduct,
  LocalStore,
} from '../db';
import { PosDataService } from '../services/pos-data.service';

export const HomeScreen: React.FC = () => {
  const { user, organization, store: authStore, logout, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [dbReady, setDbReady] = useState<boolean>(false);

  // Local SQLite state
  const [localStore, setLocalStore] = useState<LocalStore | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLatencyMs, setSearchLatencyMs] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Initialize SQLite Database & Load Local Data
  const loadLocalData = useCallback(async () => {
    try {
      await initDatabase();
      setDbReady(true);

      const storeId = authStore?.id || (user?.store_id as number) || undefined;
      const [cachedStore, pCount, cCount, localProds] = await Promise.all([
        StoreRepository.getStore(storeId),
        ProductRepository.count(storeId),
        CustomerRepository.count(storeId),
        ProductRepository.getAll({ storeId, limit: 100 }),
      ]);

      setLocalStore(cachedStore);
      setProductCount(pCount);
      setCustomerCount(cCount);
      setProducts(localProds);
    } catch (err: any) {
      console.error('[HomeScreen] Error loading local SQLite data:', err);
      setStatusMessage(`DB Error: ${err.message}`);
    }
  }, [authStore?.id, user?.store_id]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // 2. Instant Offline Search from SQLite
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      const startTime = Date.now();
      try {
        const storeId = authStore?.id || (user?.store_id as number) || undefined;
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

  // 3. Download Catalog from Existing REST API into SQLite
  const handleDownloadCatalog = async () => {
    setDownloading(true);
    setStatusMessage('Downloading catalog from API...');
    try {
      const apiClient = new ApiClient(CONFIG.apiBaseUrl);
      const storeId = authStore?.id || (user?.store_id as number) || undefined;
      const syncResult = await PosDataService.downloadCatalog(apiClient, storeId);

      if (syncResult.success) {
        setStatusMessage(
          `✅ Ingested ${syncResult.productsDownloaded} products & ${syncResult.customersDownloaded} customers into SQLite.`
        );
        await loadLocalData();
      } else {
        setStatusMessage(`⚠️ Download warning: ${syncResult.error || 'Partial ingestion'}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Download failed: ${err.message}. Using cached SQLite data.`);
    } finally {
      setDownloading(false);
    }
  };

  // 4. Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const renderProductItem = ({ item }: { item: LocalProduct }) => {
    const formattedPrice =
      item.selling_price > 1000 && item.selling_price % 100 === 0
        ? `₹${(item.selling_price / 100).toFixed(2)}`
        : `₹${item.selling_price}`;

    return (
      <View style={styles.productCard}>
        <View style={styles.productMain}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.productMetaRow}>
            <Text style={styles.productSku}>SKU: {item.sku}</Text>
            {!!item.barcode && <Text style={styles.productBarcode}>• Barcode: {item.barcode}</Text>}
          </View>
        </View>
        <View style={styles.productRight}>
          <Text style={styles.productPrice}>{formattedPrice}</Text>
          <Text style={[styles.productStock, item.stock <= 0 ? styles.stockOut : styles.stockIn]}>
            {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.appTitle}>Apka Bill POS</Text>
            <View style={styles.sqliteBadge}>
              <Text style={styles.sqliteBadgeText}>DATA SOURCE: LOCAL SQLITE</Text>
            </View>
          </View>
          <Text style={styles.appSubtitle}>
            Store: {localStore?.name || authStore?.name || 'Local Outlet'} • User: {user?.name || 'Cashier'}
          </Text>
        </View>

        {/* Status / Metric Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>LOCAL PRODUCTS</Text>
            <Text style={styles.metricValue}>{productCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>LOCAL CUSTOMERS</Text>
            <Text style={styles.metricValue}>{customerCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>SQLITE ENGINE</Text>
            <Text style={[styles.metricValue, { fontSize: 13, color: '#34D399' }]}>
              {dbReady ? 'WAL ACTIVE' : 'INITIALIZING'}
            </Text>
          </View>
        </View>

        {/* Sync & Action Toolbar */}
        <View style={styles.toolbar}>
          <Button
            title={downloading ? 'Syncing...' : '⬇ Download Catalog'}
            onPress={handleDownloadCatalog}
            loading={downloading}
            disabled={downloading || loggingOut}
            variant="primary"
            style={styles.toolButton}
          />
          <Button
            title={loggingOut ? '...' : 'Log Out'}
            onPress={handleLogout}
            loading={loggingOut}
            disabled={loggingOut || downloading}
            variant="secondary"
            style={styles.logoutButton}
          />
        </View>

        {/* Status Banner */}
        {!!statusMessage && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusMessage}</Text>
          </View>
        )}

        {/* Offline Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search offline by product name, SKU, or barcode..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchLatencyMs > 0 && (
            <Text style={styles.latencyText}>Query: {searchLatencyMs}ms</Text>
          )}
        </View>

        {/* Product List from Local SQLite */}
        <View style={styles.listContainer}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>
              Local Catalog ({products.length} {products.length === 1 ? 'item' : 'items'})
            </Text>
            <Text style={styles.listHeaderSub}>Zero Network Required</Text>
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching products found' : 'No local products cached'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try searching with a different keyword or barcode.'
                  : 'Tap "Download Catalog" above to sync products from the server into SQLite.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderProductItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Protected: No direct Neon PostgreSQL access • Client reads strictly from SQLite
          </Text>
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
    padding: 14,
  },
  header: {
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  sqliteBadge: {
    backgroundColor: '#065F46',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sqliteBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D1FAE5',
    letterSpacing: 0.6,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  toolbar: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  toolButton: {
    flex: 3,
    marginRight: 8,
    paddingVertical: 10,
  },
  logoutButton: {
    flex: 1,
    paddingVertical: 10,
  },
  statusBanner: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  statusBannerText: {
    fontSize: 12,
    color: '#E0F2FE',
    fontWeight: '500',
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F8FAFC',
  },
  latencyText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  listHeaderSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
  },
  listContent: {
    paddingBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  productMain: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productSku: {
    fontSize: 11,
    color: '#94A3B8',
  },
  productBarcode: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  productRight: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38BDF8',
  },
  productStock: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  stockIn: {
    color: '#34D399',
  },
  stockOut: {
    color: '#F87171',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default HomeScreen;
