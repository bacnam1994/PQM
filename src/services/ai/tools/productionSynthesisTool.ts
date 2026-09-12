const formatDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

/**
 * Lập báo cáo tổng hợp chất lượng theo ngày sản xuất
 */
export const generateProductionSynthesisReport = (
  productId: string, 
  startDate: string | undefined, 
  endDate: string | undefined, 
  appContext: any
) => {
  const products = appContext.products || [];
  const batches = appContext.batches || [];
  const tccsList = appContext.tccsList || [];
  const productFormulas = appContext.productFormulas || [];
  const testResults = appContext.testResults || [];

  const product = products.find((p: any) => p.id === productId);
  if (!product) {
    return { error: `Không tìm thấy sản phẩm có ID: ${productId}` };
  }

  const pTccs = tccsList.filter((t: any) => t.productId === productId);
  const activeTccs = pTccs.find((t: any) => t.isActive) || [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  if (!activeTccs) {
    return { error: `Sản phẩm ${product.name} chưa cấu hình tiêu chuẩn cơ sở (TCCS).` };
  }

  const mainCriteria = activeTccs.mainQualityCriteria || [];
  const formula = productFormulas.find((f: any) => f.productId === productId);

  let filteredBatches = batches.filter((b: any) => b.productId === productId);
  if (startDate) {
    const startStr = startDate.includes('/') ? startDate.split('/').reverse().join('-') : startDate;
    filteredBatches = filteredBatches.filter((b: any) => b.mfgDate && b.mfgDate >= startStr);
  }
  if (endDate) {
    const endStr = endDate.includes('/') ? endDate.split('/').reverse().join('-') : endDate;
    filteredBatches = filteredBatches.filter((b: any) => b.mfgDate && b.mfgDate <= endStr);
  }

  filteredBatches.sort((a: any, b: any) => (a.mfgDate || '').localeCompare(b.mfgDate || ''));

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    const str = String(val).trim().replace(/[–—]/g, '-').replace(/,/g, '');
    const match = str.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
  };

  const rows = filteredBatches.map((batch: any) => {
    const batchResults = testResults.filter((r: any) => r.batchId === batch.id);
    
    const consolidatedMap = new Map<string, any>();
    [...batchResults]
      .sort((a, b) => a.testDate.localeCompare(b.testDate))
      .forEach(r => {
        (r.results || []).forEach((entry: any) => {
          if (entry && entry.criteriaName) {
            consolidatedMap.set(entry.criteriaName.trim().toLowerCase(), entry);
          }
        });
      });

    let overallStatus = 'PENDING';
    if (batchResults.length > 0) {
      const latestResult = [...batchResults].sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
      overallStatus = latestResult.overallStatus;
    }

    const criteriaData: Record<string, string> = {};
    mainCriteria.forEach((criterion: any) => {
      const key = criterion.name.trim().toLowerCase();
      const entry = consolidatedMap.get(key);
      
      if (!entry || entry.value === undefined || entry.value === null || String(entry.value).trim() === '') {
        criteriaData[criterion.name] = '---';
        return;
      }

      const valText = String(entry.value).trim();
      if (valText === 'Miễn kiểm' || valText.includes('Đạt')) {
        criteriaData[criterion.name] = valText;
        return;
      }

      let basis: number | undefined = undefined;
      if (criterion.declaredContent != null && criterion.declaredContent !== '') {
        basis = typeof criterion.declaredContent === 'string' ? parseNumber(criterion.declaredContent) : Number(criterion.declaredContent);
      } else if (formula) {
        let formulaItem = formula.ingredients?.find((i: any) => i.name.trim().toLowerCase() === key) ||
                          formula.excipients?.find((e: any) => e.name.trim().toLowerCase() === key);
        if (criterion.formulaIngredientId) {
          const linkedName = criterion.formulaIngredientId.trim().toLowerCase();
          const linkedItem = formula.ingredients?.find((i: any) => i.name.trim().toLowerCase() === linkedName) ||
                             formula.excipients?.find((e: any) => e.name.trim().toLowerCase() === linkedName);
          if (linkedItem) formulaItem = linkedItem;
        }

        if (formulaItem) {
          const dc = typeof formulaItem.declaredContent === 'string' ? parseNumber(formulaItem.declaredContent) : formulaItem.declaredContent;
          const ec = formulaItem.elementalContent != null ? (typeof formulaItem.elementalContent === 'string' ? parseNumber(formulaItem.elementalContent) : formulaItem.elementalContent) : undefined;
          if (criterion.calculationBasis === 'ELEMENTAL' && ec != null && ec > 0) basis = ec;
          else basis = dc;
        }
      }

      const actualVal = parseNumber(valText);
      if (!isNaN(actualVal) && basis && basis > 0 && actualVal > 0) {
        const percent = (actualVal / basis) * 100;
        criteriaData[criterion.name] = `${valText} (${percent.toFixed(1)}%)`;
      } else {
        criteriaData[criterion.name] = valText;
      }
    });

    return {
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expDate: batch.expDate,
      overallStatus: overallStatus === 'PASS' ? 'ĐẠT' : overallStatus === 'FAIL' ? 'KHÔNG ĐẠT' : 'CHƯA HOÀN THIỆN',
      criteria: criteriaData
    };
  });

  return {
    productName: product.name,
    productCode: product.code,
    tccsCode: activeTccs.code,
    totalBatches: rows.length,
    batches: rows,
    mainCriteria: mainCriteria.map((c: any) => c.name)
  };
};

/**
 * Wrapper xử lý trả về kết quả định dạng markdown cho Gemini
 */
export const handleProductionSynthesisReport = (args: any, appContext: any) => {
  try {
    const result = generateProductionSynthesisReport(args.productId, args.startDate, args.endDate, appContext);
    if (result.error) {
      return { error: result.error };
    }
    
    // Build markdown summary for the chatbot
    const markdownHeaders = ['Số Lô', 'Ngày SX', 'Hạn dùng', ...result.mainCriteria, 'Kết luận'];
    const mdHeaderRow = `| ${markdownHeaders.join(' | ')} |`;
    const mdDividerRow = `| ${markdownHeaders.map(() => '---').join(' | ')} |`;
    const mdDataRows = result.batches.map((b: any) => {
      const criteriaVals = result.mainCriteria.map((cName: string) => b.criteria[cName] || '---');
      return `| ${b.batchNo} | ${formatDate(b.mfgDate)} | ${formatDate(b.expDate)} | ${criteriaVals.join(' | ')} | **${b.overallStatus}** |`;
    }).join('\n');

    const tableMarkdown = `${mdHeaderRow}\n${mdDividerRow}\n${mdDataRows}`;
    
    return {
      success: true,
      productName: result.productName,
      productCode: result.productCode,
      tccsCode: result.tccsCode,
      totalBatches: result.totalBatches,
      message: `### Báo cáo tổng hợp chất lượng: **${result.productName} (${result.productCode})**\n- Tiêu chuẩn cơ sở: **${result.tccsCode}**\n- Tổng số lô sản xuất: **${result.totalBatches}**\n\n${tableMarkdown}\n\n*Bạn có thể xem chi tiết biểu đồ xu hướng và xuất file Excel đầy đủ tại trang [Báo cáo tổng hợp chất lượng](/quality-summary-report).*`,
      action: 'REDIRECT',
      path: '/quality-summary-report'
    };
  } catch (e: any) {
    return { error: e.message };
  }
};
