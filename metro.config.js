const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

let ort;
try {
  ort = require('onnxruntime-node');
} catch (e) {
  ort = require('onnxruntime-web');
}

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('onnx');

const APPLE_VISION_CLI = path.join(__dirname, 'bin/apple-vision-engine');
const BIREFNET_MODEL_PATH = path.join(__dirname, 'assets/models/birefnet.onnx');
const RMBG_MODEL_PATH = path.join(__dirname, 'assets/models/rmbg-1.4.onnx');
const U2NETP_MODEL_PATH = path.join(__dirname, 'assets/models/u2netp.onnx');
const ICE_CUBE_SOLID_PATH = path.join(__dirname, 'assets/ice_cube_solid.png');

let birefnetPipeline = null;
let ortSession = null;
let activeModelType = null;

async function getBiRefNetPipe() {
  if (!birefnetPipeline) {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;
    birefnetPipeline = await pipeline('image-segmentation', 'onnx-community/BiRefNet_lite-ONNX');
    console.log('[Metro BG Removal] BiRefNet model loaded successfully (1024x1024, MIT Commercial).');
  }
  return birefnetPipeline;
}

async function getSession() {
  if (fs.existsSync(BIREFNET_MODEL_PATH)) {
    try {
      await getBiRefNetPipe();
      activeModelType = 'birefnet';
      return { type: 'birefnet' };
    } catch (e) {
      console.warn('[Metro BG Removal] BiRefNet load failed, falling back:', e.message);
    }
  }

  if (!ortSession) {
    if (fs.existsSync(RMBG_MODEL_PATH)) {
      ortSession = await ort.InferenceSession.create(RMBG_MODEL_PATH);
      activeModelType = 'rmbg';
      console.log('[Metro BG Removal] BRIA RMBG-1.4 model loaded successfully.');
    } else if (fs.existsSync(U2NETP_MODEL_PATH)) {
      ortSession = await ort.InferenceSession.create(U2NETP_MODEL_PATH);
      activeModelType = 'u2netp';
      console.log('[Metro BG Removal] U-2-Netp model loaded successfully.');
    }
  }
  return { session: ortSession, type: activeModelType };
}

async function embedInIceCube(cutoutPngBuffer) {
  if (!fs.existsSync(ICE_CUBE_SOLID_PATH)) return cutoutPngBuffer;

  try {
    const cubeMeta = await sharp(ICE_CUBE_SOLID_PATH).metadata();
    const cubeWidth = cubeMeta.width || 203;
    const cubeHeight = cubeMeta.height || 210;

    let trimmedBuffer;
    try {
      trimmedBuffer = await sharp(cutoutPngBuffer).trim().toBuffer();
    } catch (e) {
      trimmedBuffer = cutoutPngBuffer;
    }

    const maxW = 105;
    const maxH = 110;

    const resizedItem = await sharp(trimmedBuffer)
      .resize(maxW, maxH, { fit: 'inside' })
      .toBuffer();

    const itemMeta = await sharp(resizedItem).metadata();
    const itemW = itemMeta.width || maxW;
    const itemH = itemMeta.height || maxH;

    const left = Math.round(102 - itemW / 2);
    const top = Math.round(96 - itemH / 2);

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

    const frozenBuffer = await sharp(ICE_CUBE_SOLID_PATH)
      .composite([
        { input: resizedItem, left, top },
        { input: overlayPng, left: 0, top: 0 }
      ])
      .png()
      .toBuffer();

    return frozenBuffer;
  } catch (err) {
    console.warn('[Metro BG Removal] Failed to embed in ice_cube_solid:', err);
    return cutoutPngBuffer;
  }
}

