const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const child_process = require('child_process');
const util = require('util');
const execFile = util.promisify(child_process.execFile);

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('[Server 8088] Uncaught Exception trapped:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server 8088] Unhandled Rejection trapped at:', promise, 'reason:', reason);
});

let ort;
try {
  ort = require('onnxruntime-node');
  console.log('[Server 8088] Using onnxruntime-node (native C++ acceleration)');
} catch (e) {
  ort = require('onnxruntime-web');
  console.log('[Server 8088] Using onnxruntime-web (wasm)');
}

const PORT = 8088;
const APPLE_VISION_CLI = path.join(__dirname, '../bin/apple-vision-engine');
const RMBG_MODEL_PATH = path.join(__dirname, '../assets/models/rmbg-1.4.onnx');
const U2NETP_MODEL_PATH = path.join(__dirname, '../assets/models/u2netp.onnx');
const ICE_CUBE_SOLID_PATH = path.join(__dirname, '../assets/ice_cube_solid.png');

let rmbgSession = null;
let u2netpSession = null;

async function getRmbgSession() {
  if (!rmbgSession && fs.existsSync(RMBG_MODEL_PATH)) {
    console.log('[Server 8088] Pre-warming RMBG-1.4 ONNX session...');
    rmbgSession = await ort.InferenceSession.create(RMBG_MODEL_PATH, {
      executionProviders: ['cpu']
    });
    console.log('[Server 8088] RMBG-1.4 ready (1024x1024).');
  }
  return rmbgSession;
}

async function getU2netpSession() {
  if (!u2netpSession && fs.existsSync(U2NETP_MODEL_PATH)) {
    u2netpSession = await ort.InferenceSession.create(U2NETP_MODEL_PATH, {
      executionProviders: ['cpu']
    });
  }
  return u2netpSession;
}

/**
 * Embeds a transparent item cutout inside ice_cube_solid.png
 * Scales the item to strictly fit within the inner ice volume (max 105x110)
 * Uses ice_cube_solid with a front ice sheen (no oval frame)
 */
async function embedInIceCube(cutoutPngBuffer) {
  if (!fs.existsSync(ICE_CUBE_SOLID_PATH)) return cutoutPngBuffer;

  try {
    const cubeMeta = await sharp(ICE_CUBE_SOLID_PATH).metadata();
    const cubeWidth = cubeMeta.width || 203;
    const cubeHeight = cubeMeta.height || 210;

    // 1. Trim surrounding transparent padding to obtain tight item bounding box
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
  } catch (err) {
    console.warn('[Server 8088] Failed to embed in ice_cube_solid:', err);
    return cutoutPngBuffer;
  }
}

/**
 * Removes background from image buffer using multi-stage resilient pipeline
 */
