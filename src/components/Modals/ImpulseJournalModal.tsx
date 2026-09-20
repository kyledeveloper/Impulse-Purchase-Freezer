import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { HapticsService } from '../../services/haptics';
import { JOURNAL_SCENES, JOURNAL_MOODS } from '../../constants/intervention';

interface ImpulseJournalModalProps {
  visible: boolean;
  itemName: string;
  onSubmit: (scene: string, mood: string, note: string) => void;
  onClose: () => void;
}

export const ImpulseJournalModal: React.FC<ImpulseJournalModalProps> = ({
  visible,
  itemName,
  onSubmit,
  onClose,
}) => {
  const [scene, setScene] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const canSubmit = scene !== null && mood !== null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    HapticsService.victorySuccess();
    onSubmit(scene!, mood!, note.trim());
    // reset for next time
    setScene(null);
    setMood(null);
    setNote('');
  };

  const renderTagRow = (
    label: string,
    options: string[],
    selected: string | null,
    onSelect: (v: string) => void
  ) => (
    <View style={styles.tagSection}>
      <Text style={styles.tagLabel}>{label}</Text>
      <View style={styles.tagWrap}>
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.tag, active && styles.tagActive]}
              activeOpacity={0.8}
              onPress={() => {
                HapticsService.lightTap();
                onSelect(opt);
              }}
            >
              <Text style={[styles.tagText, active && styles.tagTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>📝 记录这次冲动的来源</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                关于「{itemName}」——了解自己，是克制的开始
              </Text>

              {renderTagRow('触发场景（什么时候想买的？）', JOURNAL_SCENES, scene, setScene)}
              {renderTagRow('当时情绪（买之前心情如何？）', JOURNAL_MOODS, mood, setMood)}

              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>补充记录（可选，140 字内）</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="比如：深夜看到种草视频，一时上头..."
                  placeholderTextColor="#475569"
                  multiline
                  maxLength={140}
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              <View style={styles.btnColumn}>
                <TouchableOpacity
                  style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                  activeOpacity={canSubmit ? 0.85 : 1}
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitBtnText}>
                    {canSubmit ? '✅ 保存日记（+5 意志力）' : '请先选择场景和情绪'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>再想想</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0B1528',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 20,
    maxHeight: '88%',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  tagSection: {
    marginBottom: 16,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#13233F',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  tagActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tagTextActive: {
    color: '#67E8F9',
  },
  noteInput: {
    backgroundColor: '#13233F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 12,
    minHeight: 72,
    fontSize: 13,
    color: '#E2E8F0',
    textAlignVertical: 'top',
  },
  btnColumn: {
    gap: 10,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#1E293B',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
