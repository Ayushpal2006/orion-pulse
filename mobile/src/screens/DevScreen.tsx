/**
 * Apka Bill Mobile - Foundation Development Screen
 *
 * Displays:
 * - App Title: Apka Bill Mobile
 * - Environment: Development (or Production/Staging)
 * - Backend: <API_BASE_URL>
 * - Connection: Not tested / Connected / Failed
 *
 * Strictly adheres to architectural principle:
 * Mobile -> API -> Backend -> Neon PostgreSQL
 */

import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CONFIG } from '../config/env';
import { apiClient } from '../api/client';
import { Card, Button, Badge } from '../components';
import { ConnectionStatus, HealthCheckResult } from '../types';

export const DevScreen: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus('checking');
    try {
      const result = await apiClient.testConnection('/health');
      setHealthResult(result);
      if (result.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setHealthResult({
        ok: false,
        status: 0,
        statusText: 'Failed',
        responseTimeMs: 0,
        error: err.message || 'Unknown network error',
        url: `${CONFIG.apiBaseUrl}/health`,
      });
    } finally {
      setTesting(false);
    }
  };

  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'checking':
        return { label: 'Checking connection...', variant: 'warning' as const };
      case 'connected':
        return {
          label: `Connected (${healthResult?.status || 200} OK - ${healthResult?.responseTimeMs}ms)`,
          variant: 'success' as const,
        };
      case 'failed':
        return {
          label: `Failed (${healthResult?.error || healthResult?.statusText || 'Unreachable'})`,
          variant: 'error' as const,
        };
      default:
        return { label: 'Not tested', variant: 'neutral' as const };
    }
  };

  const connDisplay = getConnectionDisplay();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* App Title & Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>Apka Bill Mobile</Text>
          <Text style={styles.appSubtitle}>Android-First React Native POS</Text>
        </View>

        {/* Core Foundation Status Card */}
        <Card style={styles.mainCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Environment:</Text>
            <Text style={styles.value}>
              {CONFIG.env === 'development' ? 'Development' : CONFIG.env}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Backend:</Text>
            <Text style={styles.valueMonospace} numberOfLines={2}>
              {CONFIG.apiBaseUrl}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Connection:</Text>
            <View style={styles.badgeContainer}>
              <Badge label={connDisplay.label} variant={connDisplay.variant} />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={testing ? 'Testing Connectivity...' : 'Test Connection'}
              onPress={handleTestConnection}
              loading={testing}
              variant="primary"
            />
          </View>
        </Card>

        {/* Architecture & Flow Banner */}
        <Card style={styles.archCard}>
          <Text style={styles.sectionHeader}>Data Flow Guarantee</Text>
          <Text style={styles.flowText}>
            React Native → REST API → Existing Backend → Neon PostgreSQL
          </Text>
          <Text style={styles.noteText}>
            • The mobile application NEVER connects directly to Neon PostgreSQL.
          </Text>
        </Card>

        {/* Hardware & Module Placeholders */}
        <Card style={styles.moduleCard}>
          <Text style={styles.sectionHeader}>Phase 1 Modules & Roadmap</Text>

          <View style={styles.moduleRow}>
            <View>
              <Text style={styles.moduleName}>Thermal Printer Layer</Text>
              <Text style={styles.moduleSub}>ESC/POS, Bluetooth, USB, POS Terminals</Text>
            </View>
            <Badge label="Placeholder" variant="neutral" />
          </View>

          <View style={styles.divider} />

          <View style={styles.moduleRow}>
            <View>
              <Text style={styles.moduleName}>Barcode Scanner Layer</Text>
              <Text style={styles.moduleSub}>Laser scanner broadcast, USB HID</Text>
            </View>
            <Badge label="Placeholder" variant="neutral" />
          </View>

          <View style={styles.divider} />

          <View style={styles.moduleRow}>
            <View>
              <Text style={styles.moduleName}>Local SQLite Storage</Text>
              <Text style={styles.moduleSub}>Offline POS relational store (Phase 2)</Text>
            </View>
            <Badge label="Phase 2" variant="warning" />
          </View>

          <View style={styles.divider} />

          <View style={styles.moduleRow}>
            <View>
              <Text style={styles.moduleName}>Background Sync Engine</Text>
              <Text style={styles.moduleSub}>Auto delta sync & queue (Phase 3)</Text>
            </View>
            <Badge label="Phase 3" variant="warning" />
          </View>
        </Card>

        {/* Platform Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            OS: {Platform.OS.toUpperCase()} {Platform.Version ? `(v${Platform.Version})` : ''} • Target: Bare RN 0.87.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginTop: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  mainCard: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  infoRow: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  valueMonospace: {
    fontSize: 15,
    fontWeight: '600',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgeContainer: {
    marginTop: 2,
    flexDirection: 'row',
  },
  buttonContainer: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  archCard: {
    backgroundColor: '#1E293B',
    borderColor: '#0284C7',
    borderLeftWidth: 4,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  flowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  moduleCard: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  moduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  moduleSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
});

export default DevScreen;
