import { Criterion, TestResultEntry, AILearnedMapping } from '../types';

/**
 * Từ điển thuật ngữ dược khoa Anh-Việt và các tên tương đương.
 * Key = tên chuẩn trong hệ thống (tiếng Việt).
 * Value = mảng các tên tương đương có thể xuất hiện trong phiếu kiểm nghiệm.
 *
 * Nguồn: Dược điển Việt Nam V, USP, BP và thực tế kiểm nghiệm.
 */
export const PHARMA_TERM_DICTIONARY: Record<string, string[]> = {
  // === Lý hóa ===
  'Độ ẩm': [
    'lod', 'loss on drying', 'loss on drying (lod)', 'moisture', 'moisture content',
    'water content', 'ham luong nuoc', 'do am', 'hàm lượng nước', 'water',
    'moisture and volatile matter', 'loss on drying (%)', 'water activity', 'aw'
  ],
  'Định lượng': [
    'assay', 'purity', 'potency', 'active content', 'active ingredient content',
    'dinh luong', 'định lượng', 'label claim', 'active substance content', 'drug content'
  ],
  'Độ pH': [
    'ph', 'ph value', 'hydrogen ion concentration', 'do ph', 'ph (20°c)', 'ph (25°c)',
    'ph measurement', 'reaction of solution'
  ],
  'Tạp chất': [
    'impurities', 'related substances', 'tap chat', 'tạp chất liên quan',
    'related compounds', 'degradation products', 'individual impurity', 'total impurities',
    'rs', 'unknown impurity', 'specified impurity', 'unspecified impurity',
    'organic impurities', 'known impurity'
  ],
  'Tạp chất liên quan': [
    'related substances', 'rs', 'related compounds', 'organic impurities',
    'specified impurity', 'unspecified impurity'
  ],
  'Cảm quan': [
    'appearance', 'description', 'cam quan', 'visual inspection', 'organoleptic',
    'hinh thuc', 'hình thức', 'mau sac', 'màu sắc', 'mau', 'thể chất',
    'colour', 'color', 'odour', 'odor', 'taste', 'clarity', 'clarity of solution'
  ],
  'Độ tan rã': [
    'disintegration', 'disintegration time', 'tan ra', 'thoi gian tan ra',
    'thời gian tan rã', 'rã viên', 'do tan ra', 'dt', 'disintegration test'
  ],
  'Độ hòa tan': [
    'dissolution', 'dissolution test', 'do hoa tan', 'độ hòa tan', 'hoa tan',
    'dissolution rate', 'in-vitro dissolution', 'release', 'drug release'
  ],
  'Độ đồng đều khối lượng': [
    'uniformity of mass', 'weight variation', 'mass variation', 'do dong deu khoi luong',
    'uniformity of weight', 'khối lượng trung bình', 'klvien', 'kl viên',
    'average weight', 'tablet weight', 'weight uniformity'
  ],
  'Độ cứng': [
    'hardness', 'tablet hardness', 'do cung', 'crushing strength', 'breaking force',
    'tensile strength', 'fracture force'
  ],
  'Độ mài mòn': [
    'friability', 'tablet friability', 'do mai mon', 'abrasion', 'attrition'
  ],
  'Tỷ trọng': [
    'density', 'relative density', 'specific gravity', 'ty trong', 'd20', 'd25',
    'bulk density', 'tapped density'
  ],
  'Độ nhớt': [
    'viscosity', 'kinematic viscosity', 'do nhot', 'apparent viscosity',
    'dynamic viscosity', 'brookfield viscosity'
  ],
  'Góc quay cực': [
    'optical rotation', 'specific optical rotation', 'goc quay cuc',
    'polarimetry', '[α]', 'specific rotation'
  ],
  'Chỉ số acid': [
    'acid value', 'acid number', 'chi so acid', 'acidity', 'free fatty acid'
  ],
  'Chỉ số iod': [
    'iodine value', 'iodine number', 'chi so iod', 'iodine absorption'
  ],
  'Chỉ số xà phòng': [
    'saponification value', 'saponification number', 'chi so xa phong'
  ],
  'Tro sulfat': [
    'sulfated ash', 'sulphated ash', 'residue on ignition', 'tro sulfat',
    'ash', 'total ash', 'acid insoluble ash'
  ],
  'Cỡ hạt': [
    'particle size', 'particle size distribution', 'co hat', 'kich thuoc hat',
    'd50', 'd90', 'd10', 'mean particle size', 'psd'
  ],
  'Độ thấm': [
    'permeability', 'do tham', 'membrane permeability'
  ],
  'Điểm chảy': [
    'melting point', 'melting range', 'diem chay', 'mp', 'softening point'
  ],
  'Điểm sôi': [
    'boiling point', 'bp', 'diem soi'
  ],
  'Hàm lượng nước (Karl Fischer)': [
    'water content kf', 'karl fischer', 'water determination', 'kf titration',
    'moisture (karl fischer)', 'water (kf)'
  ],
  'Độ hấp thụ quang': [
    'absorbance', 'optical density', 'od', 'uv absorbance', 'absorption',
    'a (1%, 1cm)', 'e (1%, 1cm)', 'specific absorbance'
  ],
  'Độ trong suốt': [
    'clarity', 'clarity of solution', 'do trong', 'transparency', 'turbidity',
    'opalescence', 'appearance of solution'
  ],
  'Màu sắc dung dịch': [
    'colour of solution', 'color of solution', 'mau sac dung dich',
    'degree of coloration', 'solution colour'
  ],
  'Tổng hàm lượng tạp chất': [
    'total impurities', 'total related substances', 'tong tap chat',
    'sum of impurities', 'total organic impurities'
  ],

  // === Định lượng hoạt chất cụ thể ===
  'Paracetamol': ['paracetamol', 'acetaminophen', 'pcm', 'apap'],
  'Ibuprofen': ['ibuprofen', 'ibuprofene'],
  'Amoxicillin': ['amoxicillin', 'amoxycillin', 'amox'],
  'Cetirizine': ['cetirizine', 'cetirizine hydrochloride', 'cetirizin'],
  'Omeprazole': ['omeprazole', 'omeprazol'],
  'Metformin': ['metformin', 'metformin hydrochloride', 'metformine'],
  'Vitamin C': ['vitamin c', 'ascorbic acid', 'l-ascorbic acid', 'ascorbate'],
  'Vitamin B1': ['vitamin b1', 'thiamine', 'thiamin', 'thiamine hydrochloride', 'aneurine'],
  'Vitamin B2': ['vitamin b2', 'riboflavin', 'lactoflavin'],
  'Vitamin B3': ['vitamin b3', 'niacin', 'nicotinic acid', 'nicotinamide', 'niacinamide'],
  'Vitamin B5': ['vitamin b5', 'pantothenic acid', 'calcium pantothenate', 'd-panthenol'],
  'Vitamin B6': ['vitamin b6', 'pyridoxine', 'pyridoxine hydrochloride'],
  'Vitamin B9': ['vitamin b9', 'folic acid', 'folate', 'folacin'],
  'Vitamin B12': ['vitamin b12', 'cyanocobalamin', 'cobalamin', 'methylcobalamin'],
  'Vitamin D3': ['vitamin d3', 'cholecalciferol', 'colecalciferol'],
  'Vitamin E': ['vitamin e', 'tocopherol', 'alpha-tocopherol', 'd-alpha tocopherol'],
  'Vitamin K': ['vitamin k', 'vitamin k1', 'phylloquinone', 'phytomenadione'],
  // === Định lượng khoáng chất & dạng muối tương ứng ===
  'Kẽm': [
    'kẽm', 'zinc', 'zn', 'kẽm (zn)', 'zinc (zn)', 'hàm lượng kẽm', 'định lượng kẽm',
    'kẽm gluconat', 'zinc gluconate', 'kẽm sulfat', 'zinc sulfate', 'kẽm acetat', 'zinc acetate',
    'kẽm oxyd', 'zinc oxide', 'kẽm picolinat', 'zinc picolinate', 'kẽm bisglycinat'
  ],
  'Sắt': [
    'sắt', 'iron', 'fe', 'sắt (fe)', 'iron (fe)', 'hàm lượng sắt', 'định lượng sắt',
    'sắt fumarat', 'ferrous fumarate', 'sắt sulfat', 'ferrous sulfate', 'sắt gluconat', 'ferrous gluconate',
    'sắt bisglycinat', 'ferrous bisglycinate', 'iron polymaltose', 'ipc'
  ],
  'Magie': [
    'magie', 'magnesi', 'magnesium', 'mg', 'magie (mg)', 'magnesi (mg)', 'magnesium (mg)',
    'magnesi lactat', 'magnesium lactate', 'magnesi oxyd', 'magnesium oxide',
    'magnesi citrat', 'magnesium citrate', 'magnesi stearat', 'magnesium stearate'
  ],
  'Canxi': [
    'canxi', 'calci', 'calcium', 'ca', 'canxi (ca)', 'calci (ca)', 'calcium (ca)',
    'canxi carbonat', 'calcium carbonate', 'calci gluconat', 'calcium gluconate',
    'calci glucoheptonat', 'calcium glucoheptonate', 'calci citrat', 'calcium citrate',
    'canxi nano', 'calcium nano', 'tricalcium phosphate'
  ],
  'Đồng': [
    'đồng', 'copper', 'cu', 'đồng (cu)', 'copper (cu)', 'đồng sulfat', 'copper sulfate', 'cupric sulfate'
  ],
  'Mangan': [
    'mangan', 'manganese', 'mn', 'mangan (mn)', 'manganese (mn)', 'mangan sulfat', 'manganese sulfate', 'mangan gluconat'
  ],
  'Selen': [
    'selen', 'selenium', 'se', 'selen (se)', 'selenium (se)', 'sodium selenite', 'selenomethionine', 'men selen', 'selenium yeast'
  ],
  'Iod': [
    'iod', 'iốt', 'iodine', 'i', 'iod (i)', 'potassium iodide', 'kali iodid', 'ki'
  ],
  'Kali': [
    'kali', 'potassium', 'k', 'kali (k)', 'potassium (k)', 'kali clorid', 'potassium chloride', 'kcl'
  ],
  'Natri': [
    'natri', 'sodium', 'na', 'natri (na)', 'sodium (na)', 'natri clorid', 'sodium chloride', 'nacl'
  ],

  // === Vi sinh vật & Men vi sinh (Probiotics) ===
  'Tổng số lợi khuẩn Bacillus': [
    'probiotics',
    'probiotic',
    'probiotics (lactobacillus sporogenes, bacillus clausii, bacillus subtilis)',
    'probiotics (bacillus clausii, bacillus subtilis)',
    'bacillus clausii',
    'bacillus subtilis',
    'bacillus sporogenes',
    'lactobacillus sporogenes',
    'bào tử lợi khuẩn',
    'bào tử bacillus',
    'lợi khuẩn bacillus',
    'tổng số bào tử bacillus',
    'tổng số bào tử lợi khuẩn',
    'tổng số bào tử lợi khuẩn bacillus',
    'tổng số lợi khuẩn',
    'tổng số lợi khuẩn bacillus',
    'tong so loi khuan bacillus',
    'tong so bao tu bacillus',
    'bacillus spp',
    'bacillus spp.',
    'bacillus count',
    'probiotics count',
    'spore count',
    'men vi sinh'
  ],
  'Tổng số vi khuẩn hiếu khí': [
    'tổng vi khuẩn hiếu khí', 'tvkhk', 'aerobic microbial count', 'total aerobic microbial count',
    'total viable count', 'tvc', 'total plate count', 'tpc', 'aerobic plate count', 'apc',
    'total bacteria count', 'tamc', 'tam', 'tổng số vi sinh vật hiếu khí', 'tsvsv',
    'mesophilic aerobic bacteria', 'bacterial count'
  ],
  'Tổng số nấm mốc và nấm men': [
    'nấm mốc nấm men', 'tsnm', 'yeast and mould', 'yeast & mould', 'fungi',
    'mold and yeast', 'total combined yeast and mould count', 'tymc', 'tymcl',
    'nấm mốc', 'nấm men', 'yeast mold count', 'yeasts and moulds', 'fungal count'
  ],
  'Lactobacillus': [
    'lactobacillus', 'lactobacillus acidophilus', 'l. acidophilus', 'lactobacillus plantarum',
    'l. plantarum', 'lactobacillus rhamnosus', 'l. rhamnosus', 'lactobacillus reuteri',
    'l. reuteri', 'lactobacillus casei', 'l. casei'
  ],
  'Bifidobacterium': [
    'bifidobacterium', 'bifidobacterium animalis', 'bifidobacterium lactis',
    'bifidobacterium longum', 'bifidobacterium bifidum', 'b. lactis', 'b. longum', 'b. bifidum'
  ],
  'Saccharomyces boulardii': [
    'saccharomyces boulardii', 's. boulardii', 'saccharomyces', 'men saccharomyces'
  ],
  'E. coli': ['e.coli', 'e. coli', 'escherichia coli', 'coliform', 'coliforms', 'faecal coliforms'],
  'Salmonella': ['salmonella', 'salmonella spp', 'salmonella spp.', 'salmonella species'],
  'Staphylococcus aureus': [
    'staphylococcus aureus', 's. aureus', 'staph aureus', 'staphylococci',
    'coagulase positive staphylococci'
  ],
  'Pseudomonas aeruginosa': [
    'pseudomonas aeruginosa', 'p. aeruginosa', 'pseudomonas'
  ],
  'Clostridium': ['clostridium', 'clostridia', 'clostridium spp'],
  'Candida albicans': ['candida', 'candida albicans', 'c. albicans'],

  // === Kim loại nặng ===
  'Asen': ['asen', 'arsenic', 'as', 'as (arsenic)', 'arsen', 'arsenic (as)', 'total arsenic'],
  'Chì': ['chì', 'lead', 'pb', 'lead (pb)', 'pb (lead)', 'chi (pb)', 'total lead'],
  'Thủy ngân': ['thủy ngân', 'mercury', 'hg', 'mercury (hg)', 'hg (mercury)', 'thuy ngan', 'total mercury'],
  'Cadmi': ['cadmi', 'cadmium', 'cd', 'cadmium (cd)', 'cd (cadmium)', 'cadimi', 'total cadmium'],
  'Kim loại nặng': ['heavy metals', 'kim loai nang', 'heavy metal total', 'total heavy metals'],
  'Krom': ['chromium', 'cr', 'chrome'],
  'Niken': ['nickel', 'ni'],
};

