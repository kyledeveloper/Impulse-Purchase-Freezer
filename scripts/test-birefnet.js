const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

const MODEL_PATH = path.join(__dirname, '../assets/models/birefnet.onnx');
const TEST_IMAGE_PATH = '/private/tmp/cluttered_desk.jpg';
const OUTPUT_CUTOUT_PATH = '/private/tmp/test_birefnet_cutout.png';
const OUTPUT_FROZEN_PATH = '/private/tmp/test_birefnet_frozen.png';
const ICE_CUBE_SOLID_PATH = path.join(__dirname, '../assets/ice_cube_solid.png');

async function embedInIceCube(cutoutPngBuffer) {
  if (!fs.existsSync(ICE_CUBE_SOLID_PATH)) {
    console.warn('ice_cube_solid.png not found');
    return cutoutPngBuffer;
  }

  // 1. Trim surrounding transparent padding
  let trimmedBuffer;
  try {
    trimmedBuffer = await sharp(cutoutPngBuffer).trim().toBuffer();
  } catch (e) {
    trimmedBuffer = cutoutPngBuffer;
  }

  // 2. Scale down so the item strictly fits inside the ice cube core (max 105x110)
  const maxW = 105;
  const maxH = 110;

  const resizedItem = await sharp(trimmedBuffer)
    .resize(maxW, maxH, { fit: 'inside' })
    .toBuffer();

  const itemMeta = await sharp(resizedItem).metadata();
  const itemW = itemMeta.width || maxW;
  const itemH = itemMeta.height || maxH;

  // Center inside the ice cavity: cx = 102, cy = 96
  const left = Math.round(102 - itemW / 2);
  const top = Math.round(96 - itemH / 2);

  // 3. Create front ice sheen (38% opacity) from ice_cube_solid for a solid ice encasing effect
  const { data: solidRaw, info: solidInfo } = await sharp(ICE_CUBE_SOLID_PATH)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const overlayBuf = Buffer.from(solidRaw);
  for (let i = 3; i < overlayBuf.length; i += 4) {
    overlayBuf[i] = Math.round(overlayBuf[i] * 0.38);
  }
  const overlayPng = await sharp(overlayBuf, {
    raw: { width: solidInfo.width, height: solidInfo.height, channels: 4 }
  }).png().toBuffer();

  // 4. Composite: solid ice base -> item -> front ice overlay
  const frozenBuffer = await sharp(ICE_CUBE_SOLID_PATH)
    .composite([
      { input: resizedItem, left, top },
      { input: overlayPng, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();

  return frozenBuffer;
}

async function testBiRefNet() {
  if (!fs.existsSync(MODEL_PATH)) {
    console.error('Model not found at:', MODEL_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error('Test image not found at:', TEST_IMAGE_PATH);
    process.exit(1);
  }

  console.log('Loading BiRefNet session from:', MODEL_PATH);
  const session = await ort.InferenceSession.create(MODEL_PATH);
  console.log('Session loaded successfully.');
  console.log('Input names:', session.inputNames);
  console.log('Output names:', session.outputNames);

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const startTime = Date.now();
  const rawImage = fs.readFileSync(TEST_IMAGE_PATH);

  // 1. Materialize EXIF rotation
  const normalizedBuffer = await sharp(rawImage).rotate().toBuffer();
  const { data: origRgb, info: origInfo } = await sharp(normalizedBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = origInfo.width;
  const height = origInfo.height;
  console.log(`Input image original size: ${width}x${height}`);

  // 2. Resize to 1024x1024
  const DIM = 1024;
  const raw1024 = await sharp(normalizedBuffer)
    .resize(DIM, DIM, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  // 3. ImageNet normalization: (pixel/255.0 - mean) / std
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const floatData = new Float32Array(3 * DIM * DIM);
  const planeSize = DIM * DIM;

  for (let i = 0; i < planeSize; i++) {
    floatData[0 * planeSize + i] = (raw1024[i * 3] / 255.0 - mean[0]) / std[0];
    floatData[1 * planeSize + i] = (raw1024[i * 3 + 1] / 255.0 - mean[1]) / std[1];
    floatData[2 * planeSize + i] = (raw1024[i * 3 + 2] / 255.0 - mean[2]) / std[2];
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, DIM, DIM]);
  console.log('Running ONNX inference...');
  const inferStart = Date.now();
  const results = await session.run({ [inputName]: inputTensor });
  console.log(`Inference finished in ${Date.now() - inferStart}ms`);

  const outputTensor = results[outputName];
  const maskData = outputTensor.data;
  console.log(`Output tensor dims: [${outputTensor.dims.join(', ')}], total values: ${maskData.length}`);

  // 4. Check min/max & apply Sigmoid
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < maskData.length; i++) {
    const v = maskData[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log(`Raw logits range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);

  // Build alpha buffer (1024x1024)
  const alphaBuffer = Buffer.alloc(DIM * DIM);
  let foregroundCount = 0;

  for (let i = 0; i < maskData.length; i++) {
    // Sigmoid
    const logit = maskData[i];
    const sig = 1 / (1 + Math.exp(-logit));
    
    // Smooth thresholding
    let alpha;
    if (sig < 0.2) {
      alpha = 0;
    } else if (sig > 0.8) {
      alpha = 255;
      foregroundCount++;
    } else {
      const t = (sig - 0.2) / 0.6;
      alpha = Math.round(t * t * (3 - 2 * t) * 255);
      if (alpha > 30) foregroundCount++;
    }
    alphaBuffer[i] = alpha;
  }

  console.log(`Foreground ratio: ${(foregroundCount / (DIM * DIM) * 100).toFixed(1)}%`);

  // 5. Resize alpha to original dimensions
  const { data: resizedAlpha } = await sharp(alphaBuffer, {
    raw: { width: DIM, height: DIM, channels: 1 }
  })
    .toColourspace('b-w')
    .resize(width, height, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 6. Interleave RGBA
  const finalRgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    finalRgba[i * 4] = origRgb[i * 3];
    finalRgba[i * 4 + 1] = origRgb[i * 3 + 1];
    finalRgba[i * 4 + 2] = origRgb[i * 3 + 2];
    finalRgba[i * 4 + 3] = resizedAlpha[i];
  }

  const cutoutBuffer = await sharp(finalRgba, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  fs.writeFileSync(OUTPUT_CUTOUT_PATH, cutoutBuffer);
  console.log('Saved cutout to:', OUTPUT_CUTOUT_PATH);

  // 7. Embed into ice cube
  const frozenBuffer = await embedInIceCube(cutoutBuffer);
  fs.writeFileSync(OUTPUT_FROZEN_PATH, frozenBuffer);
  console.log('Saved frozen ice cube to:', OUTPUT_FROZEN_PATH);

  console.log(`Total test elapsed: ${Date.now() - startTime}ms`);
}

testBiRefNet().catch(console.error);
