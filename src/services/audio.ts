import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { SOUNDS } from '../constants/assets';

let coinPlayer: AudioPlayer | null = null;
let iceCrackPlayer: AudioPlayer | null = null;
let fanfarePlayer: AudioPlayer | null = null;

// Audio Context fallback for Web environments
let webAudioCtx: any = null;

function getWebAudioContext() {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!webAudioCtx) {
        webAudioCtx = new AudioContextClass();
      }
      if (webAudioCtx.state === 'suspended') {
        webAudioCtx.resume();
      }
      return webAudioCtx;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export const AudioService = {
  async init(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
          });
        } catch (e) {}

        try {
          coinPlayer = createAudioPlayer(SOUNDS.coin);
          iceCrackPlayer = createAudioPlayer(SOUNDS.iceCrack);
          fanfarePlayer = createAudioPlayer(SOUNDS.fanfare);
        } catch (e) {
          console.log('expo-audio createPlayer note:', e);
        }
      }
    } catch (e) {
      console.log('Audio init note:', e);
    }
  },

  async playCoinSound(): Promise<void> {
    try {
      if (coinPlayer) {
        coinPlayer.currentTime = 0;
        coinPlayer.play();
        return;
      }
    } catch (e) {
      // fallback to web audio
    }

    // Web Audio synthesizer fallback (high quality dual chime)
    const ctx = getWebAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now);
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08);
        gain2.gain.setValueAtTime(0.4, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.45);
      } catch (e) {}
    }
  },

  async playIceCrackSound(): Promise<void> {
    try {
      if (iceCrackPlayer) {
        iceCrackPlayer.currentTime = 0;
        iceCrackPlayer.play();
        return;
      }
    } catch (e) {
      // fallback
    }

    const ctx = getWebAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    }
  },

  async playFanfareSound(): Promise<void> {
    try {
      if (fanfarePlayer) {
        fanfarePlayer.currentTime = 0;
        fanfarePlayer.play();
        return;
      }
    } catch (e) {
      // fallback
    }

    const ctx = getWebAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.12;
          const end = start + (idx === 3 ? 0.5 : 0.15);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, end);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(end);
        });
      } catch (e) {}
    }
  },
};
