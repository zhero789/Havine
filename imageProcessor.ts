
/**
 * LOCAL IMAGE ENGINE
 * Client-side processing for 4K upscaling and manual resizing.
 */

export const upscaleTo4KLocal = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        // 1. Setup High-Res Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Target 4K resolution
        const TARGET_LONG_EDGE = 3840;
        
        let width = img.width;
        let height = img.height;
        let scaleFactor = 1;

        if (width >= height) {
          scaleFactor = TARGET_LONG_EDGE / width;
        } else {
          scaleFactor = 2160 / width; // approx vertical 4K
        }
        
        if (scaleFactor < 1) scaleFactor = 1;

        const targetWidth = Math.floor(width * scaleFactor);
        const targetHeight = Math.floor(height * scaleFactor);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // 2. High Quality Scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // 3. Get Pixel Data for Processing
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        // 4. Apply Image Enhancements
        // Pass A: Sharpening
        const sharpenedData = applySharpen(ctx, imageData, targetWidth, targetHeight, 0.35);

        // Pass B: Clarity & Vibrance
        const finalData = applyColorEnhancement(sharpenedData, 1.1, 1.15);

        ctx.putImageData(finalData, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = (e) => reject(e);
  });
};

export const resizeImageCustom = (dataUrl: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if(!ctx) { reject(new Error("No context")); return; }
        
        // Use high quality for downscaling too
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
  });
};

export const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => resolve({width: img.width, height: img.height});
        img.onerror = () => resolve({width: 0, height: 0});
    });
};

// --- Filters ---

const applySharpen = (ctx: CanvasRenderingContext2D, imgData: ImageData, w: number, h: number, mix: number): ImageData => {
  const data = imgData.data;
  const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const katet = Math.round(Math.sqrt(weights.length));
  const half = (katet * 0.5) | 0;
  
  const output = ctx.createImageData(w, h);
  const dst = output.data;
  const alpha = mix;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * w + x) * 4;
      
      let r = 0, g = 0, b = 0;

      for (let cy = 0; cy < katet; cy++) {
        for (let cx = 0; cx < katet; cx++) {
          const scy = sy + cy - half;
          const scx = sx + cx - half;

          if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
            const srcOff = (scy * w + scx) * 4;
            const wt = weights[cy * katet + cx];
            r += data[srcOff] * wt;
            g += data[srcOff + 1] * wt;
            b += data[srcOff + 2] * wt;
          }
        }
      }

      dst[dstOff]     = data[dstOff] * (1 - alpha) + r * alpha;
      dst[dstOff + 1] = data[dstOff + 1] * (1 - alpha) + g * alpha;
      dst[dstOff + 2] = data[dstOff + 2] * (1 - alpha) + b * alpha;
      dst[dstOff + 3] = 255;
    }
  }
  return output;
};

const applyColorEnhancement = (imgData: ImageData, contrast: number, saturation: number): ImageData => {
  const data = imgData.data;
  const intercept = 128 * (1 - contrast);
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Contrast
    r = r * contrast + intercept;
    g = g * contrast + intercept;
    b = b * contrast + intercept;

    // Saturation
    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    data[i]     = r > 255 ? 255 : r < 0 ? 0 : r;
    data[i + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
    data[i + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
  }
  return imgData;
};
