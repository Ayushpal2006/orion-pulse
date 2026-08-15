/**
 * Apka Bill Mobile - Root Application Component
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DevScreen } from './src/screens/DevScreen';

export function App() {
  return (
    <SafeAreaProvider>
      <DevScreen />
    </SafeAreaProvider>
  );
}

export default App;
