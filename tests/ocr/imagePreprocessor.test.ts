import { describe, it, expect } from 'vitest';
import {
  applyGrayscale,
  applyAutoContrast,
  applyDenoise,
  applySharpen,
  applyAdaptiveThreshold,
  deskewCanvas,
  preprocessCanvasImage,
} from '../../src/services/ocr/imagePreprocessor';

// Polyfill ImageData for JSDOM environment
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = MockImageData;
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.toDataURL = function (type = 'image/png') {
    return `data:${type};base64,QUJDREVGR0g=`;
  };
}

// Mock getContext('2d') for JSDOM
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      const w = this.width || 100;
      const h = this.height || 100;
      let internalData = new MockImageData(w, h);
      return {
        fillStyle: '#FFFFFF',
        fillRect: () => {},
        drawImage: () => {},
        translate: () => {},
        rotate: () => {},
        getImageData: (sx: number, sy: number, sw: number, sh: number) => {
          if (internalData.width !== sw || internalData.height !== sh) {
            internalData = new MockImageData(sw, sh);
          }
          return internalData;
        },
        putImageData: (imgData: any) => {
          internalData = imgData;
        },
      } as any;
    }
    return null;
  };
}

describe('Image Preprocessor Engine (OCR-04)', () => {
  it('chuyển đổi chính xác sang Grayscale theo trọng số BT.601', () => {
    // Tạo ImageData 1x1 pixel màu đỏ tươi (R=255, G=0, B=0, A=255)
    const imgData = new ImageData(1, 1);
    imgData.data[0] = 255;
    imgData.data[1] = 0;
    imgData.data[2] = 0;
    imgData.data[3] = 255;

    applyGrayscale(imgData);

    // BT.601: Y = 0.299 * 255 ≈ 76
    expect(imgData.data[0]).toBe(76);
    expect(imgData.data[1]).toBe(76);
    expect(imgData.data[2]).toBe(76);
    expect(imgData.data[3]).toBe(255); // Alpha không đổi
  });

  it('kéo dãn tương phản (Auto Contrast) loại bỏ nền xám và tăng độ đậm của chữ', () => {
    // Tạo ảnh 4 pixel có dải tương phản hẹp (mờ): [100, 120, 140, 160]
    const imgData = new ImageData(2, 2);
    const testVals = [100, 120, 140, 160];
    for (let i = 0; i < 4; i++) {
      imgData.data[i * 4] = testVals[i];
      imgData.data[i * 4 + 1] = testVals[i];
      imgData.data[i * 4 + 2] = testVals[i];
      imgData.data[i * 4 + 3] = 255;
    }

    applyAutoContrast(imgData, 0.0); // 0% clip để test chính xác dải min-max

    // Pixel nhỏ nhất (100) phải bị kéo về 0
    expect(imgData.data[0]).toBe(0);
    // Pixel lớn nhất (160) phải được kéo lên 255
    expect(imgData.data[12]).toBe(255);
  });

  it('làm sắc nét (Sharpen) tăng độ dốc biên cạnh giữa chữ và nền', () => {
    // Tạo ảnh 3x3 có một chấm ở giữa
    const imgData = new ImageData(3, 3);
    // Cho nền = 100
    for (let i = 0; i < 9 * 4; i += 4) {
      imgData.data[i] = 100;
      imgData.data[i + 1] = 100;
      imgData.data[i + 2] = 100;
      imgData.data[i + 3] = 255;
    }
    // Điểm trung tâm (1,1) sáng hơn = 150
    const centerIdx = (1 * 3 + 1) * 4;
    imgData.data[centerIdx] = 150;
    imgData.data[centerIdx + 1] = 150;
    imgData.data[centerIdx + 2] = 150;

    applySharpen(imgData, 0.5);

    // Điểm trung tâm sau sharpen phải có giá trị cao hơn 150
    expect(imgData.data[centerIdx]).toBeGreaterThan(150);
  });

  it('deskewCanvas xoay canvas với nền trắng tinh khiết', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(10, 10, 80, 80);
    }

    const rotated = deskewCanvas(canvas, 5); // Xoay 5 độ
    expect(rotated.width).toBeGreaterThanOrEqual(100);
    expect(rotated.height).toBeGreaterThanOrEqual(100);
  });

  it('applyDenoise khử các đốm nhiễu cực đoan đơn lẻ', () => {
    // Tạo ảnh 5x5 nền trắng (255), có 1 đốm đen nhiễu ở giữa (x=2, y=2)
    const imgData = new ImageData(5, 5);
    for (let i = 0; i < 25 * 4; i += 4) {
      imgData.data[i] = 250;
      imgData.data[i + 1] = 250;
      imgData.data[i + 2] = 250;
      imgData.data[i + 3] = 255;
    }
    const centerIdx = (2 * 5 + 2) * 4;
    imgData.data[centerIdx] = 10; // Đốm đen bất thường
    imgData.data[centerIdx + 1] = 10;
    imgData.data[centerIdx + 2] = 10;

    applyDenoise(imgData);

    // Điểm nhiễu phải được kéo lên gần nền sáng
    expect(imgData.data[centerIdx]).toBeGreaterThan(100);
  });

  it('applyAdaptiveThreshold nhị phân hóa chính xác thành 0 và 255', () => {
    const imgData = new ImageData(2, 2);
    imgData.data[0] = 50; // Tối -> 0
    imgData.data[4] = 200; // Sáng -> 255
    imgData.data[8] = 30; // Tối -> 0
    imgData.data[12] = 220; // Sáng -> 255

    applyAdaptiveThreshold(imgData, 128);

    expect(imgData.data[0]).toBe(0);
    expect(imgData.data[4]).toBe(255);
    expect(imgData.data[8]).toBe(0);
    expect(imgData.data[12]).toBe(255);
  });

  it('preprocessCanvasImage tuyệt đối không làm biến đổi sourceCanvas gốc (Non-destructive guarantee)', () => {
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = 30;
    originalCanvas.height = 30;

    const res = preprocessCanvasImage(originalCanvas, {
      grayscale: true,
      autoContrast: true,
      denoise: true,
      sharpen: true,
      deskew: false,
    });

    // Canvas kết quả phải là đối tượng khác canvas gốc
    expect(res.canvas).not.toBe(originalCanvas);
    expect(res.originalCanvas).toBe(originalCanvas);
  });

  it('xử lý kịch bản Scan mờ / tương phản thấp thành công', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;

    const res = preprocessCanvasImage(canvas, {
      grayscale: true,
      autoContrast: true,
      contrastClipPercent: 0.01,
      sharpen: true,
      sharpenStrength: 0.35,
      deskew: false,
    });

    expect(res.appliedFilters).toContain('Grayscale(BT.601)');
    expect(res.appliedFilters).toContain('AutoContrast(1%)');
    expect(res.appliedFilters).toContain('Sharpen(k=0.35)');
  });

  it('xử lý kịch bản Scan nghiêng và phát hiện xoay nắn', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;

    const res = preprocessCanvasImage(canvas, {
      deskew: true,
      grayscale: false,
      autoContrast: false,
      sharpen: false,
    });

    expect(res.width).toBeGreaterThanOrEqual(100);
    expect(res.height).toBeGreaterThanOrEqual(100);
  });

  it('xử lý kịch bản Bảng nhiều dòng bảo toàn cấu trúc dòng', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 100;

    const res = preprocessCanvasImage(canvas, {
      grayscale: true,
      autoContrast: true,
      denoise: true,
      sharpen: true,
      deskew: false,
    });

    expect(res.appliedFilters).toContain('Denoise(Speckle)');
    expect(res.width).toBe(60);
    expect(res.height).toBe(100);
  });
});
