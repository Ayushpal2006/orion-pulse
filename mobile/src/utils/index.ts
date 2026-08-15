/**
 * Apka Bill Mobile - Utility Functions
 */

import { Platform } from 'react-native';

/**
 * Format currency amount for POS display (INR format by default)
 */
export const formatCurrency = (amount: number, currencySymbol: string = '₹'): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currencySymbol}${formatted}`;
};

/**
 * Get device platform info
 */
export const getPlatformInfo = (): { os: string; isAndroid: boolean; isDev: boolean } => {
  return {
    os: Platform.OS,
    isAndroid: Platform.OS === 'android',
    isDev: __DEV__,
  };
};
