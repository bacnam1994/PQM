import React from 'react';
import { Modal } from '../components/CommonUI';
import { CheckCircle2, X, ListChecks, ShieldCheck, FileText } from 'lucide-react';
import { TCCS, TestResult } from '../types';

interface TCCSReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tccsReportBatch: { batch: any, tccs: TCCS } | null;
  testResults: TestResult[];
}

export const TCCSReportModal: React.FC<TCCSReportModalProps> = ({
  isOpen,
  onClose,
  tccsReportBatch,
  testResults
}) => {
  if (!tccsReportBatch) return null;

  const { batch, tccs } = tccsReportBatch;

  const getTestResultsForCriterion = (criteriaName: string) => {
    return testResults
      .filter(tr => tr.batchId === batch.id)
      .flatMap(tr => tr.results.filter(r => r.criteriaName === criteriaName))
      .map((r) => {
        const parentTr = testResults.find(tr => tr.batchId === batch.id && tr.results.some(res => res.criteriaName === criteriaName));
        return {
          ...r,
          labName: parentTr?.labName || 'N/A',
          testDate: parentTr?.testDate || ''
        };
      });
  };

  const renderCriteriaTable = (criteria: any[], title: string, titleColor: string, icon: React.ReactNode) => (
    <div className="mb-4">
      <h4 className={`text-sm font-bold uppercase mb-2 flex items-center gap-2 ${titleColor}`}>
        {icon} {title}
      </h4>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-slate-600">Chỉ tiêu</th>
              <th className="px-3 py-2 text-center font-bold text-slate-600">Yêu cầu</th>
              <th className="px-3 py-2 text-center font-bold text-slate-600">Kết quả</th>
              <th className="px-3 py-2 text-center font-bold text-slate-600">ĐVT</th>
              <th className="px-3 py-2 text-center font-bold text-slate-600">Nơi kiểm</th>
              <th className="px-3 py-2 text-center font-bold text-slate-600">Đánh giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {criteria.map((criterion, idx) => {
              const testResultsForCriterion = getTestResultsForCriterion(criterion.name);

              if (testResultsForCriterion.length === 0) {
                return (
                  <tr key={`main-${idx}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{criterion.name}</td>
                    <td className="px-3 py-2 text-center text-slate-500">
                      {criterion.min !== undefined && criterion.max !== undefined 
                        ? `${criterion.min} - ${criterion.max}` 
                        : criterion.expectedText || '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-400 italic">Chưa kiểm</td>
                    <td className="px-3 py-2 text-center text-slate-500">{criterion.unit}</td>
                    <td className="px-3 py-2 text-center text-slate-400">-</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-slate-400">-</span>
                    </td>
                  </tr>
                );
              }

              return testResultsForCriterion.map((result, rIdx) => (
                <tr key={`main-${idx}-${rIdx}`} className="hover:bg-slate-50">
                  {rIdx === 0 && (
                    <td className="px-3 py-2 font-medium text-slate-700" rowSpan={testResultsForCriterion.length}>
                      {criterion.name}
                    </td>
                  )}
                  {rIdx === 0 && (
                    <td className="px-3 py-2 text-center text-slate-500" rowSpan={testResultsForCriterion.length}>
                      {criterion.min !== undefined && criterion.max !== undefined 
                        ? `${criterion.min} - ${criterion.max}` 
                        : criterion.expectedText || '-'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center font-bold text-slate-800">{result.value}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{criterion.unit}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-blue-600 font-medium">{result.labName}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {result.isPass ? (
                      <CheckCircle2 size={16} className="mx-auto text-emerald-500" />
                    ) : (
                      <X size={16} className="mx-auto text-red-500" />
                    )}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Báo Cáo TCCS - Kết Quả Kiểm Nghiệm"
      icon={FileText}
      color="bg-[#009639]"
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Mã lô</p>
              <p className="font-bold text-slate-800">{batch.batchNo}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Mã TCCS</p>
              <p className="font-bold text-slate-800">{tccs.code}</p>
            </div>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {tccs.mainQualityCriteria.length > 0 && renderCriteriaTable(
            tccs.mainQualityCriteria,
            'Chỉ tiêu chất lượng chính',
            'text-[#009639]',
            <ListChecks size={16} />
          )}

          {tccs.safetyCriteria.length > 0 && renderCriteriaTable(
            tccs.safetyCriteria,
            'Chỉ tiêu an toàn',
            'text-red-600',
            <ShieldCheck size={16} />
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={onClose} 
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TCCSReportModal;
