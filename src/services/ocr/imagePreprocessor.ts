/**
 * src/services/ocr/imagePreprocessor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Module tiền xử lý ảnh trên Web Canvas (OCR-04: Image Preprocessing).
 * Tối ưu hóa ảnh đầu vào trước khi cấp cho Gemini Vision hoặc Tesseract:
 * - Grayscale (trọng số chuẩn ITU-R BT.601)
 * - Auto Contrast Stretching (khử nhiễu nền xám máy scan/photocopy)
 * - Sharpening (làm rõ nét số nhỏ, dấu thập phân, nét mảnh)
 * - Deskew (phát hiện và nắn thẳng góc nghiêng văn bản bằng Projection Profile)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ImagePreprocessingOptions, ProcessedImageData } from './types';

function createImageDataBuffer(width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(width, height);
  }
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * Chuyển đổi ImageData sang Grayscale theo trọng số chuẩn ITU-R BT.601
 * Y = 0.299*R + 0.587*G + 0.114*B
 */
export function applyGrayscale(imageData: ImageData): void {
  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

/**
 * Tự động cân bằng và kéo dãn tương phản (Min-Max Contrast Stretching với cắt đuôi 2% nhiễu)
 * Giúp chữ mờ trở nên đen đậm và nền giấy xám trở thành màu trắng tinh khiết.
 */
export function applyAutoContrast(imageData: ImageData, clipPercent = 0.02): void {
  const data = imageData.data;
  const len = data.length;
  const totalPixels = len / 4;

  // 1. Lập biểu đồ tần suất Histogram mức xám
  const hist = new Uint32Array(256);
  for (let i = 0; i < len; i += 4) {
    hist[data[i]]++;
  }

  // 2. Tìm điểm cắt min/max loại bỏ nhiễu biên
  const clipCount = Math.floor(totalPixels * clipPercent);
  let acc = 0;
  let minVal = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc > clipCount) {
      minVal = i;
      break;
    }
  }

  acc = 0;
  let maxVal = 255;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc > clipCount) {
      maxVal = i;
      break;
    }
  }

  if (maxVal <= minVal) return;

  // 3. Bảng tra cứu kéo dãn dải tương phản (LUT - Look Up Table)
  const lut = new Uint8Array(256);
  const range = maxVal - minVal;
  for (let i = 0; i < 256; i++) {
    if (i <= minVal) {
      lut[i] = 0;
    } else if (i >= maxVal) {
      lut[i] = 255;
    } else {
      lut[i] = Math.round(((i - minVal) / range) * 255);
    }
  }

  // 4. Áp dụng bảng LUT lên từng pixel
  for (let i = 0; i < len; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

/**
 * Làm sắc nét ảnh sử dụng ma trận tích chập 3x3 Laplacian Kernel (Unsharp Mask)
 * Giúp nét chữ thanh mảnh và các dấu thập phân không bị mờ nhòe.
 */
export function applySharpen(imageData: ImageData, strength = 0.5): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;

  // Tạo ImageData mới để lưu kết quả tích chập
  const output = createImageDataBuffer(width, height);
  const dst = output.data;

  const kCenter = 1 + 4 * strength;
  const kEdge = -strength;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Áp dụng tích chập cho từng kênh màu R, G, B
      for (let c = 0; c < 3; c++) {
        const top = src[((y - 1) * width + x) * 4 + c];
        const bottom = src[((y + 1) * width + x) * 4 + c];
        const left = src[(y * width + (x - 1)) * 4 + c];
        const right = src[(y * width + (x + 1)) * 4 + c];
        const center = src[idx + c];

        const val = center * kCenter + (top + bottom + left + right) * kEdge;
        dst[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
      dst[idx + 3] = src[idx + 3]; // Giữ nguyên Alpha
    }
  }

  // Sao chép kết quả ngược lại imageData gốc
  src.set(dst);
  return imageData;
}

/**
 * Ước tính góc nghiêng của văn bản dựa trên thuật toán Horizontal Projection Profile
 * Quét các góc từ -10° đến +10° với bước nhảy 0.5°.
 * Góc nắn thẳng chính xác nhất là góc tối đa hóa phương sai (Variance) của các dòng chữ ngang.
 */
