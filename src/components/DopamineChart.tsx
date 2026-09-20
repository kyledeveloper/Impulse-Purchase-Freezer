import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';

interface DopamineChartProps {
  freezeDurationHours?: number;
  frozenAt?: number;
  itemPrice?: number;         // 价格越高，冲动峰值越高
  interventionCount?: number; // 已完成有效干预次数（呼吸/印记/日记），每次压平峰值 8%
}

/**
 * 动态多巴胺衰减曲线：
 * - 峰值随商品价格上升（高价商品冲动更强）
 * - 每完成一次有效干预，曲线整体下压 8%（用户能直观看到"干预正在起效"）
 */
export const DopamineChart: React.FC<DopamineChartProps> = ({
  freezeDurationHours = 48,
  frozenAt = Date.now(),
  itemPrice = 0,
  interventionCount = 0,
}) => {
  const elapsedMs = Math.max(0, Date.now() - frozenAt);
  const effectiveTotalHours = freezeDurationHours < 1 ? 0.0028 : freezeDurationHours;
  const progress = Math.min(1, Math.max(0, elapsedMs / (effectiveTotalHours * 3600 * 1000)));

  // Peak scales with price tier (cap at 100)
  const priceBoost = Math.min(15, Math.floor(itemPrice / 500) * 3); // +3 per ¥500, max +15
  const basePeak = Math.min(100, 80 + priceBoost);

  // Each effective intervention flattens the curve by 8%
  const suppression = Math.min(0.6, interventionCount * 0.08); // cap at -60%
  const peak = Math.round(basePeak * (1 - suppression));
  const flattenPercent = Math.round(suppression * 100);

  // Current dopamine & rationality levels with intervention-adjusted peak
  const dopamineLevel = Math.round(10 + (peak - 10) * Math.exp(-2.8 * progress));
  const rationalityLevel = Math.round(10 + 85 * (1 - Math.exp(-2.2 * progress)));
  const decayedPercent = Math.max(0, peak - dopamineLevel);

  // Build dynamic curve paths (viewBox 240 x 84; y inverted: smaller y = higher value)
  const yFor = (level: number) => 84 - (level / 100) * 76; // map 0~100 -> 84~8

  const dPeakY = yFor(peak);
  const dMidY = yFor(Math.round(10 + (peak - 10) * Math.exp(-2.8 * 0.5)));
  const dEndY = yFor(10);

  const rStartY = yFor(10);
  const rMidY = yFor(Math.round(10 + 85 * (1 - Math.exp(-2.2 * 0.5))));
  const rEndY = yFor(95);

  const dopaminePath = `M 0 ${dPeakY} C 60 ${dPeakY + 6}, 90 ${dMidY}, 120 ${dMidY} C 170 ${dMidY + 8}, 210 ${dEndY - 2}, 240 ${dEndY}`;
  const rationalPath = `M 0 ${rStartY} C 50 ${rStartY - 6}, 90 ${rMidY + 4}, 120 ${rMidY} C 160 ${rMidY - 8}, 200 ${rEndY + 4}, 240 ${rEndY}`;

  const markerX = Math.round(progress * 230) + 5;
  const markerY = yFor(dopamineLevel);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 科学多巴胺衰减与理智觉醒走势</Text>
        <Text style={styles.subTitle}>
          冲动峰值随商品价格上升；每次有效干预（呼吸/印记/日记）可压平峰值 8%
        </Text>
      </View>

      {/* Dynamic Status Highlight */}
      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <Text style={styles.statusDotRed}>●</Text>
          <Text style={styles.statusText}>冲动值: {dopamineLevel}%</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusDotGreen}>●</Text>
          <Text style={styles.statusText}>理智值: {rationalityLevel}%</Text>
        </View>
        <View style={[styles.statusPill, styles.statusPillDecay]}>
          <Text style={styles.statusDecayText}>已降温 {decayedPercent}%</Text>
        </View>
        {flattenPercent > 0 && (
          <View style={[styles.statusPill, styles.statusPillFlatten]}>
            <Text style={styles.statusFlattenText}>干预压平 -{flattenPercent}%</Text>
          </View>
        )}
      </View>

      <View style={styles.chartBox}>
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>100%</Text>
          <Text style={styles.axisText}>75%</Text>
          <Text style={styles.axisText}>50%</Text>
          <Text style={styles.axisText}>25%</Text>
          <Text style={styles.axisText}>0%</Text>
        </View>

        <View style={styles.svgWrapper}>
          <Svg width="100%" height="84" viewBox="0 0 240 84">
            <Defs>
              <LinearGradient id="dopamineGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#EF4444" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#EF4444" stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient id="rationalGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#38BDF8" stopOpacity="0.35" />
                <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            <Line x1="0" y1="18" x2="240" y2="18" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
            <Line x1="0" y1="38" x2="240" y2="38" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
            <Line x1="0" y1="58" x2="240" y2="58" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />

            {/* Dopamine decay curve */}
            <Path d={`${dopaminePath} L 240 84 L 0 84 Z`} fill="url(#dopamineGrad)" />
            <Path d={dopaminePath} stroke="#EF4444" strokeWidth="2.5" fill="none" />

            {/* Rationality rising curve */}
            <Path d={`${rationalPath} L 240 84 L 0 84 Z`} fill="url(#rationalGrad)" />
            <Path d={rationalPath} stroke="#38BDF8" strokeWidth="2.5" fill="none" />

            {/* Real-time position indicator */}
            <Line
              x1={markerX}
              y1="0"
              x2={markerX}
              y2="84"
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="2,2"
            />
            <Circle cx={markerX} cy={markerY} r="4" fill="#F59E0B" />
          </Svg>

          <View style={styles.xAxis}>
            <Text style={styles.xLabel}>0h (冲动顶峰)</Text>
            <Text style={styles.xLabel}>12h (退热)</Text>
            <Text style={styles.xLabel}>24h (理智反超)</Text>
            <Text style={styles.xLabel}>48h (清醒决断)</Text>
          </View>
        </View>
      </View>

      {interventionCount > 0 && (
        <Text style={styles.interventionSummary}>
          💪 你已完成 {interventionCount} 次有效干预，共压平冲动峰值 {flattenPercent}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 12,
    width: '100%',
    marginVertical: 8,
  },
  header: { marginBottom: 8 },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#13233F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  statusDotRed: { fontSize: 9, color: '#EF4444' },
  statusDotGreen: { fontSize: 9, color: '#38BDF8' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#E2E8F0' },
  statusPillDecay: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusDecayText: { fontSize: 10, fontWeight: '800', color: '#34D399' },
  statusPillFlatten: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  statusFlattenText: { fontSize: 10, fontWeight: '800', color: '#C4B5FD' },
  chartBox: { flexDirection: 'row', alignItems: 'flex-end', height: 104 },
  yAxis: {
    justifyContent: 'space-between',
    height: 84,
    paddingRight: 6,
    paddingBottom: 2,
  },
  axisText: { fontSize: 7, color: '#64748B', fontWeight: '700' },
  svgWrapper: { flex: 1, height: 104, justifyContent: 'flex-end' },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  xLabel: { fontSize: 8, color: '#94A3B8', fontWeight: '700' },
  interventionSummary: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#6EE7B7',
    textAlign: 'center',
  },
});
