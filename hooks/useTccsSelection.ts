import { useState, useMemo, useEffect } from 'react';
import { Batch, TCCS } from '../types';
import { ensureArray } from '../utils';

export const useTccsSelection = (batchId: string | undefined, hydratedBatches: Batch[], tccsList: TCCS[]) => {
  const [manualTccsId, setManualTccsId] = useState<string | null>(null);

  // Reset manual selection when batch changes
  useEffect(() => {
    setManualTccsId(null);
  }, [batchId]);

  const availableTCCSList = useMemo(() => {
    if (!batchId) return [];
    const batch = hydratedBatches.find(b => b.id === batchId);
    if (!batch) return [];
    return tccsList
      .filter(t => t.productId === batch.productId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [batchId, hydratedBatches, tccsList]);

  const latestTCCS = useMemo(() => {
    return availableTCCSList.length > 0 ? availableTCCSList[0] : null;
  }, [availableTCCSList]);

  const defaultTCCS = useMemo(() => {
    if (!batchId || availableTCCSList.length === 0) return null;
    const batch = hydratedBatches.find(b => b.id === batchId);
    if (!batch) return null;

    if (batch.mfgDate) {
      const mfgTime = new Date(batch.mfgDate).getTime();
      const match = availableTCCSList.find(t => new Date(t.issueDate).getTime() <= mfgTime);
      if (match) return match;
      return availableTCCSList[availableTCCSList.length - 1]; // Fallback to oldest
    }
    return latestTCCS;
  }, [batchId, hydratedBatches, availableTCCSList, latestTCCS]);

  const activeTCCS = useMemo(() => {
    if (manualTccsId) {
      return tccsList.find(t => t.id === manualTccsId) || defaultTCCS;
    }
    return defaultTCCS;
  }, [manualTccsId, defaultTCCS, tccsList]);

  const tccsMaps = useMemo(() => {
    const rulesMap = new Map<string, any>();
    const criteriaMap = new Map<string, any>();
    if (activeTCCS) {
      (activeTCCS.alternateRules || []).forEach(r => { if (r && r.alt) rulesMap.set(r.alt, r); });
      const allCriteria = [...ensureArray(activeTCCS.mainQualityCriteria), ...ensureArray(activeTCCS.safetyCriteria)];
      allCriteria.forEach(c => { if (c && c.name) criteriaMap.set(c.name, c); });
    }
    return { rulesMap, criteriaMap, allCriteria: [...ensureArray(activeTCCS?.mainQualityCriteria), ...ensureArray(activeTCCS?.safetyCriteria)] };
  }, [activeTCCS]);

  return { manualTccsId, setManualTccsId, availableTCCSList, latestTCCS, defaultTCCS, activeTCCS, tccsMaps };
};