async function removeBgBuffer(imageBuffer, requestedModel) {
  const startTime = Date.now();

  try {
    fs.writeFileSync('/private/tmp/debug_user_input.jpg', imageBuffer);
  } catch (e) {}

  // 1. Materialize EXIF rotation into true pixel buffer
  const normalizedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  const { data: origRgb, info: origInfo } = await sharp(normalizedBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = origInfo.width;
  const height = origInfo.height;

  let outBuffer = null;
  let modelUsed = 'unknown';

  // Stage 1: Try Apple Vision Engine (250ms)
  const useVision = (!requestedModel || requestedModel === 'apple-vision') && fs.existsSync(APPLE_VISION_CLI);
  if (useVision) {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempInput = `/private/tmp/in_${tempId}.jpg`;
    const tempOutput = `/private/tmp/out_${tempId}.png`;

    try {
      await sharp(normalizedBuffer).jpeg({ quality: 95 }).toFile(tempInput);
      const tVision = Date.now();
      const { stdout } = await execFile(APPLE_VISION_CLI, [tempInput, tempOutput]);
      console.log(`[Server 8088] Apple Vision Engine executed in ${Date.now() - tVision}ms (${stdout.trim()})`);

      if (fs.existsSync(tempOutput)) {
        outBuffer = fs.readFileSync(tempOutput);
        modelUsed = 'apple-vision';
      }
    } catch (visionErr) {
      console.warn(`[Server 8088] Apple Vision found no foreground or had issue (${visionErr.message?.trim() || visionErr}), falling back to RMBG-1.4...`);
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
      const session = await getRmbgSession();
      if (session) {
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
        console.log(`[Server 8088] RMBG-1.4 fallback completed in ${Date.now() - tRmbg}ms`);
      }
    } catch (rmbgErr) {
      console.warn('[Server 8088] RMBG fallback failed:', rmbgErr.message);
    }
  }

  // Stage 3: Fast Fallback to U-2-Netp (300ms)
  if (!outBuffer && fs.existsSync(U2NETP_MODEL_PATH)) {
    try {
      const session = await getU2netpSession();
      if (session) {
        const DIM = 320;
        const raw320 = await sharp(normalizedBuffer)
          .resize(DIM, DIM, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer();

        const floatData = new Float32Array(3 * DIM * DIM);
        const planeSize = DIM * DIM;
        for (let i = 0; i < planeSize; i++) {
          floatData[0 * planeSize + i] = (raw320[i * 3] / 255.0 - 0.485) / 0.229;
          floatData[1 * planeSize + i] = (raw320[i * 3 + 1] / 255.0 - 0.456) / 0.224;
          floatData[2 * planeSize + i] = (raw320[i * 3 + 2] / 255.0 - 0.406) / 0.225;
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
          alphaBuffer[i] = norm > 0.4 ? 255 : 0;
        }

        const { data: resizedAlpha } = await sharp(alphaBuffer, {
          raw: { width: DIM, height: DIM, channels: 1 }
        })
          .resize(width, height)
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
      }
    } catch (uErr) {
      console.warn('[Server 8088] U2NetP fallback failed:', uErr.message);
    }
  }

  // Stage 4: Absolute Fallback - Use normalized original image
  if (!outBuffer) {
    console.warn('[Server 8088] All matting models failed, using original normalized image');
    outBuffer = await sharp(normalizedBuffer).png().toBuffer();
    modelUsed = 'original-fallback';
  }

  // Embed cleanly inside ice_cube_solid.png
  const frozenBuffer = await embedInIceCube(outBuffer);

  const fileId = Date.now();
  const frozenFileName = `frozen_${fileId}.png`;
  const cutoutFileName = `cutout_${fileId}.png`;
  const frozenFilePath = path.join('/private/tmp', frozenFileName);
  const cutoutFilePath = path.join('/private/tmp', cutoutFileName);

  try {
    fs.writeFileSync('/private/tmp/debug_user_cutout.png', outBuffer);
    fs.writeFileSync('/private/tmp/debug_user_frozen.png', frozenBuffer);
    fs.writeFileSync(frozenFilePath, frozenBuffer);
    fs.writeFileSync(cutoutFilePath, outBuffer);
  } catch (e) {}

  console.log(`[Server 8088] Total processing time (${modelUsed.toUpperCase()} + Solid Ice Cube Embed): ${Date.now() - startTime}ms`);
  return {
    frozenBuffer,
    rawCutoutBuffer: outBuffer,
    modelUsed,
    frozenFileName,
    cutoutFileName
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Bypass-Tunnel-Reminder');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static generated cutout/frozen images
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
    console.log('[Server 8088] Incoming /_remove_bg request from', req.socket.remoteAddress);
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const base64Data = body.image.replace(/^data:image\/[a-z]+;base64,/, '');
        const inputBuf = Buffer.from(base64Data, 'base64');
        const { frozenBuffer, rawCutoutBuffer, modelUsed, frozenFileName, cutoutFileName } = await removeBgBuffer(inputBuf, body.model);
        
        const host = req.headers.host || `192.168.10.109:${PORT}`;
        const serverHost = host.includes(':') ? host : `${host}:${PORT}`;
        const frozenUrl = `http://${serverHost}/cutouts/${frozenFileName}`;
        const cutoutUrl = `http://${serverHost}/cutouts/${cutoutFileName}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          url: cutoutUrl, // Primary image is now clean cutout URL
          cutoutUrl: cutoutUrl,
          frozenUrl: frozenUrl,
          result: cutoutUrl,
          rawCutout: 'data:image/png;base64,' + rawCutoutBuffer.toString('base64'),
          frozenResult: 'data:image/png;base64,' + frozenBuffer.toString('base64'),
          model: modelUsed
        }));
        console.log(`[Server 8088] Request finished successfully with [${modelUsed.toUpperCase()}], Cutout URL: ${cutoutUrl}`);
      } catch (err) {
        console.error('[Server 8088 Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Background Removal & Solid Ice Cube Sealer Service Running [Resilient Multi-Stage Pipeline]');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server 8088] Background removal server listening on http://0.0.0.0:${PORT}`);
  getRmbgSession().catch(console.error);
});
