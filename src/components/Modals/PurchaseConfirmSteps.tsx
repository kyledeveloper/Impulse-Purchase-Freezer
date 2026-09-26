import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { FreezerItem, VaultStats } from '../../types';
import { HapticsService } from '../../services/haptics';
import { calculatePurchaseExp } from '../../constants/decision';

interface PurchaseConfirmStepsProps {
  visible: boolean;
  item: FreezerItem | null;
  stats: VaultStats;
  hourlyWage?: number;
  onConfirm: (item: FreezerItem) => void; // final confirmed purchase
  onCancel: () => void;                   // back to decision modal
}

/**
 * 购买三步确认仪式：
 * 1. 确认意图  2. 预算检视（含强制勾选）  3. 完成购买
 */
export const PurchaseConfirmSteps: React.FC<PurchaseConfirmStepsProps> = ({
  visible,
  item,
  stats,
  hourlyWage = 60,
  onConfirm,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rationalChecked, setRationalChecked] = useState(false);

  if (!visible || !item) return null;

  const expIfBuy = calculatePurchaseExp(item);
  const insisted = item.quizInsisted || 0;
  const workHours = Math.max(1, Math.round(item.price / hourlyWage));
  const durationLabel =
    item.freezeDurationHours < 1 ? '10 秒' : `${item.freezeDurationHours} 小时`;

  const reset = () => {
    setStep(1);
    setRationalChecked(false);
  };

  const handleCancel = () => {
    HapticsService.lightTap();
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    HapticsService.mediumTap();
    reset();
    onConfirm(item);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
            ))}
            <Text style={styles.stepText}>第 {step} / 3 步</Text>
          </View>

          {step === 1 && (
            <>
              <Text style={styles.title}>🤔 确认意图</Text>
              <Text style={styles.body}>
                经过 {durationLabel}
                的冷静期，你依然确定需要「{item.name}」吗？
              </Text>
              <View style={styles.btnColumn}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    HapticsService.mediumTap();
                    setStep(2);
                  }}
                >
                  <Text style={styles.primaryBtnText}>是的，我认真想过了</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8} onPress={handleCancel}>
                  <Text style={styles.ghostBtnText}>再想想</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>💰 预算检视</Text>
              <View style={styles.statBox}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>本月已确认购买</Text>
                  <Text style={styles.statValue}>
                    {stats.monthlyPurchasedCount} 件 · ¥
                    {stats.monthlyPurchasedAmount.toLocaleString('zh-CN')}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>本次购买后</Text>
                  <Text style={styles.statValueAmber}>
                    +¥{item.price.toLocaleString('zh-CN')}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>相当于你的工时</Text>
                  <Text style={styles.statValue}>约 {workHours} 小时</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>购买获得 EXP</Text>
                  <Text style={styles.statValue}>
                    +{expIfBuy} EXP{insisted > 0 ? `（坚持破冰 -${insisted * 5}）` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkRow}
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.lightTap();
                  setRationalChecked(!rationalChecked);
                }}
              >
                <View style={[styles.checkbox, rationalChecked && styles.checkboxOn]}>
                  {rationalChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>我已确认这是理性需求，而非冲动残留</Text>
              </TouchableOpacity>

              <View style={styles.btnColumn}>
                <TouchableOpacity
                  style={[styles.primaryBtn, !rationalChecked && styles.primaryBtnDisabled]}
                  activeOpacity={rationalChecked ? 0.85 : 1}
                  onPress={() => {
                    if (!rationalChecked) return;
                    HapticsService.mediumTap();
                    setStep(3);
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    {rationalChecked ? '进入最终确认' : '请先勾选理性确认'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8} onPress={handleCancel}>
                  <Text style={styles.ghostBtnText}>返回抉择</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.title}>🛒 最终确认</Text>
              <Text style={styles.body}>
                即将为你打开购买链接。冷静期已满，这是你自己的决定——买得安心，用得开心。
              </Text>
              <View style={styles.btnColumn}>
                <TouchableOpacity style={styles.buyFinalBtn} activeOpacity={0.85} onPress={handleConfirm}>
                  <Text style={styles.buyFinalBtnText}>确认购买 · 前往下单</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8} onPress={handleCancel}>
                  <Text style={styles.ghostBtnText}>返回抉择</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#0B1528',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  stepDotActive: {
    backgroundColor: '#F59E0B',
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 18,
  },
  statBox: {
    backgroundColor: '#13233F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  statValueAmber: {
    fontSize: 12,
    color: '#FBBF24',
    fontWeight: '900',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  checkLabel: {
    flex: 1,
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
    lineHeight: 17,
  },
  btnColumn: {
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#1E293B',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#082F49',
  },
  buyFinalBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buyFinalBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#451A03',
  },
  ghostBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
