// d:\26 Kiem nghiem\hệ-thống-quản-lý-chất-lượng\context\TestResultContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, update, query, limitToLast, orderByChild, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { TestResult, SyncStatus } from '../types';
import { SyncIndicator } from './AppContext';

interface TestResultContextType {
  testResults: TestResult[];
  syncStatus: SyncStatus;
  limit: number;
  
  addTestResult: (r: TestResult) => Promise<void>;
  updateTestResult: (r: TestResult) => Promise<void>;
  deleteTestResult: (id: string) => Promise<void>;
  loadMoreTestResults: () => void;
}

const TestResultContext = createContext<TestResultContextType | undefined>(undefined);

export const useTestResultContext = () => {
  const context = useContext(TestResultContext);
  if (!context) throw new Error('useTestResultContext must be used within TestResultProvider');
  return context;
};

export const TestResultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('IDLE');
  const [limit, setLimit] = useState(50); // Mặc định tải 50 kết quả mới nhất

  // Helper: Loại bỏ undefined (Copy từ AppContext để hoạt động độc lập)
  const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = removeUndefined(value);
        return acc;
      }, {} as any);
    }
    return obj;
  };

  // Lắng nghe dữ liệu TestResults với Pagination
  useEffect(() => {
    const q = query(ref(db, 'testResults'), orderByChild('createdAt'), limitToLast(limit));
    
    const unsubscribe = onValue(q, (snapshot) => {
      const list: TestResult[] = [];
      snapshot.forEach((child) => {
        list.push(child.val());
      });
      // Firebase trả về thứ tự cũ -> mới, ta đảo ngược để hiển thị mới nhất lên đầu nếu cần
      // Ở đây giữ nguyên logic cũ của bạn
      setTestResults(list);
    }, (error) => {
      console.error("Lỗi tải testResults:", error);
      setSyncStatus('ERROR');
    });

    return () => unsubscribe();
  }, [limit]);

  const handleSave = async (r: TestResult, isDelete: boolean = false) => {
    setSyncStatus('SAVING');
    try {
      if (isDelete) {
        await remove(ref(db, `testResults/${r.id}`));
      } else {
        const cleanItem = removeUndefined(r);
        await set(ref(db, `testResults/${r.id}`), cleanItem);
      }
      
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      console.error("Lỗi thao tác TestResult:", e);
      setSyncStatus('ERROR');
      throw e;
    }
  };

  const addTestResult = async (r: TestResult) => handleSave(r);
  const updateTestResult = async (r: TestResult) => handleSave(r);
  
  const deleteTestResult = async (id: string) => {
    const r = testResults.find(res => res.id === id);
    if (!r) {
      console.warn("Không tìm thấy TestResult để xóa:", id);
      return;
    }
    await handleSave(r, true);
  };

  const loadMoreTestResults = () => setLimit(prev => prev + 50);

  return (
    <TestResultContext.Provider value={{
      testResults,
      syncStatus,
      limit,
      addTestResult,
      updateTestResult,
      deleteTestResult,
      loadMoreTestResults
    }}>
      {children}
      <SyncIndicator status={syncStatus} />
    </TestResultContext.Provider>
  );
};
