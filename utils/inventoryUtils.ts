import { Batch, InventoryIn, InventoryOut } from '../types';

/**
 * Tính toán tồn kho từ danh sách Lô, Nhập và Xuất
 * Module này thuần túy logic, không phụ thuộc vào React hay Firebase
 */
export const calculateStock = (
  batches: Batch[],
  inventoryIn: InventoryIn[],
  inventoryOut: InventoryOut[]
): Map<string, { in: number; out: number; balance: number }> => {
  const map = new Map<string, { in: number; out: number; balance: number }>();
  
  // Khởi tạo map cho tất cả các lô
  batches.forEach(b => map.set(b.id, { in: 0, out: 0, balance: 0 }));
  
  // Cộng dồn số lượng nhập
  inventoryIn.forEach(i => {
    const s = map.get(i.batchId) || { in: 0, out: 0, balance: 0 };
    s.in += i.quantity; 
    s.balance += i.quantity;
    map.set(i.batchId, s);
  });
  
  // Trừ đi số lượng xuất
  inventoryOut.forEach(o => {
    const s = map.get(o.batchId) || { in: 0, out: 0, balance: 0 };
    s.out += o.quantity; 
    s.balance -= o.quantity;
    map.set(o.batchId, s);
  });
  
  return map;
};