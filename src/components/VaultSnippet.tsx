import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HapticsService } from '../services/haptics';

interface VaultSnippetProps {
  totalSaved: number;
  onPress: () => void;
}

export const VaultSnippet: React.FC<VaultSnippetProps> = ({ totalSaved, onPress }) => {
  const formatted = totalSaved.toLocaleString('zh-CN');

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.8}
      onPress={() => {
        HapticsService.lightTap();
        onPress();
      }}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Vault Snippet</Text>
          <Text style={styles.arrow}>›</Text>
        </View>
        <Text style={styles.amount}>¥{formatted}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>已存 ¥{formatted}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  content: {
    alignItems: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  arrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
    fontWeight: '700',
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#CBD5E1',
  },
});
