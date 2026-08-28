/**
 * batchGenealogyService.ts
 * =========================
 * AI Batch Genealogy Tracer — Truy vết nguồn gốc lô thành phẩm.
 * 
 * Xây dựng cây truy vết hoàn chỉnh từ:
 * Nguyên liệu đầu vào → Công thức sản xuất → Lô thành phẩm → Kiểm nghiệm → Quyết định
 */

export type GenealogyNodeType =
  | 'PRODUCT'
  | 'FORMULA'
  | 'TCCS'
  | 'RAW_MATERIAL'
  | 'BATCH'
  | 'TEST_RESULT'
  | 'DECISION';

export type GenealogyNodeStatus =
  | 'OK'
  | 'WARNING'
  | 'FAIL'
  | 'PENDING'
  | 'INFO';

export interface GenealogyNode {
  id: string;
  type: GenealogyNodeType;
  label: string;
  sublabel?: string;
  status: GenealogyNodeStatus;
  details: Record<string, string | number | undefined>;
  children?: GenealogyNode[];
  navigationPath?: string;   // Route để navigate đến trang chi tiết
  isKeyNode?: boolean;       // Đánh dấu các node quan trọng
  badges?: { text: string; color: string }[];
}

export interface BatchGenealogyReport {
  generatedAt: string;
  batchId: string;
  batchNo: string;
  productName: string;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons: string[];
  tree: GenealogyNode;     // Root node = Batch
  traceabilityScore: number;  // 0-100: Mức độ đầy đủ dữ liệu truy vết
  missingLinks: string[];     // Các liên kết dữ liệu còn thiếu
  summary: string;
}

interface GenealogyContext {
  batch: any;              // HydratedBatch
  product?: any;
  tccs?: any;
  formula?: any;
  rawMaterials: any[];
  testResults: any[];      // TestResults của lô này
  allBatches: any[];       // Tất cả lô (để tìm lô liên quan)
}

const fmt = (d: string | undefined) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
  } catch { return d || 'N/A'; }
};

const statusFromBatch = (batchStatus: string): GenealogyNodeStatus => {
  switch (batchStatus) {
    case 'RELEASED': return 'OK';
    case 'REJECTED': return 'FAIL';
    case 'TESTING': return 'WARNING';
    default: return 'PENDING';
  }
};

const statusFromTestResult = (overallStatus: string): GenealogyNodeStatus => {
  return overallStatus === 'PASS' ? 'OK' : 'FAIL';
};

/**
 * Xây dựng cây Genealogy cho một lô sản xuất
 */