/**
 * Bảng chuẩn hóa đơn vị đo lường trong kiểm nghiệm dược phẩm.
 * Key = đơn vị gốc (đã normalize thành lowercase, không dấu).
 * Value = đơn vị chuẩn trả về.
 */
const UNIT_NORMALIZATION_MAP: Record<string, string> = {
  // Đơn vị phần triệu
  'ppm': 'ppm',
  'mg/kg': 'ppm',
  'mgg': 'ppm',        // mg/g → đôi khi viết liền
  'ug/g': 'ppm',
  'mcg/g': 'ppm',
  'µg/g': 'ppm',
  'microg/g': 'ppm',
  // Đơn vị phần tỷ
  'ppb': 'ppb',
  'ug/kg': 'ppb',
  'mcg/kg': 'ppb',
  'µg/kg': 'ppb',
  // Vi sinh vật
  'cfu/g': 'CFU/g',
  'cfu/ml': 'CFU/mL',
  'cfu/g (kl/g)': 'CFU/g',
  'kl/g': 'CFU/g',
  'cfug': 'CFU/g',
  'cfu': 'CFU/g',
  // Phần trăm
  'g/100g': '%',
  'g/100ml': '% (w/v)',
  'w/w': '% (w/w)',
  'ww': '% (w/w)',
  // Gram
  'gam': 'g',
  'gram': 'g',
  // Milli
  'milligam': 'mg',
  'milligram': 'mg',
  // Micro
  'microgram': 'µg',
  'mcg': 'µg',
};

