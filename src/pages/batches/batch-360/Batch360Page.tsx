import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  Square3Stack3DIcon, 
  ShareIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon, 
  ClipboardDocumentCheckIcon, 
  PrinterIcon, 
  ArrowTopRightOnSquareIcon, 
  SparklesIcon, 
  ChartBarSquareIcon, 
  DocumentTextIcon, 
  BeakerIcon 
} from '@heroicons/react/24/outline';
import { useDataGraph } from '../../../hooks/useDataGraph';
import { useAppStore } from '../../../store/useAppStore';
import { formatDateStandard, ensureArray } from '../../../utils';
import { buildBatchGenealogy, BatchGenealogyReport } from '../../../services/ai/batchGenealogyService';
import { SignatureService } from '../../../services/signatureService';
import { ElectronicSignature } from '../../../types/signature';
import { QualityDeviation } from '../../../types/deviation';
import { firebaseDeviationRepository } from '../../../repositories/firebase/FirebaseDeviationRepository';
import { BatchGenealogyTree } from './components/BatchGenealogyTree';
import { BatchAuditHistoryTimeline, BatchTimelineEvent } from './components/BatchAuditHistoryTimeline';

export const Batch360Page: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { batches, rawMaterials, testResults } = useDataGraph();
  const rawMaterialsList = useAppStore(s => s.rawMaterials);

  const [activeTab, setActiveTab] = useState<'GENEALOGY' | 'TIMELINE' | 'CQAS'>('GENEALOGY');
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [deviations, setDeviations] = useState<QualityDeviation[]>([]);
  const [isLoadingAsync, setIsLoadingAsync] = useState(true);

  // Lấy dữ liệu lô đã được hydrate từ graph
  const batch = useMemo(() => {
    if (!id) return null;
    return batches.find(b => b.id === id) || null;
  }, [id, batches]);

  // Tải danh sách chữ ký số và sai lệch liên quan đến lô
  useEffect(() => {
    let isMounted = true;
    const loadExtraData = async () => {
      if (!id) return;
      setIsLoadingAsync(true);
      try {
        const sigService = new SignatureService();
        const [loadedSigs, loadedDevs] = await Promise.all([
          sigService.getSignaturesForDocument('BATCH', id).catch(() => []),
          firebaseDeviationRepository.findByRelation('batchId', id).catch(() => [])
        ]);
        if (isMounted) {
          setSignatures(loadedSigs);
          setDeviations(loadedDevs);
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin bổ sung Batch 360:', err);
      } finally {
        if (isMounted) setIsLoadingAsync(false);
      }
    };
    loadExtraData();
    return () => { isMounted = false; };
  }, [id]);

  // Lấy danh sách phiếu kiểm nghiệm của lô này
  const batchTestResults = useMemo(() => {
    if (!id || !testResults) return [];
    return testResults.filter(tr => tr.batchId === id);
  }, [id, testResults]);

  // Xây dựng báo cáo gia phả lô bằng service chuẩn
  const genealogyReport: BatchGenealogyReport | null = useMemo(() => {
    if (!batch) return null;
    try {
      return buildBatchGenealogy({
        batch,
        product: batch.product,
        tccs: batch.tccs,
        formula: batch.formula,
        rawMaterials: rawMaterialsList || [],
        testResults: batchTestResults,
        allBatches: batches || []
      });
    } catch (err) {
      console.error('Lỗi khi tạo báo cáo phả hệ:', err);
      return null;
    }
  }, [batch, batchTestResults, rawMaterialsList, batches]);

  // Tổng hợp các mốc sự kiện cho Timeline
  const timelineEvents: BatchTimelineEvent[] = useMemo(() => {
    if (!batch) return [];
    const events: BatchTimelineEvent[] = [];

    // 1. Mốc tạo lô
    if (batch.createdAt || batch.mfgDate) {
      events.push({
        id: `evt-create-${batch.id}`,
        timestamp: batch.createdAt || batch.mfgDate,
        type: 'CREATED',
        title: `Khởi tạo hồ sơ Lô sản xuất ${batch.batchNo}`,
        description: `Sản phẩm: ${batch.product?.name || 'N/A'}. Năng suất lý thuyết: ${batch.theoreticalYield || 'N/A'} ${batch.yieldUnit || ''}.`,
        badge: 'LÔ MỚI',
        details: {
          'Ngày sản xuất': formatDateStandard(batch.mfgDate),
          'Hạn sử dụng': formatDateStandard(batch.expDate),
          'Quy cách bao gói': batch.packaging || 'N/A'
        }
      });
    }

    // 2. Mốc các phiếu kiểm nghiệm
    batchTestResults.forEach(tr => {
      const passCount = ensureArray(tr.results).filter(r => r.isPass).length;
      const failCount = ensureArray(tr.results).filter(r => !r.isPass).length;
      events.push({
        id: `evt-tr-${tr.id}`,
        timestamp: tr.testDate || tr.createdAt || new Date().toISOString(),
        type: 'TEST_RESULT',
        title: `Phiếu kiểm nghiệm tại ${tr.labName || 'Phòng Lab'}`,
        description: tr.overallStatus === 'PASS' 
          ? `Tất cả ${passCount} chỉ tiêu đạt chuẩn quy định TCCS.`
          : `Phát hiện ${failCount} chỉ tiêu không đạt tiêu chuẩn.`,
        status: tr.overallStatus === 'PASS' ? 'PASS' : 'FAIL',
        badge: tr.overallStatus === 'PASS' ? 'ĐẠT (PASS)' : 'KHÔNG ĐẠT (OOS)',
        details: {
          'Số chỉ tiêu kiểm nghiệm': ensureArray(tr.results).length,
          'Ghi chú': tr.notes || undefined
        }
      });
    });

    // 3. Mốc các sai lệch phát sinh
    deviations.forEach(dev => {
      events.push({
        id: `evt-dev-${dev.id}`,
        timestamp: dev.loggedAt || new Date().toISOString(),
        type: 'DEVIATION',
        title: `Phát sinh sai lệch: ${dev.title}`,
        description: dev.description,
        status: dev.severity === 'CRITICAL' ? 'FAIL' : 'WARNING',
        badge: `SAI LỆCH ${dev.severity}`,
        details: {
          'Mã sai lệch': dev.deviationNo,
          'Mức độ': dev.severity,
          'Trạng thái': dev.status
        }
      });
    });

    // 4. Mốc chữ ký điện tử
    signatures.forEach(sig => {
      events.push({
        id: `evt-sig-${sig.id}`,
        timestamp: sig.signedAt,
        type: 'E_SIGNATURE',
        title: `Ký duyệt điện tử: ${sig.meaning}`,
        description: `Ký duyệt bởi ${sig.signerEmail} với vai trò ${sig.role}. Mã băm bảo đảm bất biến: ${sig.checksum.substring(0, 16)}...`,
        status: 'INFO',
        actor: sig.signerEmail,
        badge: '21 CFR PART 11',
        details: {
          'Vai trò': sig.role,
          'Mã chữ ký': sig.id,
          'Ý nghĩa': sig.meaning
        }
      });
    });

    return events;
  }, [batch, batchTestResults, deviations, signatures]);

  if (!batch) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block p-4 bg-surface-2 rounded-2xl mb-4 border border-border">
          <Square3Stack3DIcon className="w-8 h-8 text-ink-muted" />
        </div>
        <h2 className="text-xl font-bold text-ink">Không tìm thấy lô sản xuất</h2>
        <p className="text-ink-muted text-sm mt-1">Lô hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
        <Link
          to="/batches"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh sách Lô
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header điều hướng & Tiêu đề Batch 360 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate(`/batches/${batch.id}`)}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors border border-border cursor-pointer"
            title="Quay lại chi tiết lô"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                BATCH 360° QUALITY COCKPIT
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                batch.status === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' :
                batch.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20' :
                'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {batch.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mt-1">
              Lô {batch.batchNo} — {batch.product?.name || 'Sản phẩm'}
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Hồ sơ chất lượng toàn diện, gia phả truy xuất nguồn gốc và lịch sử tuân thủ 21 CFR Part 11
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/batches/${batch.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-soft bg-surface hover:bg-surface-2 border border-border rounded-lg transition-colors shadow-xs"
          >
            <Square3Stack3DIcon className="w-3.5 h-3.5" />
            <span>Trang quản lý lô</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <PrinterIcon className="w-3.5 h-3.5" />
            <span>In hồ sơ 360</span>
          </button>
        </div>
      </div>

      {/* Thông tin vắn tắt Lô & Sản phẩm */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-xs">
          <span className="text-xs font-medium text-ink-muted block">Sản phẩm</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {batch.product?.name || 'Chưa gắn SP'}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-xs">
          <span className="text-xs font-medium text-ink-muted block">Tiêu chuẩn áp dụng</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {batch.tccs?.code || 'Chưa gắn TCCS'}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-xs">
          <span className="text-xs font-medium text-ink-muted block">Ngày sản xuất / Hạn dùng</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {formatDateStandard(batch.mfgDate)} — {formatDateStandard(batch.expDate)}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-xs">
          <span className="text-xs font-medium text-ink-muted block">Năng suất thực tế</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {batch.actualYield ? `${batch.actualYield} ${batch.yieldUnit || ''}` : 'Chưa ghi nhận'}
          </span>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('GENEALOGY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'GENEALOGY'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <ShareIcon className="w-4 h-4" />
          <span>Cây Gia phả Lô & Nguồn gốc (Genealogy)</span>
        </button>
        <button
          onClick={() => setActiveTab('TIMELINE')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'TIMELINE'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          <span>Dòng thời gian Thẩm định & Ký duyệt (Timeline)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">
            {timelineEvents.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('CQAS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'CQAS'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <BeakerIcon className="w-4 h-4" />
          <span>Chỉ tiêu Trọng yếu (CQAs Matrix)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">
            {batchTestResults.length} phiếu KN
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'GENEALOGY' && genealogyReport && (
        <BatchGenealogyTree report={genealogyReport} />
      )}

      {activeTab === 'TIMELINE' && (
        <BatchAuditHistoryTimeline 
          events={timelineEvents} 
          signatures={signatures} 
          deviations={deviations} 
        />
      )}

      {activeTab === 'CQAS' && (
        <div className="bg-surface rounded-xl border border-border p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-semibold text-ink text-sm">
                Ma trận Kết quả Kiểm nghiệm so với Tiêu chuẩn TCCS
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Tổng hợp tất cả lần phân tích từ phòng kiểm nghiệm nội bộ và ngoại kiểm
              </p>
            </div>
            <span className="text-xs font-medium text-ink-muted">
              Tổng số {batchTestResults.length} phiếu kiểm nghiệm
            </span>
          </div>

          {batchTestResults.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-sm italic">
              Chưa có phiếu kiểm nghiệm nào được ghi nhận cho lô sản xuất này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2/60 text-ink-muted font-semibold text-xs border-b border-border">
                  <tr>
                    <th className="p-3">Ngày kiểm nghiệm</th>
                    <th className="p-3">Đơn vị kiểm nghiệm</th>
                    <th className="p-3">Kết luận tổng</th>
                    <th className="p-3">Số chỉ tiêu đạt</th>
                    <th className="p-3">Ghi chú</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batchTestResults.map((tr) => {
                    const passCount = ensureArray(tr.results).filter(r => r.isPass).length;
                    const totalCount = ensureArray(tr.results).length;
                    return (
                      <tr key={tr.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="p-3 font-medium text-ink">
                          {formatDateStandard(tr.testDate)}
                        </td>
                        <td className="p-3 text-ink-soft">
                          {tr.labName || 'Phòng Lab'}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            tr.overallStatus === 'PASS'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                            {tr.overallStatus === 'PASS' ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" /> : <XCircleIcon className="w-3.5 h-3.5 text-rose-600" />}
                            {tr.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </span>
                        </td>
                        <td className="p-3 text-ink-muted">
                          {passCount} / {totalCount} chỉ tiêu
                        </td>
                        <td className="p-3 text-ink-muted max-w-xs truncate">
                          {tr.notes || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            to={`/test-results/print/${tr.id}`}
                            className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-1"
                          >
                            Xem phiếu <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

