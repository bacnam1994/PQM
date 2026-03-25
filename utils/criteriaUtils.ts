import { TCCS, Product, Criterion } from '../types';

export interface AggregatedCriterion {
  id: string; // Unique ID, maybe just the name
  name: string;
  type: 'QUALITY' | 'SAFETY_MICRO' | 'SAFETY_METAL';
  relatedProducts: { id: string; name: string; code: string }[];
  units: string[];
}

export const analyzeCriteria = (tccsList: TCCS[], products: Product[]): AggregatedCriterion[] => {
  const criteriaMap = new Map<string, AggregatedCriterion>();

  tccsList.forEach(tccs => {
    if (!tccs.productId) return;
    const product = products.find(p => p.id === tccs.productId);
    if (!product) return;

    const allCriteria: (Criterion & { category?: string })[] = [
      ...(tccs.mainQualityCriteria || []),
      ...(tccs.safetyCriteria || [])
    ];

    allCriteria.forEach(crit => {
      if (!crit || !crit.name) return;

      const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
      const nameLower = crit.name.toLowerCase();
      let critType: AggregatedCriterion['type'] = 'QUALITY';

      const isSafety = tccs.safetyCriteria.some(sc => sc.name === crit.name);
      if (isSafety) {
        if ((crit as any).category === 'metal' || HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) {
          critType = 'SAFETY_METAL';
        } else {
          critType = 'SAFETY_MICRO';
        }
      }

      if (!criteriaMap.has(crit.name)) {
        criteriaMap.set(crit.name, {
          id: crit.name,
          name: crit.name,
          type: critType,
          relatedProducts: [],
          units: [],
        });
      }

      const existing = criteriaMap.get(crit.name)!;
      if (!existing.relatedProducts.some(p => p.id === product.id)) existing.relatedProducts.push({ id: product.id, name: product.name, code: product.code });
      if (crit.unit && !existing.units.includes(crit.unit)) existing.units.push(crit.unit);
    });
  });

  return Array.from(criteriaMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};