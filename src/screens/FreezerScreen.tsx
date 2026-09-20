import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { ASSETS } from '../constants/assets';
import { Header } from '../components/Header';
import { DialGauge } from '../components/DialGauge';
import { FreezerDoor } from '../components/FreezerDoor';
import { VaultSnippet } from '../components/VaultSnippet';
import { FreezerItem } from '../types';
import { HapticsService } from '../services/haptics';

interface FreezerScreenProps {
  items: FreezerItem[];
  totalSaved: number;
  onOpenFreezeModal: () => void;
  onSelectItem: (item: FreezerItem) => void;
  onNavigateToVault: () => void;
}

export const FreezerScreen: React.FC<FreezerScreenProps> = ({
  items,
  totalSaved,
  onOpenFreezeModal,
  onSelectItem,
  onNavigateToVault,
}) => {
  const [now, setNow] = useState(Date.now());

  // Real-time second-by-second ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Find the soonest thawing item to display in the dial gauge
  const freezingItems = items
    .filter((i) => i.status === 'freezing')
    .sort((a, b) => a.thawAt - b.thawAt);

  const nearestItem = freezingItems[0];
  const remainingMs = nearestItem ? Math.max(0, nearestItem.thawAt - now) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <Header
          title="Navigate"
          activeTab="freezing"
          onTabChange={(tab) => {
            if (tab === 'vault') {
              onNavigateToVault();
            }
          }}
          theme="lime"
        />

        {/* Top Floating Countdown Gauge on upper right */}
        <View style={styles.dialContainer}>
          <DialGauge remainingMs={remainingMs} />
        </View>

        {/* Main Refrigerator Graphic & Shelf Display */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <FreezerDoor
            items={items}
            onSelectItem={onSelectItem}
            onEmptySlotPress={onOpenFreezeModal}
          />
        </ScrollView>

        {/* Bottom Floating Bar */}
        <View style={styles.bottomBar}>
          {/* FREEZE NOW! Button */}
          <TouchableOpacity
            style={styles.freezeBtn}
            activeOpacity={0.85}
            onPress={() => {
              HapticsService.mediumTap();
              onOpenFreezeModal();
            }}
          >
            <Image source={ASSETS.btnFreezeNow} style={styles.freezeBtnImg} resizeMode="contain" />
          </TouchableOpacity>

          {/* Vault Snippet Pill (Starts at ¥0) */}
          <VaultSnippet totalSaved={totalSaved} onPress={onNavigateToVault} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgLime,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLime,
    position: 'relative',
  },
  dialContainer: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 20,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 110,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 30,
  },
  freezeBtn: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeBtnImg: {
    width: '100%',
    height: 60,
  },
});
