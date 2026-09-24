import { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  TEST_RESULT_STATUS,
  CRITERION_TYPE_CONST,
  evaluateCriterionSmart,
  generateId,
  parseNumberFromText,
  ensureArray,
  checkRuleExemption,
} from '../../utils';
import { QualityEvaluationEngine } from '../../domain/evaluation/QualityEvaluationEngine';
import { CriterionEvaluator } from '../../domain/evaluation/CriterionEvaluator';
import { resolveAuthoritativeTestResultsForBatch } from '../../domain/test-result/testResultStatusResolver';
import { lookupPharmaTerm, isCriteriaMatch } from '../../utils/aiMapping';
import {
  TestResultEntry,
  TestResult,
  OperationalError,
  normalizeOperationalError,
} from '../../types';
import { testResultFormSchema } from '../../schemas';
import {
  resolveCanonicalLab,
  DEFAULT_TESTING_LABORATORIES,
} from '../../services/laboratoryService';

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
  aiOriginMapRef,
}: any) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<OperationalError | null>(null);

  const notify = useAppStore((state) => state.notify);
  const updateTestResult = useAppStore((state) => state.updateTestResult);
  const addTestResult = useAppStore((state) => state.addTestResult);
  const updateBatchProgress = useAppStore((state) => state.updateBatchProgress);
  const user = useAppStore((state) => state.user);

  const handleSaveResult = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaveError(null);
      if (!formValues.batchId)
        return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });

      setIsSubmitting(true);
      try {
        const formData = new FormData(e.currentTarget);
        const rawLabName = formData.get('labName')?.toString() || formValues.labName || '';
        const rawLabId = formData.get('labId')?.toString() || (formValues as any).labId || '';
        const testingLaboratories =
          useAppStore.getState().testingLaboratories || DEFAULT_TESTING_LABORATORIES;
        const resolvedLab = resolveCanonicalLab(rawLabId || rawLabName, testingLaboratories);
        const finalLabName = resolvedLab.labName || rawLabName;
        const finalLabId = resolvedLab.labId || rawLabId || undefined;
        const testDate = formData.get('testDate')?.toString() || formValues.testDate || '';

        if (!finalLabName.trim()) {
          setIsSubmitting(false);
          return notify({
            type: 'WARNING',
            message: 'Đơn vị / Phòng kiểm nghiệm không được để trống!',
          });
        }
        if (!testDate.trim()) {
          setIsSubmitting(false);
          return notify({ type: 'WARNING', message: 'Ngày kiểm nghiệm không được để trống!' });
        }
        let results: TestResultEntry[] = [];

        if (activeTCCS) {
          const { rulesMap, allCriteria, criteriaMap } = tccsMaps;

          allCriteria.forEach((c: any) => {
            const getMapVal = (name: string) => {
              const target = name.trim().toLowerCase();
              const key = Object.keys(formValues.testResultsMap).find(
                (k) => k.trim().toLowerCase() === target
              );
              return key ? formValues.testResultsMap[key] : undefined;
            };

            let val = getMapVal(c.name);
            let isAutoPassed = false;
            let ruleSatisfied = false;

            const cName = c.name.trim().toLowerCase();
            if (rulesMap.has(cName)) {
              ruleSatisfied = checkRuleExemption(
                cName,
                getMapVal,
                activeTCCS,
                tccsMaps,
                existingResultsMap
              );
            }

            if (ruleSatisfied) {
              if (
                val === undefined ||
                String(val).trim() === '' ||
                val === 'Đạt (theo quy tắc thay thế)' ||
                val === 'Miễn kiểm'
              ) {
                val = 'Miễn kiểm';
                isAutoPassed = true;
              }
            } else {
              if (val === 'Đạt (theo quy tắc thay thế)' || val === 'Miễn kiểm') {
                val = '';
              }
            }

            if (val !== undefined && String(val).trim() !== '') {
              let isPass = null;
              if (isAutoPassed) {
                isPass = true;
              } else {
                isPass = CriterionEvaluator.evaluateCriterion(c, val).isPass;
              }

              results.push({
                criteriaName: c.name,
                value: val,
                isPass,
                isExtra: false,
                unit: c.unit,
              });

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
              const formula = productFormulas.find((f) => f.productId === currentBatch?.productId);
              if (formula && formula.ingredients) {
                const matchedIng = formula.ingredients.find(
                  (ing) =>
                    isCriteriaMatch(item.name, ing.name) ||
                    (lookupPharmaTerm(item.name) &&
                      lookupPharmaTerm(item.name) === lookupPharmaTerm(ing.name))
                );
                if (matchedIng) {
                  let dc = matchedIng.declaredContent;
                  if (typeof dc === 'string') dc = parseNumberFromText(dc);
                  let ec = matchedIng.elementalContent;
                  if (typeof ec === 'string') ec = parseNumberFromText(ec);
                  const basis = ec != null && ec > 0 ? ec : dc;
                  if (basis != null && basis > 0) {
                    const actualVal = parseNumberFromText(String(item.value));
                    if (!isNaN(actualVal) && actualVal > 0) {
                      isPass = actualVal >= basis * 0.8 && actualVal <= basis * 1.2;
                    }
                  }
                }
              }
            }

            const newEntry: ExtraTestResultEntry = {
              criteriaName: item.name,
              value: item.value,
              isPass,
              isExtra: true,
              unit: item.unit,
              limit: item.limit,
            };
            results.push(newEntry);
          }
        });

        if (results.length === 0) {
          setIsSubmitting(false);
          return notify({
            type: 'WARNING',
            message: 'Vui lòng nhập ít nhất một kết quả kiểm nghiệm!',
          });
        }

        // Chuẩn hóa Authoritative Results Selection cho Lô:
        // Tập hợp danh sách các phiếu kiểm nghiệm ứng viên (bao gồm các phiếu hiện có và phiếu đang lưu)
        const candidateTestResults: TestResult[] = (existingResultsForBatch || [])
          .filter((res: any) => !crud.selectedItem || res.id !== crud.selectedItem.id)
          .map((res: any) => ({ ...res }));

        const currentCandidate: any = {
          id: crud.selectedItem?.id || 'temp-save-id',
          batchId: formValues.batchId,
          labId: finalLabId,
          labName: finalLabName,
          testDate,
          results,
          createdAt: crud.selectedItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: crud.selectedItem?.status || 'DRAFT',
          version: (crud.selectedItem?.version || 0) + 1,
        };
        candidateTestResults.push(currentCandidate);

        // Sử dụng Canonical Multi-Lab Authoritative Selection
        const authTestResults = currentBatch
          ? resolveAuthoritativeTestResultsForBatch(currentBatch, candidateTestResults, activeTCCS)
          : [currentCandidate];

        // Gom nhóm chỉ tiêu authoritative: sắp xếp theo thứ tự ưu tiên thời gian/version
        const authoritativeCriteriaMap = new Map<string, TestResultEntry>();
        const sortedAuth = [...authTestResults].sort((a: any, b: any) => {
          const vA = a.version || a.revision || 0;
          const vB = b.version || b.revision || 0;
          if (vA !== vB) return vA - vB;
          const dateA = a.updatedAt || a.testDate || a.createdAt || '';
          const dateB = b.updatedAt || b.testDate || b.createdAt || '';
          return dateA.localeCompare(dateB);
        });

        sortedAuth.forEach((tr: any) => {
          ensureArray(tr.results).forEach((r: TestResultEntry) => {
            if (!r.isExtra && r.criteriaName) {
              const rName = r.criteriaName.trim().toLowerCase();
              authoritativeCriteriaMap.set(rName, r);
            }
          });
        });

        let isCumulativeComplete = true;
        let cumulativeTotal = 0;
        let cumulativeCompleted = 0;

        if (activeTCCS) {
          const { rulesMap, allCriteria, criteriaMap } = tccsMaps;
          cumulativeTotal = allCriteria.length;
          allCriteria.forEach((c: any) => {
            const cName = c.name.trim().toLowerCase();
            const entry = authoritativeCriteriaMap.get(cName);

            const isMissingOrEmpty =
              !entry ||
              entry.value === null ||
              entry.value === undefined ||
              String(entry.value).trim() === '';

            if (isMissingOrEmpty) {
              let canSkip = false;
              const rule = rulesMap.get(cName);
              if (rule) {
                const mainName = (rule.main || '').trim().toLowerCase();
                const mainEntry = authoritativeCriteriaMap.get(mainName);
                if (
                  mainEntry &&
                  mainEntry.value !== undefined &&
                  String(mainEntry.value).trim() !== ''
                ) {
                  const mainDef = criteriaMap.get(mainName);
                  if (mainDef && evaluateCriterionSmart(mainDef, mainEntry.value) === true) {
                    if (rule.type === 'CONDITIONAL_CHECK') {
                      const extractNum = (val: any) => {
                        const str = String(val || '')
                          .trim()
                          .toUpperCase();
                        if (
                          [
                            'ND',
                            'KPH',
                            'K.P.H',
                            'KHÔNG PHÁT HIỆN',
                            'NOT DETECTED',
                            'ÂM TÍNH',
                            'NEGATIVE',
                            'KHÔNG CÓ',
                            'KHÔNG ĐƯỢC CÓ',
                          ].some((kw) => str.includes(kw))
                        )
                          return 0;
                        const parsed = parseNumberFromText(str);
                        if (!isNaN(parsed)) return parsed;
                        const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/);
                        return match ? Number(match[0].replace(',', '.')) : 0;
                      };
                      if (extractNum(mainEntry.value) <= extractNum(rule.conditionValue))
                        canSkip = true;
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
            }
          });
        } else {
          isCumulativeComplete = false;
        }

        const newProgressPercent =
          cumulativeTotal > 0 ? Math.round((cumulativeCompleted / cumulativeTotal) * 100) : 0;

        if (!completionStatus.isComplete && !isCumulativeComplete) {
          const confirmIncomplete = window.confirm(
            `CẢNH BÁO: Phiếu kiểm nghiệm mới hoàn thành ${completionStatus.progress}%. \n\nBạn có chắc chắn muốn lưu dạng nháp/chưa hoàn thiện không? (Các chỉ tiêu bị bỏ trống sẽ không hiển thị trên CoA)`
          );
          if (!confirmIncomplete) {
            setIsSubmitting(false);
            return;
          }
        }

        const overallStatus = QualityEvaluationEngine.calculateOverallStatus(results, activeTCCS);

        const failedCriteria = results.filter((r) => r.isPass === false);
        if (overallStatus === TEST_RESULT_STATUS.FAIL && failedCriteria.length > 0) {
          const failedNames = failedCriteria
            .map((r) => `  • ${r.criteriaName} (Nhập: ${r.value})`)
            .join('\n');
          const confirmFail = window.confirm(
            `CẢNH BÁO: Phiếu kiểm nghiệm có kết quả QUALITY = FAIL.\n\nPhát hiện ${failedCriteria.length} chỉ tiêu bị vượt giới hạn / không đạt tiêu chuẩn:\n${failedNames}\n\nViệc lưu Phiếu sẽ không tự động thay đổi Workflow Status của Lô.\nQuyết định RELEASED / REJECTED / BLOCKED được thực hiện theo Workflow và thẩm quyền tương ứng.\n\nBạn có chắc chắn muốn lưu phiếu này không?`
          );
          if (!confirmFail) {
            setIsSubmitting(false);
            return;
          }
        }

        const resultData: any = {
          batchId: formValues.batchId,
          labName: finalLabName,
          testDate: (formData.get('testDate') as string) || formValues.testDate,
          results: results,
          overallStatus: overallStatus,
          notes: formValues.notes,
          attachments: formValues.attachments || [],
        };
        if (finalLabId) {
          resultData.labId = finalLabId;
        }

        if (crud.mode === 'EDIT' && crud.selectedItem) {
          const { batch, product, ...cleanResult } = crud.selectedItem as any;
          await updateTestResult({
            ...cleanResult,
            ...resultData,
          });
        } else {
          const newId = generateId('res');
          await addTestResult({
            id: newId,
            ...resultData,
            createdAt: new Date().toISOString(),
          });
        }

        await updateBatchProgress(formValues.batchId, newProgressPercent);

        clearDraft();

        navigate('/test-results');
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã lưu kết quả kiểm nghiệm.' });
      } catch (error) {
        console.error('Lỗi lưu kết quả:', error);
        const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
        if (isOffline) {
          notify({
            type: 'INFO',
            title: 'Lưu ngoại tuyến',
            message:
              'Đã ghi nhận thay đổi ở chế độ Ngoại tuyến. Dữ liệu sẽ tự động đẩy lên máy chủ ngay khi có kết nối mạng.',
          });
          clearDraft();
          navigate('/test-results');
        } else {
          const normalized = normalizeOperationalError(error, 'SAVE', () => {
            const formEl = document.getElementById('test-result-form') as HTMLFormElement | null;
            if (formEl) formEl.requestSubmit();
          });
          setSaveError(normalized);
          notify({
            type: 'ERROR',
            title: 'Lỗi lưu kết quả',
            message: normalized.message,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formValues,
      notify,
      activeTCCS,
      completionStatus,
      crud,
      updateTestResult,
      addTestResult,
      clearDraft,
      closeFormModal,
      navigate,
      existingResultsForBatch,
      currentBatch,
      updateBatchProgress,
      user,
      tccsMaps,
      existingResultsMap,
      aiOriginMapRef,
    ]
  );

  const retrySave = useCallback(() => {
    const formEl = document.getElementById('test-result-form') as HTMLFormElement | null;
    if (formEl) {
      if (typeof formEl.requestSubmit === 'function') {
        formEl.requestSubmit();
      } else {
        formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  }, []);

  return {
    handleSaveResult,
    isSubmitting,
    saveError,
    setSaveError,
    clearSaveError: () => setSaveError(null),
    retrySave,
  };
};
