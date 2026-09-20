import { NativeModules, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const LOCAL_LAN_ENDPOINT = 'http://192.168.10.109:8088/_remove_bg';
const LOCALHOST_ENDPOINT = 'http://localhost:8088/_remove_bg';

/**
 * Safely resolves local URI for the solid ice cube asset
 */
async function getIceCubeSolidLocalUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(require('../../assets/ice_cube_solid.png'));
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    return asset.localUri || null;
  } catch (e) {
    return null;
  }
}

/**
 * Extracts Metro server origin from NativeModules.SourceCode or window.location
 */
function getMetroOrigin(): string | null {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return 'http://localhost:8081';
  }

  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^(https?:\/\/[^\/]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extracts hostname from Metro origin (e.g. 192.168.10.109) to automatically match active Wi-Fi
 */
function getMetroHost(): string | null {
  const origin = getMetroOrigin();
  if (!origin) return null;
  const match = origin.match(/^https?:\/\/([^:]+)/);
  return match ? match[1] : null;
}

/**
 * Helper to fetch with timeout (default 15s to avoid freezing mobile UI)
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Calls background removal matting server endpoint
 */
async function callMattingApi(base64Image: string): Promise<string | null> {
  const metroOrigin = getMetroOrigin();
  const metroHost = getMetroHost();

  const candidates: string[] = [];

  // Priority 1: Current active Metro origin (the exact tunnel or Wi-Fi origin the app loaded from!)
  if (metroOrigin) {
    candidates.push(`${metroOrigin}/_remove_bg`);
  }

  // Priority 2: If metroHost is an IP (not a tunnel domain), try local ports 8082 and 8088
  if (metroHost && !metroHost.includes('exp.direct') && !metroHost.includes('ngrok')) {
    candidates.push(`http://${metroHost}:8082/_remove_bg`);
    candidates.push(`http://${metroHost}:8088/_remove_bg`);
  }

  // Priority 3: Local LAN IP
  candidates.push('http://192.168.10.109:8082/_remove_bg');
  candidates.push(LOCAL_LAN_ENDPOINT);

  // Priority 4: Localhost (Web / Simulator)
  candidates.push('http://localhost:8082/_remove_bg');
  candidates.push(LOCALHOST_ENDPOINT);

  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean) as string[];

  const payload = JSON.stringify({
    image: base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`,
  });

  for (const endpoint of uniqueCandidates) {
    try {
      console.log('[BackgroundRemoval] Trying endpoint:', endpoint);
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: payload,
      }, 15000);

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`[BackgroundRemoval] Endpoint ${endpoint} returned non-JSON`);
        continue;
      }

      if (data) {
        if (data.cutoutUrl) {
          console.log('[BackgroundRemoval] Successfully received cutout URL from:', endpoint, data.cutoutUrl);
          return data.cutoutUrl;
        }
        if (data.url) {
          console.log('[BackgroundRemoval] Successfully received image URL from:', endpoint, data.url);
          return data.url;
        }
        if (data.result && (data.result.startsWith('http://') || data.result.startsWith('https://'))) {
          console.log('[BackgroundRemoval] Successfully received result URL from:', endpoint, data.result);
          return data.result;
        }
        if (data.rawCutout) {
          console.log('[BackgroundRemoval] Successfully received base64 cutout from:', endpoint);
          return data.rawCutout;
        }
        if (data.result) {
          console.log('[BackgroundRemoval] Successfully received result from:', endpoint);
          return data.result;
        }
      }
    } catch (e: any) {
      console.warn(`[BackgroundRemoval] Endpoint ${endpoint} request failed:`, e?.message || e);
    }
  }

  return null;
}

/**
 * Web fallback using in-browser Canvas + Wasm if local server is unreachable
 */
async function removeBackgroundWebFallback(imageUri: string): Promise<string> {
  if (typeof window === 'undefined' || !(window as any).ort) {
    throw new Error('Web ORT not loaded');
  }
  return imageUri;
}

/**
 * Primary public background removal entry point.
 * Prioritizes on-device Apple Neural Engine (standalone builds),
 * then falls back to local Apple Vision bridge server (Expo Go),
 * and finally graceful fallback.
 */
export async function removeBackground(imageUri: string): Promise<string> {
  const startTime = Date.now();
  console.log('[BackgroundRemoval] Starting background removal for image...');

  try {
    // Step 0: Check if Apple Vision Native Module is directly linked on iOS (standalone / dev client)
    if (Platform.OS === 'ios') {
      try {
        // Dynamic import to prevent crash when module isn't linked in Expo Go
        const AppleVision = require('apple-vision-matting');
        if (AppleVision?.isAppleVisionAvailable && AppleVision.isAppleVisionAvailable()) {
          console.log('[BackgroundRemoval] Running on-device Apple Vision Neural Engine matting...');
          // Return clean cutout without baking in the ice cube
          if (AppleVision.removeBackgroundNative) {
            const cutoutUri = await AppleVision.removeBackgroundNative(imageUri);
            if (cutoutUri) {
              console.log(`[BackgroundRemoval] On-device cutout completed in ${Date.now() - startTime}ms`);
              return cutoutUri;
            }
          }

          const iceCubeUri = await getIceCubeSolidLocalUri();
          if (iceCubeUri && AppleVision.freezeInIceCubeNative) {
            const frozenResult = await AppleVision.freezeInIceCubeNative(imageUri, iceCubeUri);
            if (frozenResult?.cutoutUri) {
              return frozenResult.cutoutUri;
            }
            if (frozenResult?.frozenUri) {
              console.log(`[BackgroundRemoval] On-device fallback completed in ${Date.now() - startTime}ms`);
              return frozenResult.frozenUri;
            }
          }
        }
      } catch (nativeErr) {
        console.log('[BackgroundRemoval] Native Apple Vision not available in current runtime, using dev bridge');
      }
    }
    // Step 1: Preprocess and resize to HD dimensions (1024 max width) & get clean base64
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1024 } }],
      { base64: true, format: ImageManipulator.SaveFormat.PNG }
    );

    if (!manipResult.base64) {
      console.warn('[BackgroundRemoval] Could not generate base64 for image, returning original');
      return imageUri;
    }

    // Step 2: Call high-performance matting server
    const serverResult = await callMattingApi(manipResult.base64);

    if (serverResult) {
      const elapsed = Date.now() - startTime;
      console.log(`[BackgroundRemoval] Successfully received result from server in ${elapsed}ms!`);

      // If server returned a direct HTTP URL, download to local cache file for offline stability
      if (serverResult.startsWith('http://') || serverResult.startsWith('https://')) {
        try {
          const localPath = `${FileSystem.cacheDirectory}cutout_${Date.now()}.png`;
          const downloadRes = await FileSystem.downloadAsync(serverResult, localPath);
          console.log('[BackgroundRemoval] Downloaded server cutout to local cache:', downloadRes.uri);
          return downloadRes.uri;
        } catch (downloadErr) {
          try {
            const fileResult = await ImageManipulator.manipulateAsync(
              serverResult,
              [],
              { format: ImageManipulator.SaveFormat.PNG }
            );
            console.log(`[BackgroundRemoval] Cached HTTP image via ImageManipulator: ${fileResult.uri}`);
            return fileResult.uri;
          } catch (cacheErr) {
            console.log('[BackgroundRemoval] Using direct image URL:', serverResult);
            return serverResult;
          }
        }
      }

      // If server returned base64 data URI, safely write to file via FileSystem
      if (serverResult.startsWith('data:')) {
        try {
          const base64Data = serverResult.replace(/^data:image\/[a-z]+;base64,/, '');
          const localPath = `${FileSystem.cacheDirectory}cutout_${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(localPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('[BackgroundRemoval] Saved base64 to local FileSystem:', localPath);
          return localPath;
        } catch (fsErr) {
          console.warn('[BackgroundRemoval] Failed to write base64 to file, returning data URI:', fsErr);
          return serverResult;
        }
      }

      return serverResult;
    }

    // Step 3: Web-specific fallback
    if (Platform.OS === 'web') {
      try {
        return await removeBackgroundWebFallback(imageUri);
      } catch (e) {
        // ignore
      }
    }

    console.warn('[BackgroundRemoval] All matting endpoints failed, using original image');
    return imageUri;
  } catch (error) {
    console.error('[BackgroundRemoval] Unexpected error:', error);
    return imageUri;
  }
}
