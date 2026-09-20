import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { ASSETS } from '../constants/assets';
import { FreezerItem } from '../types';
import { HapticsService } from '../services/haptics';

interface FreezerDoorProps {
  items: FreezerItem[];
  onSelectItem: (item: FreezerItem) => void;
  onEmptySlotPress?: () => void;
}

export const FreezerDoor: React.FC<FreezerDoorProps> = ({
  items,
  onSelectItem,
  onEmptySlotPress,
}) => {
  const [, setTick] = useState(0);

  // Real-time second-by-second ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => (t + 1) % 10000);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active freezing items
  const freezingItems = items.filter((i) => i.status === 'freezing');
  // Fixed 6 slots in the freezer
  const TOTAL_SLOTS = 6;
  const slots = Array.from({ length: TOTAL_SLOTS });
  const remainingCount = Math.max(0, TOTAL_SLOTS - freezingItems.length);

  // Format remaining time into HH:MM:SS or MM:SS (updates every second)
  const formatCountdown = (thawAt: number) => {
    const ms = Math.max(0, thawAt - Date.now());
    if (ms <= 0) return '已解冻';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Refrigerator Hero Display (Pure Clean Graphic) */}
      <View style={styles.fridgeSection}>
        <View style={styles.fridgeContainer}>
          <Image source={ASSETS.freezer} style={styles.fridgeImg} resizeMode="contain" />
        </View>
      </View>

      {/* 2. Frozen Storage Slots Section (Below Refrigerator in Empty Space) */}
      <View style={styles.storageSection}>
        {/* Header with Slot Counter and Scroll Hint */}
        <View style={styles.storageHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.storageTitle}>❄️ 冰封储物格</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>
                已用 {freezingItems.length}/6 · 剩余 {remainingCount} 空格
              </Text>
            </View>
          </View>
          <Text style={styles.scrollHint}>滑看更多 ›</Text>
        </View>

        {/* Horizontal 1*4 Sliding Row (Smoothly scrollable to reveal remaining slots) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.slotsScrollView}
          contentContainerStyle={styles.slotsScrollContent}
          bounces={true}
        >
          {slots.map((_, index) => {
            const item = freezingItems[index];
            const slotNumber = index + 1;

            if (item) {
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.slotCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    HapticsService.lightTap();
                    onSelectItem(item);
                  }}
                >
                  {/* Slot Number Badge */}
                  <View style={styles.slotIndexBadge}>
                    <Text style={styles.slotIndexText}>#{slotNumber}</Text>
                  </View>

                  {/* Ice Box */}
                  <View style={styles.iceBox}>
                    {/* Layer 1: Clean Product Inside */}
                    <Image
                      source={
                        item.rawCutout ||
                        (item.image === ASSETS.frozenPhone || item.image === ASSETS.icePhone || !item.image
                          ? ASSETS.phoneClean
                          : item.image)
                      }
                      style={styles.itemImg}
                      resizeMode="contain"
                    />
                    {/* Layer 2: Ice Cube Sealed/Melted Overlay */}
                    <Image
                      source={(() => {
                        const totalDuration = item.freezeDurationHours < 1 ? 10 * 1000 : item.freezeDurationHours * 3600 * 1000;
                        const remaining = Math.max(0, item.thawAt - Date.now());
                        const progress = Math.min(100, Math.round(((totalDuration - remaining) / totalDuration) * 100));
                        if (progress >= 90) return ASSETS.iceCubeMelt90;
                        if (progress >= 60) return ASSETS.iceCubeMelt60;
                        if (progress >= 30) return ASSETS.iceCubeMelt30;
                        return ASSETS.iceCubeSolid;
                      })()}
                      style={styles.itemIceOverlay}
                      resizeMode="contain"
                    />
                    {/* Subtle Crack Overlay if damaged */}
                    {item.breakTapsRemaining < 70 && (
                      <Image
                        source={
                          item.breakTapsRemaining <= 10
                            ? ASSETS.iceCubeCrackOverlay90
                            : item.breakTapsRemaining <= 40
                            ? ASSETS.iceCubeCrackOverlay60
                            : ASSETS.iceCubeCrackOverlay30
                        }
                        style={styles.slotCrackOverlay}
                        resizeMode="contain"
                      />
                    )}

                    {/* Price Tag */}
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>¥{item.price}</Text>
                    </View>
                  </View>

                  {/* Countdown Badge */}
                  <View style={styles.countdownPill}>
                    <Text style={styles.countdownText}>⏱ {formatCountdown(item.thawAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // Empty Slot (Available space)
            return (
              <TouchableOpacity
                key={`empty-${index}`}
                style={[styles.slotCard, styles.emptySlotCard]}
                activeOpacity={0.7}
                onPress={() => {
                  HapticsService.lightTap();
                  onEmptySlotPress?.();
                }}
              >
                <View style={styles.slotIndexBadge}>
                  <Text style={[styles.slotIndexText, styles.slotIndexEmpty]}>#{slotNumber}</Text>
                </View>

                <View style={styles.emptyBox}>
                  <Text style={styles.emptyPlusIcon}>＋</Text>
                  <Text style={styles.emptyLabel}>待冰封</Text>
                </View>

                <View style={styles.emptyPill}>
                  <Text style={styles.emptyPillText}>可用空格</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  // Refrigerator graphic section
  fridgeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  fridgeContainer: {
    width: 230,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeImg: {
    width: 230,
    height: 280,
  },

  // Storage Slots section (Below Refrigerator)
  storageSection: {
    width: '100%',
    marginTop: 10,
    paddingBottom: 6,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storageTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.3,
  },
  badgeCount: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C8FA00',
  },
  scrollHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  // Sliding 1*4 row
  slotsScrollView: {
    overflow: 'visible',
  },
  slotsScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  slotCard: {
    width: 82,
    alignItems: 'center',
    position: 'relative',
    paddingTop: 6,
  },
  slotIndexBadge: {
    position: 'absolute',
    top: 0,
    left: 2,
    zIndex: 12,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  slotIndexText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38BDF8',
  },
  slotIndexEmpty: {
    color: '#94A3B8',
    borderColor: '#64748B',
  },
  iceBox: {
    width: 80,
    height: 82,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  itemImg: {
    width: 68,
    height: 70,
  },
  itemIceOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 68,
    height: 70,
    zIndex: 5,
    opacity: 0.85,
  },
  slotCrackOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 68,
    height: 70,
    zIndex: 10,
  },
  pricePill: {
    position: 'absolute',
    bottom: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pricePillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38BDF8',
  },
  countdownPill: {
    marginTop: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  countdownText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },

  // Empty slot styling
  emptySlotCard: {
    opacity: 0.9,
  },
  emptyBox: {
    width: 80,
    height: 82,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#475569',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emptyPlusIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#475569',
  },
  emptyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
  },
  emptyPill: {
    marginTop: 4,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emptyPillText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#1E293B',
  },
});
