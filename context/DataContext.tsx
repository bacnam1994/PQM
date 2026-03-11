import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';
import { 
  Product, TCCS, ProductFormula, Batch, TestResult, 
  RawMaterial, InventoryIn, InventoryOut 
} from '../types';

export interface DataState {
  products: Product[];
  tccsList: TCCS[];
  productFormulas: ProductFormula[];
  batches: Batch[];
  rawMaterials: RawMaterial[];
  testResults: TestResult[];
  inventoryIn: InventoryIn[];
  inventoryOut: InventoryOut[];
  lastSync: string | null;
}

interface DataContextType {
  state: DataState;
  isLoading: boolean;
  
  // Data fetching controls
  refreshData: () => void;
  setCollectionLoading: (loading: boolean) => void;
  
  // Computed data
  getProductsById: (id: string) => Product | undefined;
  getTCCSById: (id: string) => TCCS | undefined;
  getBatchesByProductId: (productId: string) => Batch[];
  getTestResultsByBatchId: (batchId: string) => TestResult[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DataState>({
    products: [],
    tccsList: [],
    productFormulas: [],
    batches: [],
    rawMaterials: [],
    testResults: [],
    inventoryIn: [],
    inventoryOut: [],
    lastSync: null
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Data fetching from Firebase
  useEffect(() => {
    const collections = {
      products: ref(db, 'products'),
      tccsList: ref(db, 'tccs'),
      productFormulas: ref(db, 'product_formulas'),
      batches: ref(db, 'batches'),
      rawMaterials: ref(db, 'raw_materials'),
      testResults: ref(db, 'testResults'),
      inventoryIn: ref(db, 'inventoryIn'),
      inventoryOut: ref(db, 'inventoryOut')
    };

    const unsubscribes: (() => void)[] = [];

    Object.entries(collections).forEach(([key, ref]) => {
      const unsubscribe = onValue(ref, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.values(data) : [];
        setState(prev => ({ 
          ...prev, 
          [key]: list, 
          lastSync: new Date().toISOString() 
        }));
      });
      unsubscribes.push(unsubscribe);
    });

    // Mark loading as false after initial data fetch
    const loadingTimeout = setTimeout(() => setIsLoading(false), 1000);

    return () => {
      unsubscribes.forEach(fn => fn());
      clearTimeout(loadingTimeout);
    };
  }, [refreshTrigger]);

  // Refresh function
  const refreshData = useCallback(() => {
    setIsLoading(true);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const setCollectionLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  // Computed data helpers
  const getProductsById = useCallback((id: string) => {
    return state.products.find(p => p.id === id);
  }, [state.products]);

  const getTCCSById = useCallback((id: string) => {
    return state.tccsList.find(t => t.id === id);
  }, [state.tccsList]);

  const getBatchesByProductId = useCallback((productId: string) => {
    return state.batches.filter(b => b.productId === productId);
  }, [state.batches]);

  const getTestResultsByBatchId = useCallback((batchId: string) => {
    return state.testResults.filter(tr => tr.batchId === batchId);
  }, [state.testResults]);

  const value = useMemo(() => ({
    state,
    isLoading,
    refreshData,
    setCollectionLoading,
    getProductsById,
    getTCCSById,
    getBatchesByProductId,
    getTestResultsByBatchId
  }), [
    state,
    isLoading,
    refreshData,
    setCollectionLoading,
    getProductsById,
    getTCCSById,
    getBatchesByProductId,
    getTestResultsByBatchId
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export default DataContext;
