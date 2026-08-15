/**
 * Apka Bill Mobile - Root Application Component
 *
 * Integrates:
 * - SafeAreaProvider (Safe area insets for Android and iOS)
 * - AuthProvider (Authentication state and cold-start session verification)
 * - RootNavigator (Switches between LoginScreen and HomeScreen)
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
