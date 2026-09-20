import { requireOptionalNativeModule } from 'expo-modules-core';

// Dynamically link native module if present in standalone / custom dev builds
const AppleVisionMattingModule = requireOptionalNativeModule('AppleVisionMatting');

/**
 * Checks if Apple Vision on-device hardware matting is supported and available in current runtime.
 * Returns true when running on iOS 17+ in a standalone build with AppleVisionMatting linked.
 * Returns false in Expo Go, Android, or Web.
 */
export function isAppleVisionAvailable(): boolean {
  return AppleVisionMattingModule != null;
}

/**
 * Executes sub-second on-device foreground matting using Apple Neural Engine.
 * @param imageUri Local file URI (file://...) of the image to remove background from
 * @returns Promise resolving to the local file URI of the transparent PNG
 */
export async function removeBackgroundNative(imageUri: string): Promise<string> {
  if (!AppleVisionMattingModule) {
    throw new Error('AppleVisionMatting native module is not available in this environment');
  }
  return await AppleVisionMattingModule.removeBackground(imageUri);
}

/**
 * Executes on-device foreground matting and embeds the item into ice_cube_solid.png.
 * @param imageUri Local file URI of the user image
 * @param iceCubePath Local file path or URI of ice_cube_solid.png asset
 * @returns Promise resolving to { cutoutUri: string, frozenUri: string }
 */
export async function freezeInIceCubeNative(
  imageUri: string,
  iceCubePath: string
): Promise<{ cutoutUri: string; frozenUri: string }> {
  if (!AppleVisionMattingModule) {
    throw new Error('AppleVisionMatting native module is not available in this environment');
  }
  return await AppleVisionMattingModule.freezeInIceCube(imageUri, iceCubePath);
}

export default {
  isAppleVisionAvailable,
  removeBackgroundNative,
  freezeInIceCubeNative,
};
