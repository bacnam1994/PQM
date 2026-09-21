import { useAppStore } from '../../../store/useAppStore';
import { generateId, formatDateStandard, BATCH_STATUS } from '../../../utils';
import { validateAIAction } from '../aiActionGuard';
import { predictBatchRiskBeforeTesting } from '../predictiveInspectionService';

/**
 * Tạo mới một lô sản xuất trực tiếp vào hệ thống PQM qua AI
 */
export const createBatchAction = async (
  args: {
    productIdentifier: string;
    batchNo: string;
    mfgDate: string;
    expDate: string;
    theoreticalYield?: number;
    yieldUnit?: string;
  },
  appContext: any
) => {
  const store = useAppStore.getState();
  const currentUser = appContext?.user || store.user;
  const guard = validateAIAction(
    'createBatch',
    { batchNo: args.batchNo, productIdentifier: args.productIdentifier },
    currentUser
  );
  if (!guard.allowed) {
    return {
      success: false,
      error: guard.reason || 'Tài khoản hiện tại không có quyền tạo lô sản xuất mới qua AI.',
    };
  }

  if (guard.requiresUserApproval) {
    return {
      success: false,
      isRegulated: true,
      requiresApproval: true,
      proposal: guard.proposal,
      message: `⚠️ **Yêu cầu phê duyệt hành động tạo lô sản xuất:**\n- Hành động: Tạo lô mới **${args.batchNo}** cho sản phẩm **${args.productIdentifier}**\n- Lý do: Yêu cầu từ AI Copilot\n- Theo chuẩn kiểm soát chất lượng, AI không được tự ý ghi dữ liệu lô mới vào cơ sở dữ liệu khi chưa có sự xác nhận của người dùng.\n\n👉 Vui lòng xác nhận đề xuất tạo lô này trên giao diện.`,
    };
  }

  const products = store.products?.length ? store.products : appContext.products || [];
  const tccsList = store.tccsList?.length ? store.tccsList : appContext.tccsList || [];
  const batches = store.batches?.length ? store.batches : appContext.batches || [];

  const query = (args.productIdentifier || '').trim().toLowerCase();
  const product = products.find(
    (p: any) =>
      p.code?.toLowerCase() === query || p.name?.toLowerCase().includes(query) || p.id === query
  );

  if (!product) {
    return {
      success: false,
      error: `Không tìm thấy sản phẩm phù hợp với "${args.productIdentifier}". Vui lòng kiểm tra lại mã hoặc tên sản phẩm.`,
    };
  }

  // Kiểm tra trùng số lô trong cùng sản phẩm
  const existingBatch = batches.find(
    (b: any) =>
      b.productId === product.id &&
      b.batchNo?.trim().toUpperCase() === args.batchNo?.trim().toUpperCase()
  );
  if (existingBatch) {
    return {
      success: false,
      error: `Số lô "${args.batchNo}" đã tồn tại cho sản phẩm "${product.name}". Bạn có thể truy cập [Xem chi tiết lô ${args.batchNo}](/batches/${existingBatch.id}).`,
    };
  }

  // Chuẩn hóa ngày
  const formatInputDate = (d: string) => {
    if (!d) return '';
    if (d.includes('/')) {
      const parts = d.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return d;
  };

  const mfg = formatInputDate(args.mfgDate);
  const exp = formatInputDate(args.expDate);

  // Tìm TCCS hiệu lực
  const activeTccs =
    tccsList.find((t: any) => t.productId === product.id && t.isActive) ||
    tccsList.find((t: any) => t.productId === product.id);

  const newBatchId = generateId('batch');
  const newBatch = {
    id: newBatchId,
    productId: product.id,
    tccsId: activeTccs?.id || '',
    batchNo: args.batchNo.trim(),
    mfgDate: mfg,
    expDate: exp,
    theoreticalYield: args.theoreticalYield || 0,
    actualYield: 0,
    yieldUnit: args.yieldUnit || 'chai',
    status: BATCH_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await store.addBatch(newBatch as any);
    return {
      success: true,
      batchId: newBatchId,
      batchNo: newBatch.batchNo,
      productName: product.name,
      productCode: product.code,
      tccsCode: activeTccs?.code || 'Chưa gán',
      message: `✅ Đã tạo thành công lô sản xuất mới!\n- **Số Lô**: \`${newBatch.batchNo}\`\n- **Sản phẩm**: **${product.name}** (${product.code})\n- **NSX**: ${formatDateStandard(mfg)} | **HSD**: ${formatDateStandard(exp)}\n- **TCCS áp dụng**: ${activeTccs?.code || 'Chưa có'}\n- **Trạng thái**: Chờ kiểm nghiệm (PENDING)\n\n👉 [Xem chi tiết Lô ${newBatch.batchNo}](/batches/${newBatchId})`,
      action: 'REDIRECT',
      path: `/batches/${newBatchId}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Không thể tạo lô: ${err.message || err}`,
    };
  }
};

/**
 * Tìm và trả về đường dẫn trực tiếp để xem/in Certificate of Analysis (CoA)
 */
export const exportCoAReportAction = (args: { batchNo: string }, appContext: any) => {
  const store = useAppStore.getState();
  const batches = store.batches?.length ? store.batches : appContext.batches || [];
  const testResults = store.testResults?.length ? store.testResults : appContext.testResults || [];
  const products = store.products?.length ? store.products : appContext.products || [];

  const query = (args.batchNo || '').trim().toLowerCase();
  const batch = batches.find((b: any) => b.batchNo?.toLowerCase() === query || b.id === query);

  if (!batch) {
    return {
      success: false,
      error: `Không tìm thấy lô "${args.batchNo}" trong hệ thống.`,
    };
  }

  const product = products.find((p: any) => p.id === batch.productId);
  const batchTests = testResults.filter((r: any) => r.batchId === batch.id);

  if (batchTests.length === 0) {
    return {
      success: false,
      batchNo: batch.batchNo,
      message: `Lô **${batch.batchNo}** (${product?.name || ''}) hiện chưa có phiếu kiểm nghiệm nào được nhập vào hệ thống.\n\n👉 [Nhập kết quả kiểm nghiệm cho lô này](/test-results/new)`,
    };
  }

  const sortedTests = [...batchTests].sort((a: any, b: any) =>
    (b.testDate || '').localeCompare(a.testDate || '')
  );
  const latestTest = sortedTests[0];

  return {
    success: true,
    batchNo: batch.batchNo,
    productName: product?.name || '',
    testCount: batchTests.length,
    latestTestDate: latestTest.testDate,
    message: `📄 Tìm thấy **${batchTests.length} phiếu kiểm nghiệm** cho lô **${batch.batchNo}** (${product?.name || ''}).\n\nBạn có thể xem hoặc in Certificate of Analysis (CoA) theo 2 định dạng:\n1. 👉 [Xem CoA Tổng hợp Lô ${batch.batchNo}](/test-results/coa-batch/${batch.id})\n2. 👉 [In Phiếu kiểm nghiệm mới nhất (${latestTest.id.slice(-6)})](/test-results/print/${latestTest.id})`,
    action: 'REDIRECT',
    path: `/test-results/coa-batch/${batch.id}`,
  };
};

/**
 * Cập nhật trạng thái của lô sản xuất qua AI kèm Action Guard
 */
export const updateBatchStatusAction = async (
  args: {
    batchNo: string;
    newStatus: 'RELEASED' | 'REJECTED' | 'TESTING';
    reason?: string;
  },
  appContext: any
) => {
  const store = useAppStore.getState();
  const batches = store.batches?.length ? store.batches : appContext.batches || [];
  const batch = batches.find(
    (b: any) => b.batchNo?.toLowerCase() === args.batchNo?.toLowerCase() || b.id === args.batchNo
  );

  if (!batch) {
    return {
      success: false,
      error: `Không tìm thấy lô "${args.batchNo}" trong hệ thống.`,
    };
  }

  const currentUser = appContext?.user || store.user;
  const guard = validateAIAction(
    'updateBatchStatus',
    { batchId: batch.id, status: args.newStatus, reason: args.reason },
    currentUser,
    args.reason,
    batch
  );

  if (!guard.allowed) {
    return {
      success: false,
      error: guard.reason || 'Tài khoản hiện tại không có thẩm quyền đổi trạng thái lô này.',
    };
  }

  // WF-016: AI only proposes workflow actions. AI MUST NEVER mutate workflow status directly.
  return {
    success: false,
    isRegulated: true,
    requiresApproval: true,
    proposal: guard.proposal,
    message: `⚠️ **Đề xuất hành động Workflow Lô (AI Proposal Only):**\n- Hành động đề xuất: Đổi trạng thái lô **${batch.batchNo}** sang **${args.newStatus}**\n- Lý do: ${args.reason || 'Đề xuất từ AI'}\n- Theo quy định GMP và PQM Workflow Master, AI chỉ được quyền ĐỀ XUẤT. Người có thẩm quyền phải thực hiện phê duyệt / ký điện tử trực tiếp tại [Chi tiết lô ${batch.batchNo}](/batches/${batch.id}).`,
  };
};

/**
 * Dự báo rủi ro chất lượng lô trước kiểm nghiệm
 */
export const predictBatchRiskAction = (args: { batchNo: string }, appContext: any) => {
  return predictBatchRiskBeforeTesting(args.batchNo, appContext);
};
