import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FreezerItem, WishlistItem } from '../types';
import { getSubstitutions } from '../constants/intervention';
import { HapticsService } from '../services/haptics';

interface SubstitutionCardsProps {
  item: FreezerItem;
  onAddWish: (wish: WishlistItem) => void;
}

/**
 * 替代想象：把商品价格换算成具体的生活体验，
 * 并支持一键把替代项加入心愿单（打通 干预 → 心愿 → 奖励 闭环）。
 */
export const SubstitutionCards: React.FC<SubstitutionCardsProps> = ({ item, onAddWish }) => {
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  const substitutions = getSubstitutions(item.price);

  if (substitutions.length === 0) return null;

  const handleAddWish = (subLabel: string, cost: number, key: string) => {
    HapticsService.mediumTap();
    onAddWish({
      id: 'wish-sub-' + Date.now(),
      title: `替代心愿：${subLabel}`,
      cost: Math.max(1, Math.round(cost)),
      costLabel: `目标 ¥${Math.max(1, Math.round(cost)).toLocaleString('zh-CN')}`,
      iconType: 'grid',
      redeemed: false,
      createdAt: Date.now(),
    });
    setAddedKeys((prev) => [...prev, key]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>⚖️ 欲望天平 · 替代生活价值</Text>
        <Text style={styles.badge}>省下 ¥{item.price.toLocaleString('zh-CN')} 等同于</Text>
      </View>

      <View style={styles.grid}>
        {substitutions.map((sub) => {
          const key = sub.label;
          const added = addedKeys.includes(key);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.costItem, added && styles.costItemAdded]}
              activeOpacity={0.8}
              disabled={added}
              onPress={() =>
                handleAddWish(`${sub.count} ${sub.unit}${sub.label}`, sub.count * sub.unitPrice, key)
              }
            >
              <Text style={styles.costEmoji}>{sub.emoji}</Text>
              <Text style={styles.costNum}>
                {sub.count} {sub.unit}
              </Text>
              <Text style={styles.costLabel}>{sub.label}</Text>
              <Text style={[styles.addWishHint, added && styles.addWishHintAdded]}>
                {added ? '✓ 已加入心愿' : '＋ 加入心愿'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  costItem: {
    flex: 1,
    backgroundColor: '#13233F',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  costItemAdded: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  costEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  costNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#38BDF8',
    marginVertical: 2,
  },
  costLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  addWishHint: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 5,
  },
  addWishHintAdded: {
    color: '#10B981',
  },
});
