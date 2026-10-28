import { describe, it, expect } from 'vitest';
import { normalizeSpokenNumbers, parseVoiceTextRuleBased } from './voiceParserService';

describe('voiceParserService - Lab Voice-to-Data Assistant', () => {
  describe('normalizeSpokenNumbers', () => {
    it('should convert spoken decimals and units', () => {
      const input = 'độ ẩm ba phẩy năm phần trăm';
      const output = normalizeSpokenNumbers(input);
      expect(output).toContain('3.5%');
    });

    it('should convert spoken drug dosage units', () => {
      const input = 'hàm lượng năm trăm mi li gam';
      const output = normalizeSpokenNumbers(input);
      expect(output).toContain('mg');
    });
  });

  describe('parseVoiceTextRuleBased', () => {
    it('should parse multiple spoken criteria from natural Vietnamese sentence', () => {
      const spoken = 'Độ ẩm 4.2%, pH 6.5, Cảm quan Đạt';
      const parsed = parseVoiceTextRuleBased(spoken, ['Độ ẩm', 'Độ pH', 'Cảm quan']);

      expect(parsed.length).toBeGreaterThanOrEqual(2);
      
      const moisture = parsed.find(p => p.criteriaName === 'Độ ẩm');
      expect(moisture).toBeDefined();
      expect(moisture?.value).toBe('4.2');
      expect(moisture?.unit).toBe('%');

      const sensory = parsed.find(p => p.criteriaName === 'Cảm quan');
      expect(sensory).toBeDefined();
      expect(sensory?.value).toBe('Đạt');
    });

    it('should correctly mark failed criteria when spoken word contains không đạt', () => {
      const spoken = 'Độ rã không đạt, Tạp chất liên quan 0.1%';
      const parsed = parseVoiceTextRuleBased(spoken, ['Độ tan rã', 'Tạp chất liên quan']);
      
      const disintegration = parsed.find(p => p.criteriaName === 'Độ tan rã');
      expect(disintegration).toBeDefined();
      expect(disintegration?.isPass).toBe(false);
    });
  });
});
