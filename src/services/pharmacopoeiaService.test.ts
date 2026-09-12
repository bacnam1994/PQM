import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PHARMACOPOEIA_DB,
  lookupPharmacopoeiaDynamic,
  getPharmacopoeiaStandards
} from './pharmacopoeiaService';

describe('Pharmacopoeia Dynamic Configuration Service', () => {
  it('chứa đầy đủ 31 tiêu chuẩn dược điển mặc định cho các kiểm nghiệm thiết yếu', () => {
    expect(DEFAULT_PHARMACOPOEIA_DB.length).toBe(31);
    const disintegration = DEFAULT_PHARMACOPOEIA_DB.find(s => s.title.includes('Độ rã'));
    expect(disintegration).toBeDefined();
    expect(disintegration?.source).toContain('DĐVN V');
    expect(disintegration?.standard).toContain('15 phút');
  });

  it('hàm lookupPharmacopoeiaDynamic tra cứu thành công theo từ khóa', async () => {
    const result = await lookupPharmacopoeiaDynamic('độ rã của viên nén');
    expect(result).toBeDefined();
    expect(result.found).toBe(true);
    expect(result.title).toContain('Độ rã');
    expect(result.source).toContain('DĐVN V');
    expect(result.content).toContain('15 phút');
  });

  it('hàm lookupPharmacopoeiaDynamic hỗ trợ tìm kiếm mờ (fuzzy) không phân biệt hoa thường', async () => {
    const result = await lookupPharmacopoeiaDynamic('DISSOLUTION');
    expect(result).toBeDefined();
    expect(result.found).toBe(true);
    expect(result.title).toContain('Độ hòa tan');
    expect(result.content).toContain('37 ± 0.5°C');
  });

  it('hàm lookupPharmacopoeiaDynamic trả về found: false khi không tìm thấy', async () => {
    const result = await lookupPharmacopoeiaDynamic('unknown_chemical_xyz_987654');
    expect(result).toBeDefined();
    expect(result.found).toBe(false);
    expect(result.message).toContain('Chưa có dữ liệu');
  });

  it('hàm getPharmacopoeiaStandards trả về danh sách có dữ liệu ngay cả khi offline', async () => {
    const list = await getPharmacopoeiaStandards();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(31);
  });
});