export const buildBatchGenealogy = (ctx: GenealogyContext): BatchGenealogyReport => {
  const { batch, product, tccs, formula, rawMaterials, testResults } = ctx;
  const now = new Date().toISOString();
  const missingLinks: string[] = [];
  const riskReasons: string[] = [];

  // ── Node 1: Batch (root) ──
  const batchStatus = statusFromBatch(batch.status || 'PENDING');
  const batchNode: GenealogyNode = {
    id: `node_batch_${batch.id}`,
    type: 'BATCH',
    label: `Lô ${batch.batchNo}`,
    sublabel: `NSX: ${fmt(batch.mfgDate)} — HSD: ${fmt(batch.expDate)}`,
    status: batchStatus,
    isKeyNode: true,
    details: {
      'Số lô': batch.batchNo,
      'Ngày SX': fmt(batch.mfgDate),
      'Hạn dùng': fmt(batch.expDate),
      'Năng suất lý thuyết': batch.theoreticalYield ? `${batch.theoreticalYield} ${batch.yieldUnit || ''}` : 'N/A',
      'Năng suất thực tế': batch.actualYield ? `${batch.actualYield} ${batch.yieldUnit || ''}` : 'N/A',
      'Trạng thái': batch.status,
    },
    navigationPath: `/batches/${batch.id}`,
    badges: batch.status === 'RELEASED' ? [{ text: 'ĐÃ XUẤT XƯỞNG', color: 'green' }] :
            batch.status === 'REJECTED' ? [{ text: 'BỊ TỪ CHỐI', color: 'red' }] :
            [{ text: batch.status, color: 'gray' }],
    children: [],
  };

  // ── Node 2: Test Results ──
  const testResultNodes: GenealogyNode[] = testResults
    .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))
    .map(tr => {
      const passCount = (tr.results || []).filter((r: any) => r.isPass).length;
      const failCount = (tr.results || []).filter((r: any) => !r.isPass).length;
      return {
        id: `node_tr_${tr.id}`,
        type: 'TEST_RESULT' as GenealogyNodeType,
        label: tr.labName || 'Phòng kiểm nghiệm',
        sublabel: `Ngày KN: ${fmt(tr.testDate)}`,
        status: statusFromTestResult(tr.overallStatus),
        details: {
          'Đơn vị KN': tr.labName || 'N/A',
          'Ngày KN': fmt(tr.testDate),
          'Kết quả': tr.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT',
          'Số chỉ tiêu đạt': passCount,
          'Số chỉ tiêu không đạt': failCount,
          'Ghi chú': tr.notes || undefined,
        },
        navigationPath: `/test-results/print/${tr.id}`,
        badges: tr.overallStatus === 'PASS'
          ? [{ text: 'ĐẠT', color: 'green' }]
          : [{ text: 'KHÔNG ĐẠT', color: 'red' }, { text: `${failCount} CT lỗi`, color: 'red' }],
      };
    });

  if (testResultNodes.length === 0) {
    missingLinks.push('Chưa có phiếu kiểm nghiệm cho lô này');
    riskReasons.push('Thiếu dữ liệu kiểm nghiệm');
  } else if (testResultNodes.some(n => n.status === 'FAIL')) {
    riskReasons.push(`${testResultNodes.filter(n => n.status === 'FAIL').length} phiếu kiểm nghiệm không đạt`);
  }

  // ── Node 3: Decision (RELEASED/REJECTED/PENDING) ──
  const decisionNode: GenealogyNode = {
    id: `node_decision_${batch.id}`,
    type: 'DECISION',
    label: batch.status === 'RELEASED' ? '✅ Duyệt Xuất Xưởng' :
           batch.status === 'REJECTED' ? '❌ Từ chối Xuất Xưởng' :
           '⏳ Chờ Quyết Định',
    sublabel: batch.status === 'REJECTED' ? `Lý do: ${batch.rejectReason || 'Không ghi chú'}` : undefined,
    status: batch.status === 'RELEASED' ? 'OK' : batch.status === 'REJECTED' ? 'FAIL' : 'PENDING',
    isKeyNode: true,
    details: {
      'Quyết định': batch.status === 'RELEASED' ? 'XUẤT XƯỞNG' : batch.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ',
      'Lý do từ chối': batch.rejectReason || undefined,
      'Cập nhật lần cuối': fmt(batch.updatedAt),
    },
    badges: batch.status === 'RELEASED' ? [{ text: 'RELEASED', color: 'green' }] :
             batch.status === 'REJECTED' ? [{ text: 'REJECTED', color: 'red' }] :
             [{ text: 'PENDING', color: 'yellow' }],
  };

  // ── Node 4: TCCS ──
  let tccsNode: GenealogyNode | undefined;
  if (tccs) {
    const critCount = (tccs.mainQualityCriteria || []).length + (tccs.safetyCriteria || []).length;
    tccsNode = {
      id: `node_tccs_${tccs.id}`,
      type: 'TCCS',
      label: `TCCS: ${tccs.code}`,
      sublabel: `Ban hành: ${fmt(tccs.issueDate)} — ${critCount} chỉ tiêu`,
      status: tccs.isActive ? 'OK' : 'WARNING',
      details: {
        'Mã TCCS': tccs.code,
        'Ngày ban hành': fmt(tccs.issueDate),
        'Số chỉ tiêu chính': (tccs.mainQualityCriteria || []).length,
        'Số chỉ tiêu an toàn': (tccs.safetyCriteria || []).length,
        'Bảo quản': tccs.storage || undefined,
        'Hạn dùng quy định': tccs.shelfLife || undefined,
        'Đang hiệu lực': tccs.isActive ? 'Có' : 'Không',
      },
      navigationPath: `/tccs/detail/${tccs.id}`,
      badges: tccs.isActive ? [{ text: 'ĐANG ÁP DỤNG', color: 'blue' }] : [{ text: 'ĐÃ LỖI THỜI', color: 'gray' }],
    };
  } else {
    missingLinks.push('Không tìm thấy TCCS liên kết với lô này');
    riskReasons.push('Thiếu TCCS — không rõ tiêu chuẩn chất lượng áp dụng');
  }

  // ── Node 5: Product Formula + Raw Materials ──
  let formulaNode: GenealogyNode | undefined;
  if (formula) {
    const ingredients = formula.ingredients || [];
    const excipients = formula.excipients || [];
    const allIngredients = [...ingredients, ...excipients];
    const linkedCount = allIngredients.filter((i: any) => i.materialId).length;
    const unlinkedCount = allIngredients.length - linkedCount;

    if (unlinkedCount > 0) {
      missingLinks.push(`${unlinkedCount} thành phần công thức chưa liên kết với danh mục nguyên liệu`);
    }

    // Material nodes
    const materialNodes: GenealogyNode[] = allIngredients.map((ing: any) => {
      const material = rawMaterials.find((m: any) => m.id === ing.materialId);
      return {
        id: `node_mat_${ing.id || ing.name}`,
        type: 'RAW_MATERIAL' as GenealogyNodeType,
        label: ing.name,
        sublabel: material ? `[${material.category}] ${material.code || ''}` : 'Chưa liên kết danh mục',
        status: material ? 'OK' : 'WARNING',
        details: {
          'Tên thành phần': ing.name,
          'Hàm lượng công bố': ing.declaredContent ? `${ing.declaredContent} ${ing.unit || ''}` : 'N/A',
          'Hàm lượng nguyên tố': ing.elementalContent ? `${ing.elementalContent} ${ing.unit || ''}` : undefined,
          'Mã nguyên liệu': material?.code || undefined,
          'Loại': material?.category || 'Chưa phân loại',
          'Danh mục NL': material ? 'Đã liên kết' : 'Chưa liên kết',
        },
        navigationPath: material ? `/materials/catalog` : undefined,
        badges: material
          ? [{ text: material.category === 'ACTIVE' ? 'HOẠT CHẤT' : 'TÁ DƯỢC', color: material.category === 'ACTIVE' ? 'blue' : 'gray' }]
          : [{ text: 'CHƯA LIÊN KẾT', color: 'yellow' }],
      };
    });

    formulaNode = {
      id: `node_formula_${formula.id}`,
      type: 'FORMULA',
      label: 'Công thức sản phẩm',
      sublabel: `${ingredients.length} hoạt chất, ${excipients.length} tá dược`,
      status: unlinkedCount > 0 ? 'WARNING' : 'OK',
      details: {
        'Số hoạt chất': ingredients.length,
        'Số tá dược': excipients.length,
        'Đã liên kết NL': `${linkedCount}/${allIngredients.length}`,
        'Đóng gói': formula.packaging || undefined,
        'Bảo quản': formula.storage || undefined,
      },
      navigationPath: `/product-formulas`,
      children: materialNodes,
    };
  } else {
    missingLinks.push('Không có công thức sản phẩm trong hệ thống');
  }

  // ── Node 6: Product ──
  let productNode: GenealogyNode | undefined;
  if (product) {
    const children: GenealogyNode[] = [];
    if (tccsNode) children.push(tccsNode);
    if (formulaNode) children.push(formulaNode);

    productNode = {
      id: `node_product_${product.id}`,
      type: 'PRODUCT',
      label: product.name,
      sublabel: `${product.code} — ${product.group || 'N/A'}`,
      status: product.status === 'ACTIVE' ? 'OK' : product.status === 'RECALLED' ? 'FAIL' : 'WARNING',
      isKeyNode: true,
      details: {
        'Tên sản phẩm': product.name,
        'Mã sản phẩm': product.code,
        'Nhóm': product.group || 'N/A',
        'SĐK': product.registrationNo || 'N/A',
        'Trạng thái': product.status,
        'Đơn vị đăng ký': product.registrant || undefined,
      },
      navigationPath: `/products/${product.id}`,
      badges: product.status === 'ACTIVE' ? [{ text: 'ĐANG SX', color: 'green' }] :
               product.status === 'RECALLED' ? [{ text: 'THU HỒI', color: 'red' }] :
               [{ text: 'NGỪNG SX', color: 'gray' }],
      children,
    };
  } else {
    missingLinks.push('Không tìm thấy thông tin sản phẩm');
    riskReasons.push('Mất liên kết với hồ sơ sản phẩm');
  }

  // ── Kết nối cây ──
  if (productNode) batchNode.children!.push(productNode);
  batchNode.children!.push(...testResultNodes);
  batchNode.children!.push(decisionNode);

  // ── Tính Traceability Score ──
  let score = 0;
  if (product) score += 20;
  if (tccs) score += 20;
  if (formula) score += 20;
  if (testResults.length > 0) score += 25;
  if (batch.status === 'RELEASED' || batch.status === 'REJECTED') score += 15;
  // Trừ điểm nếu thiếu liên kết
  score -= missingLinks.length * 5;
  score = Math.max(0, Math.min(100, score));

  // ── Đánh giá rủi ro tổng thể ──
  let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskReasons.length >= 3 || batch.status === 'REJECTED') overallRisk = 'HIGH';
  else if (riskReasons.length >= 1 || missingLinks.length >= 2) overallRisk = 'MEDIUM';

  const summary = overallRisk === 'LOW'
    ? `✅ Lô ${batch.batchNo} có chuỗi truy vết đầy đủ. Traceability Score: ${score}/100.`
    : overallRisk === 'MEDIUM'
      ? `⚠️ Lô ${batch.batchNo} có ${missingLinks.length} liên kết dữ liệu thiếu. Cần bổ sung để hoàn thiện hồ sơ.`
      : `🔴 Lô ${batch.batchNo} có vấn đề nghiêm trọng trong chuỗi truy vết. Cần điều tra ngay.`;

  return {
    generatedAt: now,
    batchId: batch.id,
    batchNo: batch.batchNo,
    productName: product?.name || 'N/A',
    overallRisk,
    riskReasons,
    tree: batchNode,
    traceabilityScore: score,
    missingLinks,
    summary,
  };
};
