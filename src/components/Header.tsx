import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ASSETS } from '../constants/assets';
import { COLORS } from '../constants/theme';
import { HapticsService } from '../services/haptics';

interface HeaderProps {
  title?: string;
  activeTab?: 'freezing' | 'vault';
  onTabChange?: (tab: 'freezing' | 'vault') => void;
  onSearchPress?: () => void;
  onMenuPress?: () => void;
  showBack?: boolean;
  onBackPress?: () => void;
  showSettings?: boolean;
  onSettingsPress?: () => void;
  theme?: 'lime' | 'ice' | 'vault';
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Navigate',
  activeTab = 'freezing',
  onTabChange,
  onSearchPress,
  onMenuPress,
  showBack = false,
  onBackPress,
  showSettings = false,
  onSettingsPress,
  theme = 'lime',
}) => {
  const isIce = theme === 'ice';
  const isVault = theme === 'vault';
  const textColor = (isIce || isVault) ? COLORS.white : COLORS.textDark;

  return (
    <View style={styles.container}>
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => {
                HapticsService.lightTap();
                onBackPress?.();
              }}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Image source={ASSETS.iconBack} style={[styles.iconImg, (isIce || isVault) && styles.tintWhite]} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                HapticsService.lightTap();
                onMenuPress?.();
              }}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Image source={ASSETS.iconMenu} style={styles.iconImg} />
            </TouchableOpacity>
          )}

          <Text style={[styles.titleText, { color: textColor }]}>{title}</Text>
        </View>

        <View style={styles.rightGroup}>
          {showSettings ? (
            <TouchableOpacity
              onPress={() => {
                HapticsService.lightTap();
                onSettingsPress?.();
              }}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Image source={ASSETS.iconSettings} style={[styles.iconImg, (isIce || isVault) && styles.tintWhite]} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                HapticsService.lightTap();
                onSearchPress?.();
              }}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Image source={ASSETS.iconSearch} style={styles.iconImg} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub Header Tab Toggle on Screen 1 */}
      {onTabChange && (
        <View style={styles.tabWrapper}>
          <TouchableOpacity
            style={[styles.tabSegment, activeTab === 'freezing' && styles.tabSegmentActive]}
            onPress={() => {
              HapticsService.lightTap();
              onTabChange('freezing');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'freezing' && styles.tabTextActive]}>
              Freezing (冷冻)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabSegment, activeTab === 'vault' && styles.tabSegmentActive]}
            onPress={() => {
              HapticsService.lightTap();
              onTabChange('vault');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'vault' && styles.tabTextActive]}>
              Vault (金库)
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  tintWhite: {
    tintColor: '#FFFFFF',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tabWrapper: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    padding: 3,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  tabSegment: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  tabSegmentActive: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  tabTextActive: {
    color: '#C8FA00',
  },
});
