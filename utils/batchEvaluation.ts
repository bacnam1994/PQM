import { EVALUATION_RULE } from './constants';

/**
 * Đánh giá tự động trạng thái lô hàng dựa trên kết quả kiểm nghiệm
 * QUY TẮC MỚI: Kiểm tra TẤT CẢ chỉ tiêu trong TCCS - nếu tất cả đã kiểm và đều PASS thì RELEASED
 * 
 * @param batch - Thông tin lô hàng
 * @param testResults - Danh sách kết quả kiểm nghiệm của lô
 * @param tccs - Thông tin TCCS của sản phẩm
 * @returns Trạng thái đề xuất: 'RELEASED' | 'REJECTED' | 'TESTING' | 'PENDING'
 */
export const evaluateBatchStatus = (
  batch: { id: string } | undefined | null,
  testResults: Array<{ batchId: string; testDate: string; overallStatus: 'PASS' | 'FAIL'; results: Array<{ criteriaName: string; isPass: boolean; value: any }> }> | undefined | null,
  tccs?: { 
    mainQualityCriteria?: Array<{ name: string }>; 
    safetyCriteria?: Array<{ name: string }>;
    alternateRules?: Array<{ main: string; alt: string; type?: string; conditionValue?: string }>;
  } | undefined | null
): { suggestedStatus: 'RELEASED' | 'REJECTED' | 'TESTING' | 'PENDING'; reason: string; hasLatestPass: boolean; allCriteriaChecked: boolean; allPassed: boolean } => {
  
  // Safety check: batch is required
  if (!batch || !batch.id) {
    return { 
      suggestedStatus: 'PENDING', 
      reason: 'Dữ liệu lô không hợp lệ',
      hasLatestPass: false,
      allCriteriaChecked: false,
      allPassed: false
    };
  }

  // Safety check: testResults must be an array
  if (!testResults || !Array.isArray(testResults)) {
    return { 
      suggestedStatus: 'PENDING', 
      reason: 'Chưa có kết quả kiểm nghiệm nào',
      hasLatestPass: false,
      allCriteriaChecked: false,
      allPassed: false
    };
  }
  
  // Lọc các kết quả của lô này
  const batchResults = testResults.filter(r => r && r.batchId === batch.id);
  
  if (batchResults.length === 0) {
    return { 
      suggestedStatus: 'PENDING', 
      reason: 'Chưa có kết quả kiểm nghiệm nào',
      hasLatestPass: false,
      allCriteriaChecked: false,
      allPassed: false
    };
  }
  
  // Lấy tất cả chỉ tiêu từ TCCS (với null safety)
  const tccsCriteria = tccs && tccs.mainQualityCriteria && tccs.safetyCriteria ? [
    ...(Array.isArray(tccs.mainQualityCriteria) ? tccs.mainQualityCriteria : []),
    ...(Array.isArray(tccs.safetyCriteria) ? tccs.safetyCriteria : [])
  ].filter(c => c && c.name).map(c => c.name) : [];
  
  // Gom nhóm kết quả theo tên chỉ tiêu (lấy kết quả mới nhất cho mỗi chỉ tiêu)
  const latestResultsByCriteria = new Map<string, { isPass: boolean; testDate: string; value?: any }>();
  
  batchResults.forEach(res => {
    if (!res || !Array.isArray(res.results)) return;
    res.results.forEach(item => {
      if (!item || !item.criteriaName) return;
      const existing = latestResultsByCriteria.get(item.criteriaName);
      if (!existing) {
        latestResultsByCriteria.set(item.criteriaName, { 
          isPass: item.isPass, 
          testDate: res.testDate,
          value: item.value 
        });
      } else {
        // So sánh ngày, lấy kết quả mới nhất
        const existingDate = new Date(existing.testDate).getTime();
        const newDate = new Date(res.testDate).getTime();
        if (newDate > existingDate) {
          latestResultsByCriteria.set(item.criteriaName, { 
            isPass: item.isPass, 
            testDate: res.testDate,
            value: item.value 
          });
        }
      }
    });
  });
  
  // Nếu có TCCS, kiểm tra tất cả chỉ tiêu đã được kiểm chưa
  if (tccs && tccsCriteria.length > 0) {
    // Lấy danh sách các quy tắc thay thế (với null safety)
    const rules = tccs.alternateRules || [];
    
    // Xây dựng danh sách "đã kiểm" bao gồm cả logic thay thế
    const checkedCriteria = new Set<string>();
    const autoPassedCriteria = new Map<string, boolean>(); // alt -> isPass
    
    // Thêm các chỉ tiêu đã có kết quả trực tiếp
    Array.from(latestResultsByCriteria.keys()).forEach(c => checkedCriteria.add(c));
    
    // Xử lý logic thay thế để xác định các chỉ tiêu "được coi là đã kiểm"
    rules.forEach(rule => {
      if (!rule || !rule.main || !rule.alt) return;
      const mainName = rule.main;
      const altName = rule.alt;
      const mainResult = latestResultsByCriteria.get(mainName);
      
      if (!mainResult) return;
      
      // FAIL_RETRY: Nếu TC1 đạt -> TC2 được coi là đạt (auto pass)
      if (!rule.type || rule.type === EVALUATION_RULE.FAIL_RETRY) {
        if (mainResult.isPass) {
          // TC1 đạt -> TC2 được coi là đã kiểm và đạt
          checkedCriteria.add(altName);
          autoPassedCriteria.set(altName, true);
        }
      }
      // CONDITIONAL_CHECK: Nếu TC1 đạt VÀ giá trị > ngưỡng -> Bắt buộc kiểm TC2
      else if (rule.type === EVALUATION_RULE.CONDITIONAL_CHECK) {
        if (mainResult.isPass && mainResult.value !== undefined && mainResult.value !== '') {
          const threshold = parseFloat(String(rule.conditionValue)) || 0;
          const val = parseFloat(String(mainResult.value)) || 0;
          
          // Nếu giá trị > ngưỡng, TC2 phải được kiểm thực tế
          if (val > threshold) {
            // TC2 bắt buộc phải có trong checkedCriteria
            // Nếu TC2 chưa được kiểm, đánh dấu là thiếu
          } else {
            // Giá trị <= ngưỡng -> TC2 được coi là đã kiểm và đạt
            checkedCriteria.add(altName);
            autoPassedCriteria.set(altName, true);
          }
        }
      }
    });
    
    // Xác định các chỉ tiêu thực sự còn thiếu (không có trong checkedCriteria)
    const missingCriteria = tccsCriteria.filter(c => !checkedCriteria.has(c));
    
    const allCriteriaChecked = missingCriteria.length === 0;
    
    // Kiểm tra tất cả đã kiểm và đều PASS (bao gồm cả auto-pass)
    if (allCriteriaChecked) {
      // Tất cả chỉ tiêu đã được kiểm (trực tiếp hoặc qua logic thay thế)
      // Kiểm tra tất cả đều PASS
      let allPassed = true;
      
      // Kiểm tra các chỉ tiêu trực tiếp
      for (const [name, result] of latestResultsByCriteria.entries()) {
        if (!result || result.isPass === false) {
          allPassed = false;
          break;
        }
      }
      
      // Kiểm tra các chỉ tiêu auto-pass
      if (allPassed) {
        for (const [name, isPass] of autoPassedCriteria.entries()) {
          if (isPass === false) {
            allPassed = false;
            break;
          }
        }
      }
      
      if (allPassed) {
        return {
          suggestedStatus: 'RELEASED',
          reason: `Đã kiểm đủ ${tccsCriteria.length} chỉ tiêu theo TCCS - Tất cả PASS`,
          hasLatestPass: true,
          allCriteriaChecked: true,
          allPassed: true
        };
      } else {
        // Tìm các chỉ tiêu chưa đạt (bao gồm cả TC2 của CONDITIONAL_CHECK nếu giá trị > ngưỡng)
        const failedCriteria: string[] = [];
        
        // Các chỉ tiêu trực tiếp fail
        latestResultsByCriteria.forEach((result, name) => {
          if (result && result.isPass === false) failedCriteria.push(name);
        });
        
        // Các chỉ tiêu auto-pass fail (hiếm khi xảy ra)
        autoPassedCriteria.forEach((isPass, name) => {
          if (!isPass && !failedCriteria.includes(name)) {
            failedCriteria.push(name);
          }
        });
        
        return {
          suggestedStatus: 'REJECTED',
          reason: `Có ${failedCriteria.length} chỉ tiêu không đạt: ${failedCriteria.join(', ')}`,
          hasLatestPass: false,
          allCriteriaChecked: true,
          allPassed: false
        };
      }
    } else {
      // Chưa kiểm đủ tất cả chỉ tiêu
      const checkedCount = checkedCriteria.size;
      
      return {
        suggestedStatus: 'TESTING',
        reason: `Đã kiểm ${checkedCount}/${tccsCriteria.length} chỉ tiêu - Còn thiếu: ${missingCriteria.slice(0, 3).join(', ')}${missingCriteria.length > 3 ? '...' : ''}`,
        hasLatestPass: Array.from(latestResultsByCriteria.values()).some(r => r && r.isPass) || Array.from(autoPassedCriteria.values()).some(v => v),
        allCriteriaChecked: false,
        allPassed: false
      };
    }
  }
  
  // Nếu không có TCCS, dùng logic cũ: dựa vào phiếu mới nhất
  // Sắp xếp theo testDate giảm dần (mới nhất lên đầu)
  const validResults = batchResults.filter(r => r && r.testDate);
  const sortedResults = [...validResults].sort((a, b) => {
    const dateA = new Date(a.testDate || 0).getTime();
    const dateB = new Date(b.testDate || 0).getTime();
    return dateB - dateA;
  });
  
  const latestResult = sortedResults[0];
  
  if (!latestResult) {
    return {
      suggestedStatus: 'PENDING',
      reason: 'Chưa có kết quả kiểm nghiệm hợp lệ',
      hasLatestPass: false,
      allCriteriaChecked: false,
      allPassed: false
    };
  }
  
  // Nếu phiếu mới nhất PASS -> RELEASED
  if (latestResult.overallStatus === 'PASS') {
    return {
      suggestedStatus: 'RELEASED',
      reason: `Phiếu mới nhất (${new Date(latestResult.testDate).toLocaleDateString('vi-VN')}) đạt - Tất cả chỉ tiêu PASS`,
      hasLatestPass: true,
      allCriteriaChecked: true,
      allPassed: true
    };
  }
  
  // Nếu phiếu mới nhất FAIL -> kiểm tra xem có phiếu PASS mới hơn không
  if (latestResult.overallStatus === 'FAIL') {
    // Tìm phiếu PASS mới hơn
    const passResults = sortedResults.filter(r => r && r.overallStatus === 'PASS');
    
    if (passResults.length > 0) {
      const latestPass = passResults[0];
      const passDate = new Date(latestPass.testDate || 0).getTime();
      const failDate = new Date(latestResult.testDate || 0).getTime();
      
      if (passDate > failDate) {
        return {
          suggestedStatus: 'RELEASED',
          reason: `Phiếu mới nhất PASS (${new Date(latestPass.testDate).toLocaleDateString('vi-VN')}) - Ưu tiên kết quả đạt`,
          hasLatestPass: true,
          allCriteriaChecked: true,
          allPassed: true
        };
      }
    }
    
    // Không có phiếu PASS mới hơn -> REJECTED
    const failCount = batchResults.filter(r => r && r.overallStatus === 'FAIL').length;
    return {
      suggestedStatus: 'REJECTED',
      reason: `Phiếu mới nhất (${new Date(latestResult.testDate).toLocaleDateString('vi-VN')}) không đạt${failCount > 1 ? ` - Có ${failCount} phiếu FAIL` : ''}`,
      hasLatestPass: false,
      allCriteriaChecked: true,
      allPassed: false
    };
  }
  
  // Mặc định nếu không xác định được
  return {
    suggestedStatus: 'TESTING',
    reason: 'Đang chờ kết quả kiểm nghiệm đầy đủ',
    hasLatestPass: latestResult.overallStatus === 'PASS',
    allCriteriaChecked: false,
    allPassed: false
  };
};

