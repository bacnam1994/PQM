import { TCCS, Product } from '../types';

export interface MaterialItem {
  id: string;
  name: string;
  type: 'ACTIVE' | 'EXCIPIENT';
  relatedProducts: { id: string; code: string; name: string; content?: string }[];
}

/**
 * Phân tích danh sách TCCS để trích xuất danh sách nguyên liệu (Hoạt chất & Phụ liệu)
 */
export const analyzeMaterials = (tccsList: TCCS[], products: Product[]): MaterialItem[] => {
  const matMap = new Map<string, MaterialItem>();

  tccsList.forEach(tccs => {
    if (!tccs.composition) return;
    const product = products.find(p => p.id === tccs.productId);
    if (!product) return;
    
    const prodInfo = { id: product.id, code: tccs.code, name: product.name };
    const lines = tccs.composition.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // 1. Tách Hoạt chất (Dòng bắt đầu bằng "-")
      if (trimmed.startsWith('-')) {
        const parts = trimmed.substring(1).split(':');
        const namePart = parts[0]?.trim() || '';
        const content = parts[1]?.trim() || '';
        
        const groupMatch = namePart.match(/(.+?)\s*\((.+)\)/);
        const activeNames = (groupMatch && groupMatch[2]) 
          ? groupMatch[2].split(',').map(s => s.trim()).filter(Boolean)
          : [namePart].filter(Boolean);

        activeNames.forEach(actName => {
          const key = `ACTIVE_${actName.toLowerCase()}`;
          if (!matMap.has(key)) {
            matMap.set(key, { id: key, name: actName, type: 'ACTIVE', relatedProducts: [] });
          }
          const mat = matMap.get(key)!;
          if (!mat.relatedProducts.some(p => p.id === prodInfo.id)) {
             mat.relatedProducts.push({ ...prodInfo, content });
          }
        });
      }
      // 2. Tách Phụ liệu (các dòng còn lại)
      else {
        let excipientLineContent = '';
        if (trimmed.toLowerCase().startsWith('phụ liệu:')) {
          excipientLineContent = trimmed.substring(9).trim();
        } else if (/^[\p{L}\p{N}\s-]+\s*\([^)]+\)/u.test(trimmed)) { // VD: Chất độn (Talc, ...)
          excipientLineContent = trimmed;
        }

        if (excipientLineContent) {
          const foundExcipients: string[] = [];
          const groupRegex = /([\p{L}\p{N}\s-]+)\s*\(([^)]+)\)/gu;
          let match;
          while ((match = groupRegex.exec(excipientLineContent)) !== null) {
            foundExcipients.push(...match[2].split(',').map(s => s.trim()).filter(Boolean));
          }
          const remainingStr = excipientLineContent.replace(groupRegex, '').trim();
          foundExcipients.push(...remainingStr.split(/,|;/).map(s => s.trim()).filter(Boolean));
          
          [...new Set(foundExcipients.filter(Boolean))].forEach(item => {
            const key = `EXCIPIENT_${item.toLowerCase()}`;
            if (!matMap.has(key)) matMap.set(key, { id: key, name: item, type: 'EXCIPIENT', relatedProducts: [] });
            const mat = matMap.get(key)!;
            if (!mat.relatedProducts.some(p => p.id === prodInfo.id)) mat.relatedProducts.push({ ...prodInfo });
          });
        }
      }
    });
  });

  return Array.from(matMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};