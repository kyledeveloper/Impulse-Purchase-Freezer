import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { ASSETS } from '../constants/assets';
import { MEDAL_LIST } from '../constants/mockData';
import { HapticsService } from '../services/haptics';

interface MedalRowProps {
  unlockedMedals: string[];
}

export const MedalRow: React.FC<MedalRowProps> = ({ unlockedMedals }) => {
  const medalAssetsMap: Record<string, any> = {
    medalBronzeShield: ASSETS.medalBronzeShield,
    medalGoldShield: ASSETS.medalGoldShield,
    medalCyanEnergy: ASSETS.medalCyanEnergy,
    medalGoldCoin: ASSETS.medalGoldCoin,
    medalRibbonBronze: ASSETS.medalRibbonBronze,
    medalRibbonSilver: ASSETS.medalRibbonSilver,
    medalRibbonGold: ASSETS.medalRibbonGold,
  };

  const handleMedalPress = (medal: (typeof MEDAL_LIST)[0], isUnlocked: boolean) => {
    HapticsService.lightTap();
    Alert.alert(
      `${isUnlocked ? '🏆 已解锁' : '🔒 待解锁'}：${medal.name}`,
      `${medal.description}\n解锁要求：成功防御 ${medal.requiredDefended} 件商品 或 累计省下 ¥${medal.requiredSaved}`,
      [{ text: '知道了' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>奖章墙 (ACHIEVEMENTS)</Text>
      <View style={styles.row}>
        {MEDAL_LIST.map((medal) => {
          const isUnlocked = unlockedMedals.includes(medal.id);
          const iconSource = medalAssetsMap[medal.iconKey] || ASSETS.medalBronzeShield;

          return (
            <TouchableOpacity
              key={medal.id}
              activeOpacity={0.7}
              onPress={() => handleMedalPress(medal, isUnlocked)}
              style={[styles.medalBox, !isUnlocked && styles.lockedMedalBox]}
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
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  medalBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
