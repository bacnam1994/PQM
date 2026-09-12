/**
 * CoAVerifyPage.tsx
 * ========================
 * Trang xác thực Chứng chỉ Phân tích Chất lượng (CoA) Công khai.
 * Cho phép khách hàng, đối tác, nhà thuốc quét mã QR trên bản in CoA để xác thực nguồn gốc chính hãng.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, get } from 'firebase/database';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  DocumentTextIcon, 
  CubeIcon, 
  BuildingOffice2Icon, 
  ArrowTopRightOnSquareIcon,
  CheckBadgeIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import { TestResult, Batch, Product, TCCS } from '../../types';
import { ElectronicSignature } from '../../types/signature';
import { formatDateStandard, calculateOverallStatus, TEST_RESULT_STATUS } from '../../utils';

export const CoAVerifyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [tccs, setTccs] = useState<TCCS | null>(null);
  const [signature, setSignature] = useState<ElectronicSignature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Mã xác thực không hợp lệ');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Thử tìm theo TestResult ID
        let trData: TestResult | null = null;
        const trSnap = await get(ref(db, `testResults/${id}`));
        
        if (trSnap.exists()) {
          trData = { id: trSnap.key!, ...trSnap.val() };
        } else {
          // 2. Thử tìm theo Batch ID nếu id truyền vào là batchId
          const batchSnap = await get(ref(db, `batches/${id}`));
          if (batchSnap.exists()) {
            const bData: Batch = { id: batchSnap.key!, ...batchSnap.val() };
            setBatch(bData);
            
            // Tìm TestResult liên kết với Batch
            const allTrSnap = await get(ref(db, 'testResults'));
            if (allTrSnap.exists()) {
              const allTr = allTrSnap.val();
              const foundKey = Object.keys(allTr).find(k => allTr[k].batchId === bData.id);
              if (foundKey) {
                trData = { id: foundKey, ...allTr[foundKey] };
              }
            }
          }
        }

        if (!trData) {
          setError('Không tìm thấy dữ liệu kiểm nghiệm tương ứng với mã QR này.');
          setLoading(false);
          return;
        }

        setTestResult(trData);

        // 3. Tải thông tin Lô (nếu chưa có)
        let currentBatch: Batch | null = null;
        if (trData.batchId) {
          const bSnap = await get(ref(db, `batches/${trData.batchId}`));
          if (bSnap.exists()) {
            currentBatch = { id: bSnap.key!, ...bSnap.val() };
            setBatch(currentBatch);

            // 4. Tải thông tin Sản phẩm
            if (currentBatch.productId) {
              const pSnap = await get(ref(db, `products/${currentBatch.productId}`));
              if (pSnap.exists()) {
                setProduct({ id: pSnap.key!, ...pSnap.val() });
              }
            }
          }
        }

        // 5. Tải thông tin TCCS (thông qua Batch hoặc Product)
        if (currentBatch && currentBatch.tccsId) {
          const tccsSnap = await get(ref(db, `tccs/${currentBatch.tccsId}`));
          if (tccsSnap.exists()) {
            setTccs({ id: tccsSnap.key!, ...tccsSnap.val() });
          }
        }

        // 6. Tải Chữ ký điện tử (FDA 21 CFR Part 11) nếu có
        try {
          const sigSnap = await get(ref(db, 'electronic_signatures'));
          if (sigSnap.exists()) {
            const allSigs = Object.values(sigSnap.val()) as ElectronicSignature[];
            const found = allSigs.find(s =>
              s && (
                (currentBatch && s.documentId === currentBatch.id) ||
                (trData && s.documentId === trData.id)
              )
            );
            if (found) {
              setSignature(found);
            }
          }
        } catch (sigErr) {
          console.warn('Lỗi đọc chữ ký điện tử:', sigErr);
        }
      } catch (err: any) {
        console.error('Error verifying CoA:', err);
        setError('Có lỗi xảy ra trong quá trình truy xuất dữ liệu xác thực.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const isPassed = testResult?.overallStatus === 'PASS' || (testResult && calculateOverallStatus(testResult.results || [], tccs) === TEST_RESULT_STATUS.PASS);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="bg-surface rounded-xl p-8 max-w-md w-full text-center shadow-xs border border-border flex flex-col items-center gap-3">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-ink">Đang xác thực chứng chỉ...</h2>
            <p className="text-xs text-ink-muted mt-1">Hệ thống QMS V-Biotech đang kiểm tra tính toàn vẹn dữ liệu</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !testResult) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="bg-surface rounded-xl p-8 max-w-md w-full text-center shadow-xs border border-border space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">Không thể xác thực</h2>
            <p className="text-xs text-ink-muted mt-1.5">{error || 'Chứng chỉ không tồn tại hoặc đã bị gỡ bỏ.'}</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline pt-2"
          >
            Đăng nhập hệ thống quản trị <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">
        
        {/* Banner Thương hiệu & Huy hiệu Xác thực */}
        <div className="bg-surface rounded-xl p-6 sm:p-7 shadow-xs border border-border text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3 border border-emerald-500/20">
            <ShieldCheckIcon className="w-8 h-8" />
          </div>

          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium mb-2">
              Chứng chỉ hợp lệ (Verified CoA)
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Xác thực Chứng chỉ Phân tích Chất lượng
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Hệ thống Quản lý Chất lượng Dược phẩm & Thực phẩm bảo vệ sức khỏe V-Biotech
          </p>

          <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-ink-muted">
            <span className="flex items-center gap-1.5">
              <CheckBadgeIcon className="w-4 h-4 text-amber-500" /> Tiêu chuẩn TCCS & GMP
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <BuildingOffice2Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {testResult.labName || 'Phòng Kiểm nghiệm V-Biotech'}
            </span>
          </div>
        </div>

        {/* Thẻ Chi tiết Sản phẩm & Lô */}
        <div className="bg-surface rounded-xl p-5 shadow-xs border border-border space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
            <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Thông tin Lô Sản phẩm
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-surface-2/60 border border-border">
              <span className="text-xs text-ink-muted block font-medium">Tên sản phẩm</span>
              <span className="font-semibold text-ink text-sm mt-0.5 block">{product?.name || '---'}</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-2/60 border border-border">
              <span className="text-xs text-ink-muted block font-medium">Số lô sản xuất (Batch No.)</span>
              <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">{batch?.batchNo || '---'}</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-2/60 border border-border">
              <span className="text-xs text-ink-muted block font-medium">Ngày sản xuất (MFG)</span>
              <span className="font-medium text-ink text-sm mt-0.5 block">{batch?.mfgDate ? formatDateStandard(batch.mfgDate) : '---'}</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-2/60 border border-border">
              <span className="text-xs text-ink-muted block font-medium">Hạn sử dụng (EXP)</span>
              <span className="font-medium text-ink text-sm mt-0.5 block">{batch?.expDate ? formatDateStandard(batch.expDate) : '---'}</span>
            </div>
          </div>
        </div>

        {/* Thẻ Chữ Ký Điện Tử (FDA 21 CFR Part 11) */}
        {signature && (
          <div className="bg-zinc-900 text-zinc-100 rounded-xl p-5 shadow-sm border border-zinc-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <ShieldCheckIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-zinc-100 uppercase tracking-wide">Chữ ký điện tử hợp lệ (21 CFR Part 11)</h3>
                  <p className="text-[11px] text-zinc-400">Chứng nhận tính toàn vẹn bất biến (ALCOA+ Compliant)</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">
                Đã ký duyệt
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-medium">Người ký & Chức danh</span>
                <span className="font-medium text-zinc-100 text-xs mt-0.5 block">{signature.signerName}</span>
                <span className="text-zinc-400 block text-[10px] font-mono mt-0.5">{signature.signerEmail} ({signature.role})</span>
              </div>

              <div className="bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-medium">Thời gian ký</span>
                <span className="font-medium text-zinc-100 text-xs mt-0.5 block">{new Date(signature.signedAt).toLocaleString('vi-VN')}</span>
                <span className="text-zinc-400 block text-[10px] mt-0.5 font-mono truncate">{signature.signedAt}</span>
              </div>
            </div>

            <div className="mt-2.5 bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-700/50 space-y-0.5">
              <span className="text-zinc-400 block text-[10px] uppercase font-medium">Ý nghĩa pháp lý</span>
              <p className="text-xs text-amber-300/90 font-medium italic">"{signature.meaning}"</p>
            </div>

            {signature.checksum && (
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-800 font-mono">
                <span>SHA-256:</span>
                <span className="text-zinc-300 truncate max-w-xs">{signature.checksum}</span>
              </div>
            )}
          </div>
        )}

        {/* Bảng Chỉ tiêu Kết quả Tóm tắt */}
        <div className="bg-surface rounded-xl p-5 shadow-xs border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Kết quả Kiểm nghiệm
            </h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isPassed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
            }`}>
              {isPassed ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
              {isPassed ? 'ĐẠT TIÊU CHUẨN' : 'KHÔNG ĐẠT'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 text-ink-muted font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3.5">Chỉ tiêu</th>
                  <th className="py-2.5 px-3.5">Yêu cầu TCCS</th>
                  <th className="py-2.5 px-3.5 text-right">Kết quả đo</th>
                  <th className="py-2.5 px-3.5 text-center">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(testResult.results || []).map((r, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-2 px-3.5 font-medium text-ink">{r.criteriaName}</td>
                    <td className="py-2 px-3.5 text-ink-muted">{r.limit || 'Theo TCCS'}</td>
                    <td className="py-2 px-3.5 text-right font-medium text-ink">
                      {r.value} {r.unit}
                    </td>
                    <td className="py-2 px-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.isPass ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                      }`}>
                        {r.isPass ? 'Đạt' : 'KĐ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-1 text-[11px] text-ink-muted text-center">
            Mã định danh phiếu: <span className="font-mono text-ink font-medium">{testResult.id}</span> · Ngày kiểm: {formatDateStandard(testResult.testDate)}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-ink-muted space-y-1.5 py-4">
          <p>© {new Date().getFullYear()} V-Biotech Quality Management System. Tất cả quyền được bảo lưu.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Truy cập Cổng Quản trị Nội bộ <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CoAVerifyPage;
