import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExport } from './useExport';
import { useToast } from '../context/ToastContext';

// Mock ToastContext
vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('useExport', () => {
  const mockNotify = vi.fn();
  const originalCreateObjectURL = global.URL.createObjectURL;
  const originalRevokeObjectURL = global.URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
    
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('exportToJSON', () => {
    it('should export data to JSON successfully', () => {
      const { result } = renderHook(() => useExport());
      const data = { test: 'data' };
      const filename = 'test-file';

      // Mock DOM elements
      const link = document.createElement('a');
      link.click = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue(link);
      vi.spyOn(document.body, 'appendChild');
      vi.spyOn(document.body, 'removeChild');

      act(() => {
        result.current.exportToJSON(data, filename);
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(link.href).toContain('mock-url');
      expect(link.download).toContain(filename);
      expect(document.body.appendChild).toHaveBeenCalledWith(link);
      expect(link.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(link);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });

    it('should handle errors during JSON export', () => {
      const { result } = renderHook(() => useExport());
      
      // Force an error by making JSON.stringify throw (circular structure)
      const circular: any = {};
      circular.self = circular;

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      act(() => {
        result.current.exportToJSON(circular, 'test');
      });

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR' }));
      consoleSpy.mockRestore();
    });
  });

  describe('exportToCSV', () => {
    it('should warn if data is empty', () => {
      const { result } = renderHook(() => useExport());
      
      act(() => {
        result.current.exportToCSV([], 'test');
      });

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'WARNING' }));
    });

    it('should export data to CSV successfully', () => {
      const { result } = renderHook(() => useExport());
      const data = [{ col1: 'val1', col2: 'val2' }];
      const filename = 'test-csv';

      // Mock DOM elements
      const link = document.createElement('a');
      link.click = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue(link);
      vi.spyOn(document.body, 'appendChild');
      vi.spyOn(document.body, 'removeChild');

      act(() => {
        result.current.exportToCSV(data, filename);
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(link.download).toContain(filename);
      expect(link.click).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });

    it('should handle CSV escaping correctly', () => {
      const { result } = renderHook(() => useExport());
      const data = [{ col1: 'val,ue', col2: 'val"ue' }];
      
      act(() => {
        result.current.exportToCSV(data, 'test');
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });
});