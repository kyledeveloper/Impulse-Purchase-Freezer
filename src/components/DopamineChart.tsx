import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';

interface DopamineChartProps {
  freezeDurationHours?: number;
  frozenAt?: number;
}

export const DopamineChart: React.FC<DopamineChartProps> = ({
  freezeDurationHours = 48,
  frozenAt = Date.now(),
}) => {
  const elapsedMs = Math.max(0, Date.now() - frozenAt);
  const elapsedHours = elapsedMs / (3600 * 1000);
  const effectiveTotalHours = freezeDurationHours < 1 ? 0.0028 : freezeDurationHours;

  // Fraction completed (0 to 1)
  const progress = Math.min(1, Math.max(0, elapsedMs / (effectiveTotalHours * 3600 * 1000)));

  // Calculate current estimated dopamine craving level (100 down to 10)
  // Mathematical exponential decay: y = 10 + 90 * e^(-2.5 * progress)
  const dopamineLevel = Math.round(10 + 90 * Math.exp(-2.8 * progress));
  const rationalityLevel = Math.round(10 + 85 * (1 - Math.exp(-2.2 * progress)));
  const decayedPercent = Math.max(0, 100 - dopamineLevel);

  // X coordinate on SVG (viewBox 0 to 240)
  const markerX = Math.round(progress * 230) + 5;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 科学多巴胺衰减与理智觉醒走势</Text>
        <Text style={styles.subTitle}>
          神经科学模型：冲动欲望随时间指数衰减，理智在 24h 拐点反超
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
      </View>

      <View style={styles.chartBox}>
        {/* Left Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>100%</Text>
          <Text style={styles.axisText}>75%</Text>
          <Text style={styles.axisText}>50%</Text>
          <Text style={styles.axisText}>25%</Text>
          <Text style={styles.axisText}>0%</Text>
        </View>

        {/* Chart SVG Canvas */}
        <View style={styles.svgWrapper}>
          <Svg width="100%" height="84" viewBox="0 0 240 84">
            <Defs>
              {/* Dopamine area gradient (Red to translucent) */}
              <LinearGradient id="dopamineGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#EF4444" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#EF4444" stopOpacity="0.02" />
              </LinearGradient>
              {/* Rationality area gradient (Cyan to translucent) */}
              <LinearGradient id="rationalGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#38BDF8" stopOpacity="0.35" />
                <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Grid horizontal dashed lines */}
            <Line x1="0" y1="18" x2="240" y2="18" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3, 3" />
            <Line x1="0" y1="38" x2="240" y2="38" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3, 3" />
            <Line x1="0" y1="58" x2="240" y2="58" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3, 3" />

            {/* Dopamine Decay Curve: Starts high at y=8, drops steeply, flattens around y=72 */}
            <Path
              d="M 0 8 C 40 12, 70 54, 120 64 C 170 72, 210 74, 240 76 L 240 84 L 0 84 Z"
              fill="url(#dopamineGrad)"
            />
            <Path
              d="M 0 8 C 40 12, 70 54, 120 64 C 170 72, 210 74, 240 76"
              stroke="#EF4444"
              strokeWidth="2.5"
              fill="none"
            />

            {/* Rationality Curve: Starts low at y=74, rises, crosses around y=44 at 24h, reaches y=14 */}
            <Path
              d="M 0 74 C 50 68, 90 48, 120 40 C 160 30, 200 18, 240 14 L 240 84 L 0 84 Z"
              fill="url(#rationalGrad)"
            />
            <Path
              d="M 0 74 C 50 68, 90 48, 120 40 C 160 30, 200 18, 240 14"
              stroke="#38BDF8"
              strokeWidth="2.5"
              fill="none"
            />

            {/* Real-time Indicator Line */}
            <Line
              x1={markerX}
              y1="0"
              x2={markerX}
              y2="84"
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="2, 2"
            />
            <Circle cx={markerX} cy="38" r="4" fill="#F59E0B" />
          </Svg>

          {/* Time checkpoints along X axis */}
          <View style={styles.xAxis}>
            <Text style={styles.xLabel}>0h (冲动顶峰)</Text>
            <Text style={styles.xLabel}>12h (退热)</Text>
            <Text style={styles.xLabel}>24h (理智反超)</Text>
            <Text style={styles.xLabel}>48h (清醒决断)</Text>
          </View>
        </View>
      </View>
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
  header: {
    marginBottom: 8,
  },
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
  statusDotRed: {
    fontSize: 9,
    color: '#EF4444',
  },
  statusDotGreen: {
    fontSize: 9,
    color: '#38BDF8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  statusPillDecay: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusDecayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
  },
  chartBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 104,
  },
  yAxis: {
    justifyContent: 'space-between',
    height: 84,
    paddingRight: 6,
    paddingBottom: 2,
  },
  axisText: {
    fontSize: 7,
    color: '#64748B',
    fontWeight: '700',
  },
  svgWrapper: {
    flex: 1,
    height: 104,
    justifyContent: 'flex-end',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  xLabel: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