/**
 * Chuẩn hóa đơn vị đo lường về dạng chuẩn.
 * Ví dụ: 'mg/kg' → 'ppm', 'cfu/g' → 'CFU/g', 'µg/g' → 'ppm'
 */
export const normalizeUnit = (unit: string): string => {
  if (!unit) return unit;
  // Normalize để tra cứu: bỏ dấu cách, ký tự đặc biệt, lowercase
  const cleaned = unit
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/μ/g, 'µ')  // normalize micro ký tự khác nhau
    .replace(/×/g, 'x');
  return UNIT_NORMALIZATION_MAP[cleaned] ?? unit;
};

/**
 * Chuẩn hóa chuỗi: loại bỏ dấu tiếng Việt, ký tự đặc biệt, và chuyển thành chữ thường.
 */
export const normalizeString = (str: string) => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "") // Bỏ cả khoảng trắng và dấu câu để so khớp chặt hơn
    .trim();
};

/**
 * Tra cứu thuật ngữ trong PHARMA_TERM_DICTIONARY.
 * Trả về tên chuẩn trong hệ thống nếu tìm thấy, hoặc null nếu không.
 * Ưu tiên: Khớp chính xác 100% → Khớp chuỗi dài nhất (Longest Substring Match).
 */
export const lookupPharmaTerm = (aiName: string): string | null => {
  const normAi = normalizeString(aiName);
  if (!normAi) return null;

  // 1. Ưu tiên khớp chính xác tuyệt đối trước
  for (const [systemName, aliases] of Object.entries(PHARMA_TERM_DICTIONARY)) {
    const normSystem = normalizeString(systemName);
    if (normSystem === normAi) return systemName;
    for (const alias of aliases) {
      if (normalizeString(alias) === normAi) return systemName;
    }
  }

  // 2. Khớp bao hàm: Tìm ứng viên có độ dài chuỗi khớp dài nhất (Longest Substring Match)
  // để tránh các từ ngắn (như 'iot' dài 3 ký tự) vô tình bắt nhầm từ dài (như 'probiotics')
  let bestMatch: { systemName: string; matchLength: number } | null = null;

  for (const [systemName, aliases] of Object.entries(PHARMA_TERM_DICTIONARY)) {
    const normSystem = normalizeString(systemName);
    if (normSystem.length >= 3 && normAi.includes(normSystem)) {
      if (!bestMatch || normSystem.length > bestMatch.matchLength) {
        bestMatch = { systemName, matchLength: normSystem.length };
      }
    }

    for (const alias of aliases) {
      const normAlias = normalizeString(alias);
      if (!normAlias || normAlias.length < 3) continue;
      if (normAi.includes(normAlias)) {
        if (!bestMatch || normAlias.length > bestMatch.matchLength) {
          bestMatch = { systemName, matchLength: normAlias.length };
        }
      }
    }
  }

  return bestMatch ? bestMatch.systemName : null;
};