export function estimateSkewAngle(
  canvas: HTMLCanvasElement,
  searchRangeDeg = 10,
  stepDeg = 1.0
): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  // Thu nhỏ canvas tạm thời để tính toán siêu tốc (width ~400px)
  const sampleWidth = Math.min(400, canvas.width);
  const sampleScale = sampleWidth / canvas.width;
  const sampleHeight = Math.floor(canvas.height * sampleScale);

  if (sampleWidth <= 0 || sampleHeight <= 0) return 0;

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = sampleWidth;
  smallCanvas.height = sampleHeight;
  const sCtx = smallCanvas.getContext('2d');
  if (!sCtx) return 0;

  sCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const imgData = sCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imgData.data;

  // Nhị phân hóa nhanh: pixel đen = 1, pixel trắng = 0
  const binary = new Uint8Array(sampleWidth * sampleHeight);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binary[i / 4] = gray < 180 ? 1 : 0;
  }

  let bestAngle = 0;
  let maxVariance = -1;

  for (let angle = -searchRangeDeg; angle <= searchRangeDeg; angle += stepDeg) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const profile = new Float32Array(sampleHeight);

    // Chiếu các điểm tối lên trục Y
    for (let y = 0; y < sampleHeight; y += 2) {
      for (let x = 0; x < sampleWidth; x += 2) {
        if (binary[y * sampleWidth + x] === 1) {
          // Tính tọa độ Y sau khi xoay giả định
          const rotY = Math.round(
            (x - sampleWidth / 2) * sin + (y - sampleHeight / 2) * cos + sampleHeight / 2
          );
          if (rotY >= 0 && rotY < sampleHeight) {
            profile[rotY]++;
          }
        }
      }
    }

    // Tính phương sai của profile
    let sum = 0;
    let sumSq = 0;
    for (let y = 0; y < sampleHeight; y++) {
      const v = profile[y];
      sum += v;
      sumSq += v * v;
    }
    const variance = sumSq / sampleHeight - (sum / sampleHeight) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Xoay nắn thẳng lại Canvas theo góc lệch đã phát hiện
 */
export function deskewCanvas(canvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  if (Math.abs(angleDeg) < 0.2) return canvas; // Không cần xoay nếu góc quá nhỏ

  const rad = (-angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const newWidth = Math.floor(canvas.width * cos + canvas.height * sin);
  const newHeight = Math.floor(canvas.height * cos + canvas.width * sin);

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = newWidth;
  rotatedCanvas.height = newHeight;

  const ctx = rotatedCanvas.getContext('2d');
  if (!ctx) return canvas;

  // Đổ nền trắng toàn bộ
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, newWidth, newHeight);

  // Đặt tâm xoay ở giữa
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotatedCanvas;
}
/**
 * Khử nhiễu đốm hạt máy scan (Denoise) bằng bộ lọc lọc đốm biệt lập (Despeckle / Conservative Smoothing)
 * Loại bỏ nhiễu hạt muối-tiêu (salt-and-pepper) từ kính máy scan mà không làm mờ dấu chấm thập phân và đường viền bảng.
 */
export function applyDenoise(imageData: ImageData): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;

  const output = createImageDataBuffer(width, height);
  const dst = output.data;
  dst.set(src);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const center = src[idx];

      // Đọc 8 điểm lân cận
      let neighborMin = 255;
      let neighborMax = 0;
      let neighborSum = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nVal = src[((y + dy) * width + (x + dx)) * 4];
          if (nVal < neighborMin) neighborMin = nVal;
          if (nVal > neighborMax) neighborMax = nVal;
          neighborSum += nVal;
        }
      }

      // Chỉ lọc nếu điểm trung tâm là ngoại lai cực đoan (đốm đơn lẻ quá sáng hoặc quá tối)
      const neighborAvg = neighborSum / 8;
      if (center < neighborMin - 80) {
        // Đốm đen đơn lẻ trên nền sáng
        const corrected = Math.round(0.2 * center + 0.8 * neighborAvg);
        dst[idx] = corrected;
        dst[idx + 1] = corrected;
        dst[idx + 2] = corrected;
      } else if (center > neighborMax + 80) {
        // Đốm trắng đơn lẻ trên chữ đen
        const corrected = Math.round(0.2 * center + 0.8 * neighborAvg);
        dst[idx] = corrected;
        dst[idx + 1] = corrected;
        dst[idx + 2] = corrected;
      }
    }
  }

  src.set(dst);
  return imageData;
}

/**
 * Nhị phân hóa thích ứng / Otsu Thresholding (Tùy chọn)
 * Chỉ áp dụng khi người dùng hoặc caller yêu cầu binarize để tránh làm đứt nét chữ viết tay và bảng biểu.
 */
