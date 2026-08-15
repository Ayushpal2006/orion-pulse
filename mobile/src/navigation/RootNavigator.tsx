/**
 * Apka Bill Mobile - Root Navigator
 *
 * Switches between:
 * - Loading screen (during cold-start session verification)
 * - Authenticated application (HomeScreen)
 * - Unauthenticated flow (LoginScreen)
 */

import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingTitle}>Apka Bill Mobile</Text>
          <Text style={styles.loadingSub}>Verifying secure session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return isAuthenticated ? <HomeScreen /> : <LoginScreen />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  loadingSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#94A3B8',
  },
});

export default RootNavigator;