/**
 * Kiểm tra mức độ tương đồng giữa 2 chuỗi tên chỉ tiêu.
 * Thứ tự ưu tiên: Learned Mappings → Pharma Dictionary → Fuzzy String Match
 */
export const isCriteriaMatch = (
  aiCriteriaName: string,
  systemCriteriaName: string,
  learnedMappings: AILearnedMapping[] = []
) => {
  // 1. Ưu tiên kiểm tra trong cơ sở dữ liệu đã học (Learned Mappings)
  const relevantMappings = learnedMappings
    .filter(m => m.systemName === systemCriteriaName)
    .sort((a, b) => b.frequency - a.frequency);

  for (const mapping of relevantMappings) {
    if (normalizeString(aiCriteriaName) === normalizeString(mapping.originalName)) {
      return true;
    }
  }

  // 2. Tra cứu từ điển thuật ngữ dược khoa (Song phương)
  const dictAi = lookupPharmaTerm(aiCriteriaName);
  const dictSystem = lookupPharmaTerm(systemCriteriaName);

  // 2.1. Cả 2 bên đều quy về cùng một nhóm hoạt chất / nguyên tố trong từ điển (Ví dụ: "Hàm lượng Kẽm (Zn)" và "Kẽm (Kẽm gluconat)")
  if (dictAi && dictSystem && dictAi === dictSystem) {
    return true;
  }

  // 2.2. Nhóm từ điển của AI trùng với tên hệ thống hoặc nằm trong tên hệ thống
  if (dictAi) {
    const normDictAi = normalizeString(dictAi);
    const normSystem = normalizeString(systemCriteriaName);
    if (normDictAi === normSystem || (normDictAi.length >= 3 && normSystem.includes(normDictAi))) {
      return true;
    }
  }

  // 2.3. Nhóm từ điển của System chứa trong AI name
  if (dictSystem) {
    const normDictSystem = normalizeString(dictSystem);
    const normAI = normalizeString(aiCriteriaName);
    if (normDictSystem === normAI || (normDictSystem.length >= 3 && normAI.includes(normDictSystem))) {
      return true;
    }
  }

  // 3. Fallback về phương pháp so khớp chuỗi truyền thống
  const normAI = normalizeString(aiCriteriaName);
  const normSystem = normalizeString(systemCriteriaName);

  if (!normAI || !normSystem) return false;

  // Khớp chính xác
  if (normAI === normSystem) return true;

  // Khớp bao hàm (chứa nhau) — chỉ áp dụng khi chuỗi đủ dài để tránh false positive
  if (normAI.length >= 4 && normSystem.length >= 4) {
    if (normAI.includes(normSystem) || normSystem.includes(normAI)) return true;
  }

  return false;
};

