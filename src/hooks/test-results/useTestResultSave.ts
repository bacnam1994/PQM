import { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { logAuditAction } from '../../services/auditService';
import { 
  TEST_RESULT_STATUS, 
  BATCH_STATUS, 
  CRITERION_TYPE_CONST, 
  evaluateCriterionSmart, 
  generateId, 
  parseNumberFromText, 
  ensureArray,
  checkRuleExemption
} from '../../utils';
import { calculateOverallStatus } from './../../utils/evaluation';
import { lookupPharmaTerm, isCriteriaMatch } from '../../utils/aiMapping';
import { TestResultEntry, TestResult } from '../../types';

interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

export const useTestResultSave = ({
  formValues,
  activeTCCS,
  completionStatus,
  crud,
  clearDraft,
  closeFormModal,
  navigate,
  existingResultsForBatch,
  currentBatch,
  tccsMaps,
  existingResultsMap,
  aiOriginMapRef
}: any) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const notify = useAppStore(state => state.notify);
  const updateTestResult = useAppStore(state => state.updateTestResult);
  const addTestResult = useAppStore(state => state.addTestResult);
  const updateBatchProgress = useAppStore(state => state.updateBatchProgress);
  const updateBatchStatus = useAppStore(state => state.updateBatchStatus);
  const user = useAppStore(state => state.user);

  const handleSaveResult = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formValues.batchId) return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      let results: TestResultEntry[] = [];
      
      if (activeTCCS) {
        const { rulesMap, allCriteria, criteriaMap } = tccsMaps;

        allCriteria.forEach((c: any) => {
          const getMapVal = (name: string) => {
            const target = name.trim().toLowerCase();
            const key = Object.keys(formValues.testResultsMap).find(k => k.trim().toLowerCase() === target);
            return key ? formValues.testResultsMap[key] : undefined;
          };

          let val = getMapVal(c.name);
          let isAutoPassed = false;
          let ruleSatisfied = false;
          
          const cName = c.name.trim().toLowerCase();
          if (rulesMap.has(cName)) {
             ruleSatisfied = checkRuleExemption(cName, getMapVal, activeTCCS, tccsMaps, existingResultsMap);
          }

          if (ruleSatisfied) {
             if (val === undefined || String(val).trim() === '' || val === "Đạt (theo quy tắc thay thế)" || val === "Miễn kiểm") {
                val = "Miễn kiểm";
                isAutoPassed = true;
             }
          } else {
             if (val === "Đạt (theo quy tắc thay thế)" || val === "Miễn kiểm") {
                val = "";
             }
          }

          if (val !== undefined && String(val).trim() !== '') {
            let isPass = null;
            if (isAutoPassed) {
                isPass = true;
            } else {
                isPass = evaluateCriterionSmart(c, val);
            }
            
            results.push({ criteriaName: c.name, value: val, isPass, isExtra: false, unit: c.unit });
            
            // AI SELF-LEARNING FEEDBACK LOOP: 
            // Nếu giá trị này có nguồn gốc từ việc AI trích xuất (tồn tại trong aiOriginMapRef)
            // Lưu lại ánh xạ từ Tên gốc AI đọc -> Tên chuẩn hệ thống
            if (aiOriginMapRef?.current && aiOriginMapRef.current[c.name]) {
              const originalName = aiOriginMapRef.current[c.name];
              useAppStore.getState().addAiLearnedMapping(originalName, c.name);
            }
          }
        });
      }

      formValues.extraCriteria.forEach((item: any) => {
        if (item.name && item.value) {
          let isPass: boolean | null = null;
          
          if (item.limit) {
            const pseudoCriterion = {
              name: item.name,
              type: CRITERION_TYPE_CONST.TEXT,
              expectedText: item.limit,
            };
            isPass = evaluateCriterionSmart(pseudoCriterion as any, item.value);
          } else {
            // Tự động tra cứu Công thức sản phẩm để đánh giá theo dải chấp nhận ±20%
            const productFormulas = useAppStore.getState().productFormulas || [];
            const formula = productFormulas.find(f => f.productId === currentBatch?.productId);
            if (formula && formula.ingredients) {
              const matchedIng = formula.ingredients.find(ing => 
                isCriteriaMatch(item.name, ing.name) || 
                (lookupPharmaTerm(item.name) && lookupPharmaTerm(item.name) === lookupPharmaTerm(ing.name))
              );
              if (matchedIng) {
                let dc = matchedIng.declaredContent;
                if (typeof dc === 'string') dc = parseNumberFromText(dc);
                let ec = matchedIng.elementalContent;
                if (typeof ec === 'string') ec = parseNumberFromText(ec);
                const basis = (ec != null && ec > 0) ? ec : dc;
                if (basis != null && basis > 0) {
                  const actualVal = parseNumberFromText(String(item.value));
                  if (!isNaN(actualVal) && actualVal > 0) {
                    isPass = actualVal >= basis * 0.8 && actualVal <= basis * 1.2;
                  }
                }
              }
            }
          }
          
          const newEntry: ExtraTestResultEntry = { criteriaName: item.name, value: item.value, isPass, isExtra: true, unit: item.unit, limit: item.limit };
          results.push(newEntry);
        }
      });

      if (results.length === 0) {
        setIsSubmitting(false);
        return notify({ type: 'WARNING', message: 'Vui lòng nhập ít nhất một kết quả kiểm nghiệm!' });
      }

      const cumulativeResultsMap = new Map<string, TestResultEntry>();
      
      const addCumulative = (r: TestResultEntry) => {
        if (!r.isExtra) {
          const rName = (r.criteriaName || '').trim().toLowerCase();
          const existing = cumulativeResultsMap.get(rName);
          if (!existing || (r.isPass === true && existing.isPass !== true)) {
            cumulativeResultsMap.set(rName, r);
          }
        }
      };

      existingResultsForBatch.forEach((res: any) => {
        ensureArray(res.results).forEach(addCumulative);
      });
      
      results.forEach(addCumulative);

      let isCumulativeComplete = true;
      let isCumulativePass = cumulativeResultsMap.size > 0;
      let cumulativeTotal = 0;
      let cumulativeCompleted = 0;

      if (activeTCCS) {
        const { rulesMap, allCriteria, criteriaMap } = tccsMaps;
        cumulativeTotal = allCriteria.length;
        allCriteria.forEach((c: any) => {
          const cName = c.name.trim().toLowerCase();
          const entry = cumulativeResultsMap.get(cName);
          
          const isMissingOrEmpty = !entry || (entry.value === null || entry.value === undefined || String(entry.value).trim() === '');

          if (isMissingOrEmpty) {
             let canSkip = false;
             const rule = rulesMap.get(cName);
                 if (rule) {
                 const mainName = (rule.main || '').trim().toLowerCase();
                 const mainEntry = cumulativeResultsMap.get(mainName);
                 if (mainEntry && mainEntry.value !== undefined && String(mainEntry.value).trim() !== '') {
                     const mainDef = criteriaMap.get(mainName);
                             if (mainDef && evaluateCriterionSmart(mainDef, mainEntry.value) === true) {
                             if (rule.type === 'CONDITIONAL_CHECK') {
                                 const extractNum = (val: any) => { 
                                     const str = String(val || '').trim().toUpperCase();
                                         if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ', 'KHÔNG ĐƯỢC CÓ'].some(kw => str.includes(kw))) return 0;
                                     const parsed = parseNumberFromText(str);
                                     if (!isNaN(parsed)) return parsed;
                                     const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/); 
                                     return match ? Number(match[0].replace(',', '.')) : 0; 
                                 };
                                 if (extractNum(mainEntry.value) <= extractNum(rule.conditionValue)) canSkip = true;
                             } else {
                                 canSkip = true;
                             }
                     }
                 }
             }
             if (!canSkip) {
                 isCumulativeComplete = false;
             } else {
                 cumulativeCompleted++;
             }
          } else {
             cumulativeCompleted++;
             // isPass=null nghĩa là extra criteria không có giới hạn → không đánh giá được → không tính là FAIL
             // FIX 2: Không đánh FAIL inline nữa — dùng calculateOverallStatus() ở dưới
          }
        });
      } else {
        isCumulativeComplete = false;
      }

      const newProgressPercent = cumulativeTotal > 0 ? Math.round((cumulativeCompleted / cumulativeTotal) * 100) : 0;

      // FIX 2: Dùng calculateOverallStatus() để tính isCumulativePass thay vì logic inline
      // Điều này đảm bảo alternateRules được xét đúng khi quyết định lô RELEASED/REJECTED
      const cumulativeResultsArray = Array.from(cumulativeResultsMap.values());
      isCumulativePass = calculateOverallStatus(cumulativeResultsArray, activeTCCS) === TEST_RESULT_STATUS.PASS
        && cumulativeResultsMap.size > 0;

      if (!completionStatus.isComplete && !isCumulativeComplete) {
        const confirmIncomplete = window.confirm(
          `CẢNH BÁO: Phiếu kiểm nghiệm mới hoàn thành ${completionStatus.progress}%. \n\nBạn có chắc chắn muốn lưu dạng nháp/chưa hoàn thiện không? (Các chỉ tiêu bị bỏ trống sẽ không hiển thị trên CoA)`
        );
        if (!confirmIncomplete) {
          setIsSubmitting(false);
          return;
        }
      }

      const overallStatus = calculateOverallStatus(results, activeTCCS);

      // FIX 1+2: Cảnh báo FAIL dựa trên overallStatus từ calculateOverallStatus()
      // (đã xét alternateRules, không còn dùng logic inline)
      const failedCriteria = results.filter(r => r.isPass === false);
      if (overallStatus === TEST_RESULT_STATUS.FAIL && failedCriteria.length > 0) {
        const failedNames = failedCriteria.map(r => `  • ${r.criteriaName} (Nhập: ${r.value})`).join('\n');
        const confirmFail = window.confirm(
          `CẢNH BÁO KẾT QUẢ KHÔNG ĐẠT:\n\nPhát hiện ${failedCriteria.length} chỉ tiêu bị vượt giới hạn / không đạt tiêu chuẩn:\n${failedNames}\n\nPhiếu kiểm nghiệm này sẽ đưa lô hàng về kết luận KHÔNG ĐẠT. Bạn có chắc chắn muốn lưu dữ liệu này không?`
        );
        if (!confirmFail) {
          setIsSubmitting(false);
          return;
        }
      }

      const resultData = {
          batchId: formValues.batchId,
          labName: formData.get('labName') as string,
          testDate: formData.get('testDate') as string,
          results: results,
          overallStatus: overallStatus,
          notes: formValues.notes,
          attachments: formValues.attachments || [],
      };

      if (crud.mode === 'EDIT' && crud.selectedItem) {
          const { batch, product, ...cleanResult } = crud.selectedItem as any;
          await updateTestResult({
              ...cleanResult,
              ...resultData,
          });
          
          try {
            logAuditAction({
              action: 'UPDATE',
              collection: 'TEST_RESULTS',
              documentId: crud.selectedItem.id,
              details: `Sửa kết quả kiểm nghiệm lô: ${batch?.batchNo || resultData.batchId}`,
              performedBy: user?.email || 'unknown'
            });
          } catch (e) { console.warn("Lỗi ghi log:", e); }
      } else {
          const newId = generateId('res');
          await addTestResult({
              id: newId,
              ...resultData,
              createdAt: new Date().toISOString(),
          });
          
          try {
            logAuditAction({
              action: 'CREATE',
              collection: 'TEST_RESULTS',
              documentId: newId,
              details: `Tạo kết quả kiểm nghiệm lô: ${currentBatch?.batchNo || resultData.batchId}`,
              performedBy: user?.email || 'unknown'
            });
          } catch (e) { console.warn("Lỗi ghi log:", e); }
      }

      await updateBatchProgress(formValues.batchId, newProgressPercent);

      if (isCumulativeComplete && isCumulativePass) {
        if (currentBatch?.status !== BATCH_STATUS.RELEASED) {
          await updateBatchStatus(formValues.batchId, BATCH_STATUS.RELEASED);
          notify({ type: 'INFO', title: 'Hệ thống', message: 'Tổng hợp kết quả lô hàng đã hoàn thành 100% và ĐẠT, tự động chuyển trạng thái Phê duyệt (RELEASED).' });
        }
      } else if (!isCumulativePass) {
        if (currentBatch?.status !== BATCH_STATUS.REJECTED) {
          await updateBatchStatus(formValues.batchId, BATCH_STATUS.REJECTED);
          notify({ type: 'ERROR', title: 'Cảnh báo chất lượng', message: 'Phát hiện kết quả KHÔNG ĐẠT, hệ thống tự động chuyển trạng thái lô về Loại bỏ (REJECTED).' });
        }
      }

      clearDraft();
      
      navigate('/test-results');
      notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã lưu kết quả kiểm nghiệm.' });
    } catch (error) {
      console.error("Lỗi lưu kết quả:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formValues, notify, activeTCCS, completionStatus, crud, updateTestResult, addTestResult, clearDraft, closeFormModal, navigate, existingResultsForBatch, currentBatch, updateBatchProgress, updateBatchStatus, user, tccsMaps, existingResultsMap, aiOriginMapRef]);

  return { handleSaveResult, isSubmitting };
};
