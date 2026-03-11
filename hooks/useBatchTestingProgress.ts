import { useMemo } from 'react';
import { Batch, TestResult, TCCS, Criterion } from '../types';
import { evaluateCriterionSmart, parseSpecialValue } from '../utils';

interface UseBatchTestingProgressProps {
  batch: Batch;
  testResults: TestResult[];
  tccs?: TCCS;
}

interface UseBatchTestingProgressResult {
  missingCriteria: Criterion[];
  completedCount: number;
  requiredCount: number;
  progressPercent: number;
  isComplete: boolean;
}

/**
 * Hook tính toán tiến độ kiểm nghiệm của một lô
 * Tách logic phức tạp ra khỏi component để tối ưu hiệu suất
 */
export const useBatchTestingProgress = ({
  batch,
  testResults,
  tccs
}: UseBatchTestingProgressProps): UseBatchTestingProgressResult => {
  
  const batchResults = useMemo(() => {
    return testResults.filter(r => r.batchId === batch.id);
  }, [testResults, batch.id]);

  // Tập hợp các chỉ tiêu đã kiểm (Dựa trên tên)
  const testedCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    batchResults.forEach(r => {
      if (Array.isArray(r.results)) {
        r.results.forEach(res => names.add(res.criteriaName));
      }
    });
    return names;
  }, [batchResults]);

  // Tập hợp các chỉ tiêu yêu cầu trong TCCS
  const requiredCriteria = useMemo(() => {
    if (!tccs) return [];
    return [
      ...(Array.isArray(tccs.mainQualityCriteria) ? tccs.mainQualityCriteria : []),
      ...(Array.isArray(tccs.safetyCriteria) ? tccs.safetyCriteria : [])
    ].filter(c => c && c.name);
  }, [tccs]);

  // Lấy danh sách quy tắc thay thế từ TCCS
  const alternateRules = useMemo(() => {
    return tccs?.alternateRules || [];
  }, [tccs?.alternateRules]);

  // Lọc các chỉ tiêu thực sự cần kiểm tra (loại bỏ TC2 nếu TC1 đạt theo quy tắc thay thế)
  const missingCriteria = useMemo(() => {
    return requiredCriteria.filter(c => {
      // Nếu chỉ tiêu đã có kết quả -> không thiếu
      if (testedCriteriaNames.has(c.name)) return false;
      
      // Kiểm tra xem chỉ tiêu này có phải là TC2 (chỉ tiêu thay thế) không
      const rule = alternateRules.find(r => r.alt === c.name);
      
      if (!rule) {
        return true; // Không có rule -> bắt buộc phải kiểm
      }
      
      // Nếu là TC2, kiểm tra xem TC1 đã đạt chưa
      const mainName = rule.main;
      const mainResult = Array.from(testedCriteriaNames).find(name => name === mainName);
      
      if (!mainResult) return true; // TC1 chưa kiểm -> TC2 vẫn thiếu
      
      // Tìm định nghĩa của TC1
      const mainCriterion = requiredCriteria.find(cr => cr.name === mainName);
      if (!mainCriterion) return true;
      
      // Lấy kết quả thực tế của TC1 từ batchResults
      let mainValue: any = null;
      for (const r of batchResults) {
        if (Array.isArray(r.results)) {
          const found = r.results.find(res => res.criteriaName === mainName);
          if (found) {
            mainValue = found.value;
            break;
          }
        }
      }
      
      if (mainValue === null) return true; // Không tìm thấy giá trị
      
      // Xử lý theo loại quy tắc
      if (rule.type === 'CONDITIONAL_CHECK' && rule.conditionValue) {
        // QUY TẮC CÓ ĐIỀU KIỆN: 
        // Nếu TC1 thỏa điều kiện (≤ giá trị quy định) -> TC2 được miễn
        
        const mainNumValue = parseSpecialValue(mainValue);
        
        if (!isNaN(mainNumValue)) {
          const conditionStr = String(rule.conditionValue).trim();
          const directNum = parseFloat(conditionStr);
          let threshold = directNum;
          let operator = '≤';
          
          if (conditionStr.includes('>')) {
            operator = '>';
            threshold = parseFloat(conditionStr.replace('>', '').trim());
          } else if (conditionStr.includes('<')) {
            if (conditionStr.includes('≤') || conditionStr.includes('<=')) {
              operator = '≤';
              threshold = parseFloat(conditionStr.replace(/<=|≤/g, '').trim());
            } else {
              operator = '<';
              threshold = parseFloat(conditionStr.replace('<', '').trim());
            }
          }
          
          let isExempt = false;
          if ((operator === '≤' || operator === '<') && mainNumValue <= threshold) {
            isExempt = true;
          }
          
          if (isExempt) {
            return false;
          }
        }
        return true;
      } else {
        // QUY TẮC FAIL_RETRY (mặc định): TC1 đạt -> TC2 được miễn
        const isMainPass = evaluateCriterionSmart(mainCriterion, mainValue);
        if (isMainPass === true) {
          return false;
        }
      }
      
      return true;
    });
  }, [requiredCriteria, testedCriteriaNames, alternateRules, batchResults]);

  // Tính số liệu
  const requiredCount = requiredCriteria.length;
  const completedCount = requiredCount - missingCriteria.length;
  const progressPercent = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : 0;
  const isComplete = missingCriteria.length === 0 && requiredCount > 0;

  return {
    missingCriteria,
    completedCount,
    requiredCount,
    progressPercent,
    isComplete
  };
};

/**
 * Hook đánh giá trạng thái lô tự động
 */
export const useBatchAutoEvaluation = (
  batch: Batch,
  testResults: TestResult[],
  tccs?: TCCS
) => {
  const progress = useBatchTestingProgress({ batch, testResults, tccs });
  
  return useMemo(() => {
    if (!tccs) return null;
    
    const batchResults = testResults.filter(r => r.batchId === batch.id);
    if (batchResults.length === 0) return null;
    
    if (!progress.isComplete) return null;
    
    // Kiểm tra tất cả kết quả có PASS không
    const allPass = batchResults.every(tr => 
      tr.results.every(r => r.isPass)
    );
    
    if (allPass) {
      return {
        suggestedStatus: 'RELEASED' as const,
        reason: 'Tất cả chỉ tiêu đạt theo TCCS'
      };
    } else {
      return {
        suggestedStatus: 'REJECTED' as const,
        reason: `Có ${progress.missingCriteria.length} chỉ tiêu không đạt`
      };
    }
  }, [batch, testResults, tccs, progress.isComplete, progress.missingCriteria.length]);
};