/**
 * Map dữ liệu AI trả về vào cấu trúc Criteria của TCCS.
 */
export const mapAIExtractedResultsToCriteria = (
  extractedResults: any[],
  tccsCriteria: Criterion[],
  learnedMappings: AILearnedMapping[] = []
): Partial<TestResultEntry>[] => {
  const mappedEntries: Partial<TestResultEntry>[] = [];
  const usedAiIndexes = new Set<number>();

  // Ưu tiên khớp các chỉ tiêu trong TCCS
  tccsCriteria.forEach(criterion => {
    // Tìm kết quả tốt nhất từ AI (có sử dụng learnedMappings + dictionary)
    const matchIndex = extractedResults.findIndex((aiRes, index) =>
      !usedAiIndexes.has(index) && isCriteriaMatch(aiRes.criteriaName, criterion.name, learnedMappings)
    );

    if (matchIndex !== -1) {
      const matchedResult = extractedResults[matchIndex];
      usedAiIndexes.add(matchIndex);

      mappedEntries.push({
        criteriaName: criterion.name, // Lấy tên chuẩn của hệ thống
        value: matchedResult.value,
        unit: normalizeUnit(matchedResult.unit || ''),  // Chuẩn hóa đơn vị
        limit: matchedResult.limit,
        // Trick để luân chuyển originalName cho TestResultForm
        ...({ aiOriginalName: matchedResult.criteriaName } as any)
      });
    }
  });

  return mappedEntries;
};
