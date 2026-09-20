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

export interface RealityCheckQuestion {
  level: number; // 25, 50, 75, 100
  tag: string;
  question: string;
  detail: string;
  optionRational: string;
  optionInsist: string;
}

export const REALITY_QUESTIONS: Record<number, RealityCheckQuestion> = {
  25: {
    level: 25,
    tag: '第 1 道理智防线 · 替代性拷问',
    question: '家里是否已经有类似功能的物品在吃灰？',
    detail: '许多冲动源于喜新厌旧。想想你以前买的同类商品，现在每周能用上几次？',
    optionRational: '🛡️ 确实有些冲动，立刻放下铁锤 (+20 意志力)',
    optionInsist: '🔨 它是不可替代的，继续破冰',
  },
  50: {
    level: 50,
    tag: '第 2 道理智防线 · 劳动时薪拷问',
    question: '买下这件商品，需要你辛苦无休工作多久？',
    detail: '用你实际到手的时薪算一算。为了几分钟的拆箱快感，用这么多小时的枯燥打工去交换，值得吗？',
    optionRational: '🛡️ 想想打工不易，我不买了 (+30 意志力)',
    optionInsist: '🔨 我愿意为它付出劳动，继续破冰',
  },
  75: {
    level: 75,
    tag: '第 3 道理智防线 · 多巴胺半衰期',
    question: '拥有它带来的兴奋感，能持续超过 3 天吗？',
    detail: '神经科学证明：冲动购物的多巴胺峰值在付款后 10 分钟内达到顶峰，随后急速下跌。3天后它就会沦为普通物件。',
    optionRational: '🛡️ 看穿多巴胺陷阱，重归冷静 (+40 意志力)',
    optionInsist: '🔨 我的热爱是长期的，继续破冰',
  },
  100: {
    level: 100,
    tag: '终极理智关卡 · 愿望权衡拷问',
    question: '如果把这笔钱全额注入你的梦想心愿，哪个更让你心动？',
    detail: '放弃一次短暂的消费，能让你的长期目标（旅行、主机、大额储蓄）大大迈进一步！',
    optionRational: '🛡️ 注入梦想金库更踏实 (+50 意志力)',
    optionInsist: '🔨 意志坚定，进入解冻抉择',
  },
};

interface RealityCheckModalProps {
  visible: boolean;
  item: FreezerItem | null;
  level: number;
  onRationalChoice: () => void;
  onContinueBreaker: () => void;
}

export const RealityCheckModal: React.FC<RealityCheckModalProps> = ({
  visible,
  item,
  level,
  onRationalChoice,
  onContinueBreaker,
}) => {
  if (!visible || !item) return null;
  const q = REALITY_QUESTIONS[level] || REALITY_QUESTIONS[25];

  // Estimated work hours calculation
  const estimatedHours = Math.max(1, Math.round(item.price / 60));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.card}>
          {/* Top Tag Header */}
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{q.tag}</Text>
          </View>

          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>⚡</Text>
          </View>

          {/* Question & Price context */}
          <Text style={styles.questionTitle}>{q.question}</Text>
          <Text style={styles.questionDetail}>
            {level === 50
              ? `当前标的：¥${item.price.toLocaleString('zh-CN')}，大约需要普通工薪族连续工作 ${estimatedHours} 个小时才能挣回。`
              : q.detail}
          </Text>

          {/* Price & Target preview card */}
          <View style={styles.itemSnippet}>
            <Text style={styles.itemSnippetName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemSnippetPrice}>¥{item.price.toLocaleString('zh-CN')}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={styles.rationalBtn}
              activeOpacity={0.85}
              onPress={() => {
                HapticsService.victorySuccess();
                onRationalChoice();
              }}
            >
              <Text style={styles.rationalBtnText}>{q.optionRational}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.insistBtn}
              activeOpacity={0.8}
              onPress={() => {
                HapticsService.mediumTap();
                onContinueBreaker();
              }}
            >
              <Text style={styles.insistBtnText}>{q.optionInsist}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    backgroundColor: '#0B1528',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  tagBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  iconEmoji: {
    fontSize: 26,
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  questionDetail: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  itemSnippet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    marginBottom: 16,
  },
  itemSnippetName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 10,
  },
  itemSnippetPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FBBF24',
  },
  actionColumn: {
    width: '100%',
    gap: 10,
  },
  rationalBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  rationalBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  insistBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  insistBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
});
