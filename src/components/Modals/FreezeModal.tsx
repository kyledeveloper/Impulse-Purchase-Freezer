import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { ASSETS } from '../../constants/assets';
import { FreezerItem } from '../../types';
import { HapticsService } from '../../services/haptics';
import { AudioService } from '../../services/audio';
import { NotificationService } from '../../services/notifications';
import { removeBackground } from '../../services/backgroundRemoval';

interface FreezeModalProps {
  visible: boolean;
  onClose: () => void;
  onFreezeItem: (newItem: FreezerItem) => void;
}

const PRESET_ICONS = [
  { label: '手机数码', img: ASSETS.phoneClean },
  { label: '半岛咖啡', img: ASSETS.icePhone },
  { label: '蛋奶零食', img: ASSETS.eggCarton },
  { label: '生鲜果蔬', img: ASSETS.groceries },
];

export const FreezeModal: React.FC<FreezeModalProps> = ({ visible, onClose, onFreezeItem }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [selectedImg, setSelectedImg] = useState<any>(ASSETS.phoneClean);
  const [durationHours, setDurationHours] = useState<number>(48);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [rawUserImgUri, setRawUserImgUri] = useState<string | null>(null);
  const [transparentImgUri, setTransparentImgUri] = useState<string | null>(null);
  const [isCutoutActive, setIsCutoutActive] = useState(true);

  const processImageWithMatting = async (uri: string) => {
    setRawUserImgUri(uri);
    setSelectedImg({ uri });
    setIsRemovingBg(true);
    setIsCutoutActive(true);

    try {
      const transparentUri = await removeBackground(uri);
      if (transparentUri && transparentUri !== uri) {
        setTransparentImgUri(transparentUri);
        setSelectedImg({ uri: transparentUri });
        HapticsService.lightTap();
      } else {
        setTransparentImgUri(null);
      }
    } catch (e) {
      console.warn('[FreezeModal] Background removal error:', e);
      setTransparentImgUri(null);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handlePickFromGallery = async () => {
    HapticsService.lightTap();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processImageWithMatting(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    HapticsService.lightTap();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('提示', '请允许访问相机以拍摄冲动商品');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processImageWithMatting(result.assets[0].uri);
    }
  };

  const handleToggleCutout = () => {
    HapticsService.lightTap();
    if (!transparentImgUri || !rawUserImgUri) return;

    if (isCutoutActive) {
      setSelectedImg({ uri: rawUserImgUri });
      setIsCutoutActive(false);
    } else {
      setSelectedImg({ uri: transparentImgUri });
      setIsCutoutActive(true);
    }
  };

  const handlePasteUrl = async () => {
    HapticsService.lightTap();
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
      if (!name) {
        setName('心动商品');
      }
    }
  };

  const handleConfirm = async () => {
    const numPrice = parseFloat(price);
    if (!name.trim()) {
      Alert.alert('提示', '请输入想买的商品名称');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('提示', '请输入有效的商品金额');
      return;
    }

    HapticsService.mediumTap();
    AudioService.playIceCrackSound();

    // Duration ms calculation (if 0.0028h, that's ~10 seconds for test mode)
    const durationMs = durationHours < 1 ? 10 * 1000 : durationHours * 3600 * 1000;
    const now = Date.now();
    const thawAt = now + durationMs;

    const newItem: FreezerItem = {
      id: 'item-' + Date.now(),
      name: name.trim(),
      price: Math.round(numPrice),
      category: '冲动候选',
      image: selectedImg,
      rawCutout: transparentImgUri
        ? { uri: transparentImgUri }
        : selectedImg === ASSETS.phoneClean
        ? ASSETS.phoneClean
        : rawUserImgUri
        ? { uri: rawUserImgUri }
        : selectedImg,
      originalUrl: url.trim() || undefined,
      freezeDurationHours: durationHours,
      frozenAt: now,
      thawAt: thawAt,
      status: 'freezing',
      breakTapsRemaining: 100,
      calmWaitBonus: 0,
    };

    // Schedule notification
    await NotificationService.scheduleThawNotification(newItem.name, thawAt);

    onFreezeItem(newItem);
    // Reset form
    setName('');
    setPrice('');
    setUrl('');
    setSelectedImg(ASSETS.phoneClean);
    setRawUserImgUri(null);
    setTransparentImgUri(null);
    setIsCutoutActive(true);
    setDurationHours(48);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>❄️ 放入冷冻箱禁闭</Text>
              <Text style={styles.modalSub}>对抗多巴胺冲动，延迟满足</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Image Preview & Picker */}
            <View style={styles.imageSection}>
              <View style={styles.previewBox}>
                <Image source={selectedImg} style={styles.previewImg} resizeMode="contain" />
                {isCutoutActive && (
                  <Image source={ASSETS.iceCubeSolid} style={styles.previewIceOverlay} resizeMode="contain" />
                )}
                {isRemovingBg ? (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.loadingText}>冰块封存中</Text>
                  </View>
                ) : (
                  <View style={styles.iceMaskBadge}>
                    <Text style={styles.iceMaskText}>
                      {transparentImgUri && isCutoutActive ? '❄️ 冰块封存' : isCutoutActive ? '❄️ 冰封就绪' : '待冰封'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.pickButtons}>
                <View style={styles.pickBtnRow}>
                  <TouchableOpacity style={styles.btnSmall} onPress={handlePickFromGallery}>
                    <Text style={styles.btnSmallText}>📷 相册选图</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSmall} onPress={handleTakePhoto}>
                    <Text style={styles.btnSmallText}>⚡ 现场拍照</Text>
                  </TouchableOpacity>
                </View>

                {/* If cutout available, show toggle switch */}
                {transparentImgUri && (
                  <TouchableOpacity
                    style={[styles.cutoutToggleBtn, !isCutoutActive && styles.cutoutToggleBtnOff]}
                    onPress={handleToggleCutout}
                  >
                    <Text style={[styles.cutoutToggleText, !isCutoutActive && styles.cutoutToggleTextOff]}>
                      {isCutoutActive ? '✨ 冰块封存: 已开启' : '📷 原始照片: 点击开启冰封'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Presets Row */}
            <View style={styles.presetsRow}>
              {PRESET_ICONS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.presetItem,
                    selectedImg === p.img && styles.presetItemActive,
                  ]}
                  onPress={() => {
                    HapticsService.lightTap();
                    setSelectedImg(p.img);
                    setRawUserImgUri(null);
                    setTransparentImgUri(null);
                  }}
                >
                  <Image source={p.img} style={styles.presetImg} resizeMode="contain" />
                  <Text style={styles.presetLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form Fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>商品名称 *</Text>
              <TextInput
                style={styles.input}
                placeholder="例如：旗舰曲面屏手机、降噪耳机..."
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>商品金额 (¥) *</Text>
              <TextInput
                style={styles.input}
                placeholder="例如：2999"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelWithAction}>
                <Text style={styles.label}>商品链接 (选填)</Text>
                <TouchableOpacity onPress={handlePasteUrl}>
                  <Text style={styles.pasteText}>粘贴剪贴板</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="粘贴淘宝、京东等购物链接..."
                placeholderTextColor="#64748B"
                value={url}
                onChangeText={setUrl}
              />
            </View>

            {/* Cold Duration Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>选择冷冻期 (建议至少48小时)</Text>
              <View style={styles.durationRow}>
                {[
                  { hours: 24, label: '24 小时\n轻量' },
                  { hours: 48, label: '48 小时\n推荐标准' },
                  { hours: 72, label: '72 小时\n强力禁闭' },
                  { hours: 0.0028, label: '10 秒\n极速体验' },
                ].map((d) => (
                  <TouchableOpacity
                    key={d.hours}
                    style={[
                      styles.durationBtn,
                      durationHours === d.hours && styles.durationBtnActive,
                    ]}
                    onPress={() => {
                      HapticsService.lightTap();
                      setDurationHours(d.hours);
                    }}
                  >
                    <Text
                      style={[
                        styles.durationBtnText,
                        durationHours === d.hours && styles.durationBtnTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.85} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>关入冷冻箱 (FREEZE NOW)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F1E36',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8',
    maxHeight: '90%',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollArea: {
    maxHeight: 460,
  },
  imageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  previewBox: {
    width: 90,
    height: 90,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  previewImg: {
    width: 72,
    height: 72,
  },
  previewIceOverlay: {
    position: 'absolute',
    top: 9,
    left: 9,
    width: 72,
    height: 72,
    zIndex: 5,
    opacity: 0.82,
  },
  iceMaskBadge: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  iceMaskText: {
    fontSize: 9,
    color: '#38BDF8',
    fontWeight: '700',
  },
  pickButtons: {
    flex: 1,
    gap: 8,
  },
  pickBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSmall: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 25, 47, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    zIndex: 10,
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  cutoutToggleBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoutToggleBtnOff: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  cutoutToggleText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cutoutToggleTextOff: {
    color: '#94A3B8',
  },
  btnSmallText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  presetItem: {
    width: 68,
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: '#13233F',
  },
  presetItemActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  presetImg: {
    width: 38,
    height: 38,
  },
  presetLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pasteText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#13233F',
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#FFFFFF',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  durationBtn: {
    flex: 1,
    backgroundColor: '#13233F',
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  durationBtnActive: {
    borderColor: '#C8FA00',
    backgroundColor: 'rgba(200, 250, 0, 0.15)',
  },
  durationBtnText: {
    fontSize: 10,
    textAlign: 'center',
    color: '#94A3B8',
    fontWeight: '600',
    lineHeight: 14,
  },
  durationBtnTextActive: {
    color: '#C8FA00',
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#071527',
    letterSpacing: 0.5,
  },
});
