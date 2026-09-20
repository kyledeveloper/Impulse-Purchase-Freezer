const fs = require('fs');
const path = require('path');
const https = require('https');

const TARGET_DIR = path.join(__dirname, '../assets/models');
const TARGET_PATH = path.join(TARGET_DIR, 'birefnet.onnx');

const PRIMARY_URL = 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx';
const MIRROR_URL = 'https://hf-mirror.com/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx';

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log('Starting download from: ' + url);
    const file = fs.createWriteStream(destPath);
    
    function makeRequest(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }

      const req = https.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('Redirecting to: ' + res.headers.location);
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed with HTTP status ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReport = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          
          const now = Date.now();
          if (now - lastReport > 1000 || downloadedBytes === totalBytes) {
            lastReport = now;
            const pct = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
            const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
            process.stdout.write(`\r[Download] ${mb} MB / ${totalMb} MB (${pct}%)`);
          }
        });

        res.on('end', () => {
          file.end(() => {
            console.log('\nDownload completed successfully!');
            resolve();
          });
        });
      });

      req.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    makeRequest(url);
  });
}

async function main() {
  if (fs.existsSync(TARGET_PATH)) {
    const stats = fs.statSync(TARGET_PATH);
    if (stats.size > 200 * 1024 * 1024) {
      console.log(`BiRefNet model already exists at: ${TARGET_PATH} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
  }

  try {
    await downloadFile(PRIMARY_URL, TARGET_PATH);
  } catch (err) {
    console.warn('\nPrimary download failed, trying mirror...', err.message);
    try {
      await downloadFile(MIRROR_URL, TARGET_PATH);
    } catch (err2) {
      console.error('\nMirror download failed as well:', err2.message);
      process.exit(1);
    }
  }

  const finalStats = fs.statSync(TARGET_PATH);
  console.log(`Model file ready at: ${TARGET_PATH} (${(finalStats.size / 1024 / 1024).toFixed(1)} MB)`);
}

main();
