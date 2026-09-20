import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { WishlistItem } from '../../types';
import { HapticsService } from '../../services/haptics';

interface AddWishModalProps {
  visible: boolean;
  onClose: () => void;
  onAddWish: (newWish: WishlistItem) => void;
}

const ICON_OPTIONS: Array<{ type: WishlistItem['iconType']; emoji: string; label: string }> = [
  { type: 'flight', emoji: '✈️', label: '旅行度假' },
  { type: 'game', emoji: '🎮', label: '游戏潮玩' },
  { type: 'headphone', emoji: '🎧', label: '影音数码' },
  { type: 'coffee', emoji: '☕', label: '品质生活' },
  { type: 'book', emoji: '📚', label: '知识提升' },
  { type: 'grid', emoji: '🎁', label: '梦想大件' },
];

export const AddWishModal: React.FC<AddWishModalProps> = ({ visible, onClose, onAddWish }) => {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<WishlistItem['iconType']>('flight');

  const handleConfirm = () => {
    const numCost = parseFloat(cost);
    if (!title.trim()) {
      Alert.alert('提示', '请输入心愿名称');
      return;
    }
    if (isNaN(numCost) || numCost <= 0) {
      Alert.alert('提示', '请输入合理的目标金额');
      return;
    }

    HapticsService.victorySuccess();
    const newWish: WishlistItem = {
      id: 'wish-' + Date.now(),
      title: title.trim(),
      cost: Math.round(numCost),
      costLabel: `目标 ¥${Math.round(numCost).toLocaleString('zh-CN')}`,
      iconType: selectedIcon,
      redeemed: false,
      createdAt: Date.now(),
    };

    onAddWish(newWish);
    setTitle('');
    setCost('');
    setSelectedIcon('flight');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>✨ 添加自定义心愿</Text>
              <Text style={styles.modalSub}>把每次省下的冲动资金，储蓄给真正热爱的事物</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Wish Title */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>心愿名称 *</Text>
              <TextInput
                style={styles.input}
                placeholder="例如：次世代游戏机、冰岛旅行、相机镜头..."
                placeholderTextColor="#64748B"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Target Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>目标所需资金 (¥) *</Text>
              <TextInput
                style={styles.input}
                placeholder="例如：2800"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={cost}
                onChangeText={setCost}
              />
            </View>

            {/* Icon Category Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>选择心愿分类图标</Text>
              <View style={styles.iconsGrid}>
                {ICON_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.iconCard,
                      selectedIcon === opt.type && styles.iconCardActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      HapticsService.lightTap();
                      setSelectedIcon(opt.type);
                    }}
                  >
                    <Text style={styles.iconCardEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.iconCardLabel,
                        selectedIcon === opt.type && styles.iconCardLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Motivation Tip */}
            <View style={styles.tipBox}>
              <Text style={styles.tipEmoji}>💡</Text>
              <Text style={styles.tipText}>
                提示：每次你在冷冻期结束选择「放弃购买」，省下的金币将自动按比例为你的所有心愿注入充能！
              </Text>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.85} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>确认创建心愿 (CREATE WISH)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F1E36',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8',
    maxHeight: '85%',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollArea: {
    maxHeight: 400,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#13233F',
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#FFFFFF',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  iconCard: {
    width: '31%',
    backgroundColor: '#13233F',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  iconCardEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  iconCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  iconCardLabelActive: {
    color: '#38BDF8',
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  tipEmoji: {
    fontSize: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 16,
  },
  confirmBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#071527',
    letterSpacing: 0.5,
  },
});
