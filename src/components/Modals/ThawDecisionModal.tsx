import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { FreezerItem } from '../../types';
import { ASSETS } from '../../constants/assets';
import { AudioService } from '../../services/audio';
import { HapticsService } from '../../services/haptics';

interface ThawDecisionModalProps {
  visible: boolean;
  item: FreezerItem | null;
  onAbandon: (item: FreezerItem) => void;
  onBuy: (item: FreezerItem) => void;
  onClose: () => void;
}

export const ThawDecisionModal: React.FC<ThawDecisionModalProps> = ({
  visible,
  item,
  onAbandon,
  onBuy,
  onClose,
}) => {
  if (!item) return null;

  const handleAbandon = () => {
    AudioService.playCoinSound();
    HapticsService.victorySuccess();
    onAbandon(item);
  };

  const handleBuy = () => {
    HapticsService.lightTap();
    if (item.originalUrl) {
      Linking.openURL(item.originalUrl).catch(() => {
        Alert.alert('提示', '无法打开原始链接');
      });
    }
    onBuy(item);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.card}>
          {/* Top Ice Badge */}
          <View style={styles.iceHeader}>
            <Text style={styles.iceHeaderEmoji}>❄️ ➔ 🪙</Text>
            <Text style={styles.iceHeaderTitle}>冷冻期结束，冰层已消融</Text>
          </View>

          {/* Item Preview & 100% Melted Water Puddle */}
          <View style={styles.itemBox}>
            <View style={styles.meltPuddleContainer}>
              <Image
                source={ASSETS.iceCubeMeltPuddle}
                style={styles.meltPuddleImg}
                resizeMode="contain"
              />
              <Image
                source={
                  item.rawCutout ||
                  (item.image === ASSETS.frozenPhone || item.image === ASSETS.icePhone || !item.image
                    ? ASSETS.phoneClean
                    : item.image)
                }
                style={styles.unencasedItemImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemPrice}>¥{item.price.toLocaleString('zh-CN')}</Text>
          </View>

          {/* Future-self note written at the final checkpoint (glacier tier) */}
          {!!item.futureSelfNote && (
            <View style={styles.futureSelfBox}>
              <Text style={styles.futureSelfLabel}>💌 冷冻时你给未来的留言：</Text>
              <Text style={styles.futureSelfText}>{item.futureSelfNote}</Text>
            </View>
          )}

          {/* Psychological Question */}
          <View style={styles.questionBox}>
            <Text style={styles.questionText}>你现在还想买它吗？</Text>
            <Text style={styles.questionSub}>
              经过多巴胺冷静期，非理性冲动往往已经消散。
            </Text>
          </View>

          {/* Options */}
          <View style={styles.btnColumn}>
            {/* Rational Choice: Abandon purchase */}
            <TouchableOpacity
              style={styles.abandonBtn}
              activeOpacity={0.85}
              onPress={handleAbandon}
            >
              <View style={styles.btnContent}>
                <Text style={styles.abandonBtnEmoji}>🎉</Text>
                <View>
                  <Text style={styles.abandonBtnTitle}>放弃购买（理性大胜利！）</Text>
                  <Text style={styles.abandonBtnSub}>
                    省下 ¥{item.price} 入战利品金库，播放入袋音效
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Deliberate Purchase: Still want to buy */}
            <TouchableOpacity
              style={styles.buyBtn}
              activeOpacity={0.8}
              onPress={handleBuy}
            >
              <Text style={styles.buyBtnTitle}>仍然想买（深思熟虑的决定）</Text>
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
    backgroundColor: 'rgba(7, 21, 39, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F1E36',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  iceHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iceHeaderEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  iceHeaderTitle: {
    fontSize: 13,
    color: '#67E8F9',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemBox: {
    alignItems: 'center',
    backgroundColor: '#13233F',
    borderRadius: 16,
    padding: 12,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  meltPuddleContainer: {
    width: 140,
    height: 110,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  meltPuddleImg: {
    position: 'absolute',
    bottom: 0,
    width: 130,
    height: 65,
  },
  unencasedItemImg: {
    width: 68,
    height: 68,
    position: 'absolute',
    top: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FBBF24',
  },
  questionBox: {
    alignItems: 'center',
    marginBottom: 18,
  },
  futureSelfBox: {
    width: '100%',
    backgroundColor: 'rgba(103, 232, 249, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.35)',
    padding: 10,
    marginBottom: 14,
  },
  futureSelfLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#67E8F9',
    marginBottom: 3,
  },
  futureSelfText: {
    fontSize: 12,
    color: '#E0F2FE',
    lineHeight: 17,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  questionSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  btnColumn: {
    width: '100%',
    gap: 10,
  },
  abandonBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  abandonBtnEmoji: {
    fontSize: 22,
  },
  abandonBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  abandonBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  buyBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buyBtnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