async function removeBgBuffer(imageBuffer, requestedModel) {
  const normalizedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  const { data: origRgb, info: origInfo } = await sharp(normalizedBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = origInfo.width;
  const height = origInfo.height;

  let outBuffer = null;
  let modelUsed = 'unknown';

  // Stage 1: Try Apple Vision Engine (250ms, native macOS Neural Engine)
  const useVision = (!requestedModel || requestedModel === 'apple-vision') && fs.existsSync(APPLE_VISION_CLI);
  if (useVision) {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempInput = `/private/tmp/in_${tempId}.jpg`;
    const tempOutput = `/private/tmp/out_${tempId}.png`;

    try {
      await sharp(normalizedBuffer).jpeg({ quality: 95 }).toFile(tempInput);
      const tVision = Date.now();
      const { stdout } = await execFileAsync(APPLE_VISION_CLI, [tempInput, tempOutput]);
      console.log(`[Metro BG Removal] Apple Vision Engine executed in ${Date.now() - tVision}ms (${stdout.trim()})`);

      if (fs.existsSync(tempOutput)) {
        outBuffer = fs.readFileSync(tempOutput);
        modelUsed = 'apple-vision';
      }
    } catch (visionErr) {
      console.warn(`[Metro BG Removal] Apple Vision fallback to RMBG-1.4:`, visionErr.message);
    } finally {
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (e) {}
    }
  }

  // Stage 2: Robust Fallback to BRIA RMBG-1.4 (1.5s, native ONNX)
  if (!outBuffer && fs.existsSync(RMBG_MODEL_PATH)) {
    try {
      if (!ortSession) {
        ortSession = await ort.InferenceSession.create(RMBG_MODEL_PATH);
      }
      const session = ortSession;
      const tRmbg = Date.now();
      const DIM = 1024;
      const raw1024 = await sharp(normalizedBuffer)
        .resize(DIM, DIM, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();

      const floatData = new Float32Array(3 * DIM * DIM);
      const planeSize = DIM * DIM;
      for (let i = 0; i < planeSize; i++) {
        floatData[0 * planeSize + i] = raw1024[i * 3] / 255.0 - 0.5;
        floatData[1 * planeSize + i] = raw1024[i * 3 + 1] / 255.0 - 0.5;
        floatData[2 * planeSize + i] = raw1024[i * 3 + 2] / 255.0 - 0.5;
      }

      const inputTensor = new ort.Tensor('float32', floatData, [1, 3, DIM, DIM]);
      const results = await session.run({ [session.inputNames[0]]: inputTensor });
      const maskData = results[session.outputNames[0]].data;

      let min = Infinity, max = -Infinity;
      for (let i = 0; i < maskData.length; i++) {
        const v = maskData[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = max - min || 1;

      const alphaBuffer = Buffer.alloc(DIM * DIM);
      for (let i = 0; i < maskData.length; i++) {
        const norm = (maskData[i] - min) / range;
        if (norm < 0.20) {
          alphaBuffer[i] = 0;
        } else if (norm > 0.80) {
          alphaBuffer[i] = 255;
        } else {
          const t = (norm - 0.20) / 0.60;
          alphaBuffer[i] = Math.round(t * t * (3 - 2 * t) * 255);
        }
      }

      const { data: resizedAlpha } = await sharp(alphaBuffer, {
        raw: { width: DIM, height: DIM, channels: 1 }
      })
        .toColourspace('b-w')
        .resize(width, height, { kernel: 'lanczos3' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const finalRgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        finalRgba[i * 4] = origRgb[i * 3];
        finalRgba[i * 4 + 1] = origRgb[i * 3 + 1];
        finalRgba[i * 4 + 2] = origRgb[i * 3 + 2];
        finalRgba[i * 4 + 3] = resizedAlpha[i];
      }

      outBuffer = await sharp(finalRgba, {
        raw: { width, height, channels: 4 }
      }).png().toBuffer();
      modelUsed = 'rmbg-1.4';
      console.log(`[Metro BG Removal] RMBG-1.4 completed in ${Date.now() - tRmbg}ms`);
    } catch (rmbgErr) {
      console.warn('[Metro BG Removal] RMBG fallback failed:', rmbgErr.message);
    }
  }

  // Stage 3: Fast Fallback to U-2-Netp (300ms)
  if (!outBuffer && fs.existsSync(U2NETP_MODEL_PATH)) {
    try {
      const uSession = await ort.InferenceSession.create(U2NETP_MODEL_PATH);
      const DIM = 320;
      const raw320 = await sharp(normalizedBuffer)
        .resize(DIM, DIM, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();

      const floatData = new Float32Array(1 * 3 * DIM * DIM);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];
      for (let i = 0; i < DIM * DIM; i++) {
        floatData[0 * DIM * DIM + i] = (raw320[i * 3] / 255.0 - mean[0]) / std[0];
        floatData[1 * DIM * DIM + i] = (raw320[i * 3 + 1] / 255.0 - mean[1]) / std[1];
        floatData[2 * DIM * DIM + i] = (raw320[i * 3 + 2] / 255.0 - mean[2]) / std[2];
      }

      const tensor = new ort.Tensor('float32', floatData, [1, 3, DIM, DIM]);
      const results = await uSession.run({ [uSession.inputNames[0]]: tensor });
      const maskData = results[uSession.outputNames[0]].data;

      let min = Infinity, max = -Infinity;
      for (let i = 0; i < maskData.length; i++) {
        const val = maskData[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const range = max - min || 1;

      const alphaBuffer = Buffer.alloc(DIM * DIM);
      for (let i = 0; i < maskData.length; i++) {
        const norm = (maskData[i] - min) / range;
        if (norm > 0.15) {
          alphaBuffer[i] = Math.round(Math.min(1.0, (norm - 0.15) / 0.70) * 255);
        }
      }

      const { data: resizedAlpha } = await sharp(alphaBuffer, {
        raw: { width: DIM, height: DIM, channels: 1 }
      })
        .toColourspace('b-w')
        .resize(width, height, { kernel: 'lanczos3' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const finalRgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        finalRgba[i * 4] = origRgb[i * 3];
        finalRgba[i * 4 + 1] = origRgb[i * 3 + 1];
        finalRgba[i * 4 + 2] = origRgb[i * 3 + 2];
        finalRgba[i * 4 + 3] = resizedAlpha[i];
      }

      outBuffer = await sharp(finalRgba, {
        raw: { width, height, channels: 4 }
      }).png().toBuffer();
      modelUsed = 'u2netp';
    } catch (uErr) {
      console.warn('[Metro BG Removal] U2NetP fallback failed:', uErr.message);
    }
  }

  // Stage 4: Absolute Fallback - Use normalized original image
  if (!outBuffer) {
    console.warn('[Metro BG Removal] All matting models failed, using original normalized image');
    outBuffer = await sharp(normalizedBuffer).png().toBuffer();
    modelUsed = 'original-fallback';
  }

  const frozenBuffer = await embedInIceCube(outBuffer);
  return { frozenBuffer, rawCutoutBuffer: outBuffer, modelUsed };
}

config.server = {
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Serve static cutouts generated by matting pipeline
      if (req.url.startsWith('/cutouts/')) {
        const filename = path.basename(req.url);
        const filePath = path.join('/private/tmp', filename);
        if (fs.existsSync(filePath)) {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
      }

      if (req.url === '/_remove_bg' && req.method === 'POST') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const base64Data = body.image.replace(/^data:image\/[a-z]+;base64,/, '');
            const inputBuf = Buffer.from(base64Data, 'base64');
            const { frozenBuffer, rawCutoutBuffer, modelUsed } = await removeBgBuffer(inputBuf, body.model);

            const fileId = Date.now();
            const cutoutFileName = `cutout_${fileId}.png`;
            const cutoutFilePath = path.join('/private/tmp', cutoutFileName);
            fs.writeFileSync(cutoutFilePath, rawCutoutBuffer);

            const host = req.headers.host || '127.0.0.1:8082';
            const proto = req.headers['x-forwarded-proto'] || (host.includes('exp.direct') || host.includes('ngrok') ? 'https' : 'http');
            const cutoutUrl = `${proto}://${host}/cutouts/${cutoutFileName}`;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              url: cutoutUrl,
              cutoutUrl: cutoutUrl,
              result: cutoutUrl,
              rawCutout: 'data:image/png;base64,' + rawCutoutBuffer.toString('base64'),
              model: modelUsed
            }));
            console.log(`[Metro 8082] Matting finished with [${modelUsed.toUpperCase()}], Cutout URL: ${cutoutUrl}`);
          } catch (err) {
            console.error('[Metro Server RemoveBg Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      return metroMiddleware(req, res, next);
    };
  }
};

module.exports = config;
