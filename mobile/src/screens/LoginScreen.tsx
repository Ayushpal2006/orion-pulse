/**
 * Apka Bill Mobile - Login Screen
 *
 * Handles:
 * - Email / Username input
 * - Password input
 * - Loading state
 * - Invalid credentials error banner (401)
 * - Disabled account / Forbidden banner (403)
 * - Network / Server error banner (500 / Timeout)
 * - Successful login state transition
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Badge } from '../components';
import { CONFIG } from '../config/env';
import { ApiClientError } from '../api/client';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'auth' | 'network' | 'server' | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email/username and password');
      setErrorType('auth');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setErrorMessage(err.message || 'Invalid email or password');
          setErrorType('auth');
        } else if (err.statusCode === 403) {
          setErrorMessage(err.message || 'Account disabled or organization suspended');
          setErrorType('auth');
        } else if (err.statusCode >= 500) {
          setErrorMessage(`Server error (${err.statusCode}): ${err.message}`);
          setErrorType('server');
        } else if (err.statusCode === 408 || err.statusCode === 0) {
          setErrorMessage(`Network error: ${err.message}`);
          setErrorType('network');
        } else {
          setErrorMessage(err.message || 'Authentication failed');
          setErrorType('auth');
        }
      } else {
        setErrorMessage(err?.message || 'Unable to connect to backend server');
        setErrorType('network');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header & Logo */}
          <View style={styles.header}>
            <Text style={styles.brandTitle}>Apka Bill</Text>
            <Text style={styles.brandSubtitle}>Android POS Client</Text>
            <View style={styles.envBadge}>
              <Badge
                label={`Env: ${CONFIG.env.toUpperCase()} • ${CONFIG.apiBaseUrl}`}
                variant="neutral"
              />
            </View>
          </View>

          {/* Login Card */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Use your Apka Bill staff / admin credentials</Text>

            {/* Error Display Banner */}
            {!!errorMessage && (
              <View
                style={[
                  styles.errorBanner,
                  errorType === 'network' ? styles.networkErrorBanner : styles.authErrorBanner,
                ]}
              >
                <Text style={styles.errorTitle}>
                  {errorType === 'network'
                    ? 'Connection Error'
                    : errorType === 'server'
                    ? 'Server Error'
                    : 'Authentication Failed'}
                </Text>
                <Text style={styles.errorMessageText}>{errorMessage}</Text>
              </View>
            )}

            <Input
              label="Email or Username"
              placeholder="admin@apkabill.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!loading}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              isPassword
              editable={!loading}
            />

            <View style={styles.buttonContainer}>
              <Button
                title={loading ? 'Signing In...' : 'Sign In'}
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                variant="primary"
              />
            </View>
          </Card>

          {/* Architecture Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Security: Direct Neon DB connections are prohibited.
            </Text>
            <Text style={styles.footerTextSub}>
              Mobile → REST API → Express Backend → Neon PostgreSQL
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  envBadge: {
    marginTop: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  authErrorBanner: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  networkErrorBanner: {
    backgroundColor: '#451A03',
    borderColor: '#D97706',
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  errorMessageText: {
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 16,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  footerTextSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default LoginScreen;
