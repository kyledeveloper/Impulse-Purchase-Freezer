import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { ASSETS } from '../constants/assets';
import { MEDAL_LIST } from '../constants/mockData';
import { MEDAL_TYPE_LABELS } from '../constants/rewards';
import { AchievementMedal } from '../types';
import { HapticsService } from '../services/haptics';

interface MedalRowProps {
  unlockedMedals: string[];
  /** 已拥有特权：medal_frame_gold 时展示鎏金框 */
  ownedPerks?: string[];
}

const MEDAL_TYPE_ORDER: AchievementMedal['type'][] = ['count', 'saved', 'streak', 'perfect', 'special'];

/** 按奖章类型生成解锁要求文案 */
function requirementText(medal: AchievementMedal): string {
  switch (medal.type) {
    case 'count':
      return `解锁要求：成功防御 ${medal.requiredDefended} 件商品`;
    case 'saved':
      return `解锁要求：累计省下 ¥${(medal.requiredSaved ?? 0).toLocaleString()}`;
    case 'streak':
      return `解锁要求：连续 ${medal.requiredStreak} 天无任何确认购买`;
    case 'perfect':
      return `解锁要求：达成 ${medal.requiredPerfect} 次完美克制`;
    case 'special':
      return `解锁要求：兑换 ${medal.requiredWishes} 个心愿`;
    default:
      return '';
  }
}

export const MedalRow: React.FC<MedalRowProps> = ({ unlockedMedals, ownedPerks = [] }) => {
  const goldFrame = ownedPerks.includes('medal_frame_gold');

  const medalAssetsMap: Record<string, any> = {
    medalBronzeShield: ASSETS.medalBronzeShield,
    medalGoldShield: ASSETS.medalGoldShield,
    medalCyanEnergy: ASSETS.medalCyanEnergy,
    medalGoldCoin: ASSETS.medalGoldCoin,
    medalRibbonBronze: ASSETS.medalRibbonBronze,
    medalRibbonSilver: ASSETS.medalRibbonSilver,
    medalRibbonGold: ASSETS.medalRibbonGold,
  };

  const handleMedalPress = (medal: AchievementMedal, isUnlocked: boolean) => {
    HapticsService.lightTap();
    Alert.alert(
      `${isUnlocked ? '🏆 已解锁' : '🔒 待解锁'}：${medal.name}`,
      `${medal.description}\n${requirementText(medal)}`,
      [{ text: '知道了' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>奖章墙 (ACHIEVEMENTS)</Text>
        {goldFrame && <Text style={styles.goldBadge}>🖼️ 鎏金框</Text>}
      </View>
      {MEDAL_TYPE_ORDER.map((type) => {
        const medals = MEDAL_LIST.filter((m) => m.type === type);
        if (medals.length === 0) return null;
        return (
          <View key={type} style={styles.group}>
            <Text style={styles.groupLabel}>{MEDAL_TYPE_LABELS[type]}</Text>
            <View style={[styles.row, goldFrame && styles.rowGold]}>
              {medals.map((medal) => {
                const isUnlocked = unlockedMedals.includes(medal.id);
                const iconSource = medalAssetsMap[medal.iconKey] || ASSETS.medalBronzeShield;

                return (
                  <TouchableOpacity
                    key={medal.id}
                    activeOpacity={0.7}
                    onPress={() => handleMedalPress(medal, isUnlocked)}
                    style={[
                      styles.medalBox,
                      !isUnlocked && styles.lockedMedalBox,
                      goldFrame && isUnlocked && styles.medalBoxGold,
                    ]}
                  >
                    <Image
                      source={iconSource}
                      style={[styles.medalIcon, !isUnlocked && styles.lockedIcon]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  goldBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
  },
  group: {
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
    gap: 10,
  },
  rowGold: {
    borderColor: '#B45309',
    backgroundColor: '#292217',
  },
  medalBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  medalBoxGold: {
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  lockedMedalBox: {
    opacity: 0.35,
  },
  medalIcon: {
    width: 32,
    height: 32,
  },
  lockedIcon: {
    tintColor: '#64748B',
  },
});
