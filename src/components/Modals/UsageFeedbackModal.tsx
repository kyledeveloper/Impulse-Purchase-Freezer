import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { FreezerItem } from '../../types';
import { HapticsService } from '../../services/haptics';
import { USAGE_FEEDBACK_OPTIONS, UsageFeedbackKey } from '../../constants/decision';

interface UsageFeedbackModalProps {
  visible: boolean;
  item: FreezerItem | null;
  onSubmit: (feedback: UsageFeedbackKey, exp: number) => void;
  onClose: () => void;
}

/** 购买 30 天后的使用反馈：让"购买"成为自我认知的数据点 */
export const UsageFeedbackModal: React.FC<UsageFeedbackModalProps> = ({
  visible,
  item,
  onSubmit,
  onClose,
}) => {
  if (!visible || !item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>📦 购后回访</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            「{item.name}」到手一段时间了，它现在是什么状态？
          </Text>

          <View style={styles.optionColumn}>
            {USAGE_FEEDBACK_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.optionBtn}
                activeOpacity={0.85}
                onPress={() => {
                  HapticsService.lightTap();
                  onSubmit(opt.key as UsageFeedbackKey, opt.exp);
                }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionMsg}>{opt.msg}（+{opt.exp} EXP）</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.closeBtnText}>稍后再说</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#0B1528',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  optionColumn: {
    gap: 8,
    marginBottom: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#13233F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 12,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionTextCol: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  optionMsg: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
