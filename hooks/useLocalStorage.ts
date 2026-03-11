import { useState, useCallback } from 'react';

/**
 * Hook tùy chỉnh để quản lý state đồng bộ với localStorage.
 * @param key Key để lưu trong localStorage
 * @param initialValue Giá trị khởi tạo nếu chưa có trong storage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Khởi tạo state từ localStorage hoặc giá trị mặc định
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Lỗi khi đọc localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // Hàm setter bọc lại setter của useState để lưu vào localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Lỗi khi ghi localStorage key “${key}”:`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