export function applyAdaptiveThreshold(imageData: ImageData, manualThreshold?: number): void {
  const data = imageData.data;
  const len = data.length;

  let threshold = manualThreshold;

  // Nếu không truyền ngưỡng thủ công, tự động tính ngưỡng Otsu tối ưu từ Histogram
  if (typeof threshold !== 'number') {
    const hist = new Uint32Array(256);
    for (let i = 0; i < len; i += 4) {
      hist[data[i]]++;
    }

    const totalPixels = len / 4;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let otsuThreshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        otsuThreshold = t;
      }
    }
    threshold = otsuThreshold;
  }

  // Áp dụng nhị phân hóa
  for (let i = 0; i < len; i += 4) {
    const val = data[i] >= threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
}

/**
 * Pipeline tổng thể tiền xử lý ảnh (OCR-04)
 * TUYỆT ĐỐI KHÔNG làm biến đổi sourceCanvas gốc; luôn nhân bản ra canvas riêng biệt.
 */
export function preprocessCanvasImage(
  sourceCanvas: HTMLCanvasElement,
  options: ImagePreprocessingOptions = {}
): ProcessedImageData {
  const {
    grayscale = true,
    autoContrast = true,
    contrastClipPercent = 0.01, // Mặc định 1% để an toàn không cắt nhầm dấu thập phân
    denoise = true,
    sharpen = true,
    sharpenStrength = 0.35, // Mặc định 0.35 vừa phải, chống rách nét bảng và chữ viết tay
    deskew = true,
    binarize = false, // Mặc định false để giữ dải xám mềm cho Vision LLM
    binarizationThreshold,
  } = options;

  const appliedFilters: string[] = [];

  // 1. Nhân bản Canvas để bảo vệ 100% Canvas gốc không bị biến đổi
  let activeCanvas = document.createElement('canvas');
  activeCanvas.width = sourceCanvas.width;
  activeCanvas.height = sourceCanvas.height;
  const cloneCtx = activeCanvas.getContext('2d');
  if (cloneCtx && typeof cloneCtx.drawImage === 'function') {
    cloneCtx.drawImage(sourceCanvas, 0, 0);
  }

  let detectedSkewAngleDeg = 0;

  // 2. Chỉnh xoay nghiêng (Deskew) nếu góc lệch >= 0.5°
  if (deskew) {
    detectedSkewAngleDeg = estimateSkewAngle(activeCanvas);
    if (Math.abs(detectedSkewAngleDeg) >= 0.5) {
      activeCanvas = deskewCanvas(activeCanvas, detectedSkewAngleDeg);
      appliedFilters.push(`Deskew(${detectedSkewAngleDeg.toFixed(1)}°)`);
    }
  }

  const ctx = activeCanvas.getContext('2d');
  if (!ctx || typeof ctx.getImageData !== 'function') {
    return {
      canvas: activeCanvas,
      originalCanvas: sourceCanvas,
      width: activeCanvas.width,
      height: activeCanvas.height,
      appliedFilters,
    };
  }

  const imgData = ctx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);

  // 3. Grayscale (BT.601)
  if (grayscale) {
    applyGrayscale(imgData);
    appliedFilters.push('Grayscale(BT.601)');
  }

  // 4. Auto Contrast Stretching (cắt đuôi nhẹ 1%)
  if (autoContrast) {
    applyAutoContrast(imgData, contrastClipPercent);
    appliedFilters.push(`AutoContrast(${Math.round(contrastClipPercent * 100)}%)`);
  }

  // 5. Khử nhiễu đốm hạt máy scan (Denoise)
  if (denoise) {
    applyDenoise(imgData);
    appliedFilters.push('Denoise(Speckle)');
  }

  // 6. Làm sắc nét viền chữ vừa phải (Sharpen)
  if (sharpen) {
    applySharpen(imgData, sharpenStrength);
    appliedFilters.push(`Sharpen(k=${sharpenStrength})`);
  }

  // 7. Nhị phân hóa tùy chọn (Binarize)
  if (binarize) {
    applyAdaptiveThreshold(imgData, binarizationThreshold);
    appliedFilters.push(
      typeof binarizationThreshold === 'number'
        ? `Binarize(th=${binarizationThreshold})`
        : 'Binarize(Otsu)'
    );
  }

  ctx.putImageData(imgData, 0, 0);

  // Xuất dataUrl cho cả hai biến thể
  let processedDataUrl: string | undefined;
  let originalDataUrl: string | undefined;

  try {
    processedDataUrl = activeCanvas.toDataURL('image/png');
    originalDataUrl = sourceCanvas.toDataURL('image/png');
  } catch {
    // Trong môi trường Node/JSDOM không hỗ trợ toDataURL đầy đủ
  }

  return {
    canvas: activeCanvas,
    originalCanvas: sourceCanvas,
    width: activeCanvas.width,
    height: activeCanvas.height,
    detectedSkewAngleDeg,
    appliedFilters,
    processedDataUrl,
    originalDataUrl,
  };
}
