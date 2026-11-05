import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1536, height: 1024 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // 1. Capture current implementation screenshot
  const currentBuffer = await page.screenshot({ type: 'png' });
  const outDir = path.resolve('public/calibration');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'current-1536x1024.png'), currentBuffer);

  // 2. Perform comparison on canvas
  const results = await page.evaluate(async () => {
    // Load reference image
    const refImg = new Image();
    refImg.crossOrigin = 'anonymous';
    refImg.src = '/reference.jpg';
    await new Promise(r => refImg.onload = r);

    // Canvas 1: Reference scaled to 1536x1024
    const cRef = document.createElement('canvas');
    cRef.width = 1536;
    cRef.height = 1024;
    const ctxRef = cRef.getContext('2d');
    ctxRef.imageSmoothingEnabled = false;
    ctxRef.drawImage(refImg, 0, 0, 1536, 1024);

    // Canvas 2: Current implementation screenshot
    const curImg = new Image();
    curImg.src = 'data:image/png;base64,' + (window.__curBase64 || '');
    // Or capture from document by taking canvas screenshot
    return {
      refDataUrl: cRef.toDataURL('image/png')
    };
  });

  const refBase64 = results.refDataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(path.join(outDir, 'reference-1536x1024.png'), Buffer.from(refBase64, 'base64'));

  // 3. Generate Difference and 50% Overlay using canvas inside browser
  const blendResults = await page.evaluate(async (curBase64) => {
    const loadImg = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });

    const [refImg, curImg] = await Promise.all([
      loadImg('/reference.jpg'),
      loadImg('data:image/png;base64,' + curBase64)
    ]);

    const W = 1536;
    const H = 1024;

    // Ref canvas
    const cRef = document.createElement('canvas');
    cRef.width = W; cRef.height = H;
    const ctxRef = cRef.getContext('2d');
    ctxRef.imageSmoothingEnabled = false;
    ctxRef.drawImage(refImg, 0, 0, W, H);
    const dRef = ctxRef.getImageData(0, 0, W, H).data;

    // Cur canvas
    const cCur = document.createElement('canvas');
    cCur.width = W; cCur.height = H;
    const ctxCur = cCur.getContext('2d');
    ctxCur.drawImage(curImg, 0, 0, W, H);
    const dCur = ctxCur.getImageData(0, 0, W, H).data;

    // Overlay canvas (50% blend)
    const cOverlay = document.createElement('canvas');
    cOverlay.width = W; cOverlay.height = H;
    const ctxOverlay = cOverlay.getContext('2d');
    ctxOverlay.drawImage(cRef, 0, 0);
    ctxOverlay.globalAlpha = 0.5;
    ctxOverlay.drawImage(cCur, 0, 0);

    // Difference canvas
    const cDiff = document.createElement('canvas');
    cDiff.width = W; cDiff.height = H;
    const ctxDiff = cDiff.getContext('2d');
    const diffImgData = ctxDiff.createImageData(W, H);
    const dDiff = diffImgData.data;

    let totalDiff = 0;
    const totalPixels = W * H;

    for (let i = 0; i < dRef.length; i += 4) {
      const dr = Math.abs(dRef[i] - dCur[i]);
      const dg = Math.abs(dRef[i + 1] - dCur[i + 1]);
      const db = Math.abs(dRef[i + 2] - dCur[i + 2]);
      const diffVal = (dr + dg + db) / 3;

      totalDiff += diffVal;

      // Color difference amplified for visual diagnosis
      dDiff[i] = Math.min(255, dr * 2.5);
      dDiff[i + 1] = Math.min(255, dg * 2.5);
      dDiff[i + 2] = Math.min(255, db * 2.5);
      dDiff[i + 3] = 255;
    }

    ctxDiff.putImageData(diffImgData, 0, 0);

    const meanDiff = totalDiff / totalPixels;
    const similarity = Math.max(0, 100 - (meanDiff / 255) * 100);

    return {
      overlayDataUrl: cOverlay.toDataURL('image/png'),
      diffDataUrl: cDiff.toDataURL('image/png'),
      meanDiff: meanDiff.toFixed(2),
      similarityPercent: similarity.toFixed(1)
    };
  }, currentBuffer.toString('base64'));

  fs.writeFileSync(
    path.join(outDir, 'overlay-50.png'),
    Buffer.from(blendResults.overlayDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
  );
  fs.writeFileSync(
    path.join(outDir, 'difference.png'),
    Buffer.from(blendResults.diffDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
  );

  console.log('=== CALIBRATION METRICS ===');
  console.log('Mean Pixel Difference (0-255):', blendResults.meanDiff);
  console.log('Visual Match Index:', blendResults.similarityPercent + '%');
  console.log('Artifacts saved in:', outDir);

  await browser.close();
}

run().catch(console.error);

