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
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, 
  Calendar, FileText, Package, Building2, QrCode, ExternalLink,
  Award, RefreshCw
} from 'lucide-react';
import { TestResult, Batch, Product, TCCS } from '../../types';
import { formatDateStandard, calculateOverallStatus, TEST_RESULT_STATUS } from '../../utils';

export const CoAVerifyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [tccs, setTccs] = useState<TCCS | null>(null);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-slate-100 flex flex-col items-center gap-4">
          <RefreshCw size={36} className="animate-spin text-primary-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Đang xác thực chứng chỉ...</h2>
            <p className="text-xs text-slate-500 mt-1">Hệ thống QMS V-Biotech đang kiểm tra tính toàn vẹn dữ liệu</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !testResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-slate-100 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Không thể xác thực</h2>
            <p className="text-sm text-slate-500 mt-2">{error || 'Chứng chỉ không tồn tại hoặc đã bị gỡ bỏ.'}</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-bold text-primary-600 hover:text-primary-700 underline pt-2"
          >
            Đăng nhập hệ thống quản trị <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">
        
        {/* Banner Thương hiệu & Huy hiệu Xác thực */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-3 shadow-inner">
            <ShieldCheck size={38} />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
            Chứng chỉ Hợp lệ (Verified CoA)
          </span>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Xác Thực Chứng Chỉ Phân Tích Chất Lượng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hệ thống Quản lý Chất lượng Dược phẩm & Thực phẩm bảo vệ sức khỏe V-Biotech
          </p>

          <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <Award size={15} className="text-amber-500" /> Tiêu chuẩn TCCS & GMP
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-primary-500" /> {testResult.labName || 'Phòng Kiểm nghiệm V-Biotech'}
            </span>
          </div>
        </div>

        {/* Thẻ Chi tiết Sản phẩm & Lô */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Package size={16} className="text-primary-600" /> Thông tin Lô Sản phẩm
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Tên sản phẩm</span>
              <span className="font-bold text-slate-900 text-base">{product?.name || '---'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Số lô sản xuất (Batch No.)</span>
              <span className="font-bold font-mono text-slate-900 text-base text-primary-700">{batch?.batchNo || '---'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Ngày sản xuất (MFG)</span>
              <span className="font-semibold text-slate-800">{batch?.mfgDate ? formatDateStandard(batch.mfgDate) : '---'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Hạn sử dụng (EXP)</span>
              <span className="font-semibold text-slate-800">{batch?.expDate ? formatDateStandard(batch.expDate) : '---'}</span>
            </div>
          </div>
        </div>

        {/* Bảng Chỉ tiêu Kết quả Tóm tắt */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText size={16} className="text-primary-600" /> Kết quả Kiểm nghiệm
            </h2>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase ${
              isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isPassed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {isPassed ? 'KẾT LUẬN: ĐẠT' : 'KẾT LUẬN: KHÔNG ĐẠT'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3.5">Chỉ tiêu</th>
                  <th className="py-2.5 px-3.5">Yêu cầu TCCS</th>
                  <th className="py-2.5 px-3.5 text-right">Kết quả đo</th>
                  <th className="py-2.5 px-3.5 text-center">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(testResult.results || []).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3.5 font-medium text-slate-800">{r.criteriaName}</td>
                    <td className="py-2.5 px-3.5 text-slate-500">{r.limit || 'Theo TCCS'}</td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">
                      {r.value} {r.unit}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.isPass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {r.isPass ? 'Đạt' : 'KĐ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center">
            Mã định danh phiếu: <span className="font-mono text-slate-600 font-semibold">{testResult.id}</span> · Ngày kiểm: {formatDateStandard(testResult.testDate)}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 space-y-2 py-4">
          <p>© {new Date().getFullYear()} V-Biotech Quality Management System. Tất cả quyền được bảo lưu.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-primary-600 hover:underline font-semibold"
          >
            Truy cập Cổng Quản Trị Nội Bộ <ExternalLink size={12} />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CoAVerifyPage;
