import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'info' | 'error' | 'neutral';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'info', style }) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: '#064E3B', text: '#34D399', border: '#059669' };
      case 'warning':
        return { bg: '#78350F', text: '#FBBF24', border: '#D97706' };
      case 'error':
        return { bg: '#7F1D1D', text: '#F87171', border: '#DC2626' };
      case 'neutral':
        return { bg: '#1E293B', text: '#94A3B8', border: '#475569' };
      default:
        return { bg: '#1E3A8A', text: '#60A5FA', border: '#2563EB' };
    }
  };

  const colors = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default Badge;
