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
    'lod',
    'loss on drying',
    'loss on drying (lod)',
    'moisture',
    'moisture content',
    'water content',
    'ham luong nuoc',
    'do am',
    'hàm lượng nước',
    'water',
    'moisture and volatile matter',
    'loss on drying (%)',
    'water activity',
    'aw',
  ],
  'Định lượng': [
    'assay',
    'purity',
    'potency',
    'active content',
    'active ingredient content',
    'dinh luong',
    'định lượng',
    'label claim',
    'active substance content',
    'drug content',
  ],
  'Độ pH': [
    'ph',
    'ph value',
    'hydrogen ion concentration',
    'do ph',
    'ph (20°c)',
    'ph (25°c)',
    'ph measurement',
    'reaction of solution',
  ],
  'Tạp chất': [
    'impurities',
    'related substances',
    'tap chat',
    'tạp chất liên quan',
    'related compounds',
    'degradation products',
    'individual impurity',
    'total impurities',
    'rs',
    'unknown impurity',
    'specified impurity',
    'unspecified impurity',
    'organic impurities',
    'known impurity',
  ],
  'Tạp chất liên quan': [
    'related substances',
    'rs',
    'related compounds',
    'organic impurities',
    'specified impurity',
    'unspecified impurity',
  ],
  'Cảm quan': [
    'appearance',
    'description',
    'cam quan',
    'visual inspection',
    'organoleptic',
    'hinh thuc',
    'hình thức',
    'mau sac',
    'màu sắc',
    'mau',
    'thể chất',
    'colour',
    'color',
    'odour',
    'odor',
    'taste',
    'clarity',
    'clarity of solution',
  ],
  'Độ tan rã': [
    'disintegration',
    'disintegration time',
    'tan ra',
    'thoi gian tan ra',
    'thời gian tan rã',
    'rã viên',
    'do tan ra',
    'dt',
    'disintegration test',
    'độ rã',
    'do ra',
  ],
  'Độ hòa tan': [
    'dissolution',
    'dissolution test',
    'do hoa tan',
    'độ hòa tan',
    'hoa tan',
    'dissolution rate',
    'in-vitro dissolution',
    'release',
    'drug release',
  ],
  'Độ đồng đều khối lượng': [
    'uniformity of mass',
    'weight variation',
    'mass variation',
    'do dong deu khoi luong',
    'uniformity of weight',
    'khối lượng trung bình',
    'klvien',
    'kl viên',
    'average weight',
    'tablet weight',
    'weight uniformity',
    'khối lượng gói',
    'khối lượng tịnh',
  ],
  'Độ đồng đều thể tích': [
    'uniformity of volume',
    'the tich thuc',
    'the tich',
    'thể tích thực',
    'do dong deu the tich',
    'volume variation',
    'net volume',
    'fill volume',
    'deliverable volume',
    'thể tích đóng lọ',
  ],
  'Chỉ số khúc xạ': [
    'refractive index',
    'chi so khuc xa',
    'nd20',
    'nd25',
    'index of refraction',
    'khúc xạ kế',
  ],
  'Tro toàn phần': ['total ash', 'tro toan phan', 'ash content', 'tro khoáng', 'hàm lượng tro'],
  'Tro không tan trong acid': [
    'acid-insoluble ash',
    'tro khong tan trong acid',
    'tro khong tan trong acid clohydric',
    'acid insoluble ash',
  ],
  'Cắn sau khi sấy khô': [
    'dry residue',
    'residue on evaporation',
    'can sau khi say kho',
    'can kho',
    'dry matter',
    'cắn bay hơi',
  ],
  'Giới hạn vi sinh vật': [
    'microbiological limit',
    'microbial limit',
    'gioi han vi sinh vat',
    'gioi han vi sinh',
    'vi sinh vat',
    'microbiological quality',
    'chỉ tiêu vi sinh',
  ],
  'Độ cứng': [
    'hardness',
    'tablet hardness',
    'do cung',
    'crushing strength',
    'breaking force',
    'tensile strength',
    'fracture force',
  ],
  'Độ mài mòn': ['friability', 'tablet friability', 'do mai mon', 'abrasion', 'attrition'],
  'Tỷ trọng': [
    'density',
    'relative density',
    'specific gravity',
    'ty trong',
    'd20',
    'd25',
    'bulk density',
    'tapped density',
  ],
  'Độ nhớt': [
    'viscosity',
    'kinematic viscosity',
    'do nhot',
    'apparent viscosity',
    'dynamic viscosity',
    'brookfield viscosity',
  ],
  'Góc quay cực': [
    'optical rotation',
    'specific optical rotation',
    'goc quay cuc',
    'polarimetry',
    '[α]',
    'specific rotation',
  ],
  'Chỉ số acid': ['acid value', 'acid number', 'chi so acid', 'acidity', 'free fatty acid'],
  'Chỉ số iod': ['iodine value', 'iodine number', 'chi so iod', 'iodine absorption'],
  'Chỉ số xà phòng': ['saponification value', 'saponification number', 'chi so xa phong'],
  'Tro sulfat': [
    'sulfated ash',
    'sulphated ash',
    'residue on ignition',
    'tro sulfat',
    'ash',
    'total ash',
    'acid insoluble ash',
  ],
  'Cỡ hạt': [
    'particle size',
    'particle size distribution',
    'co hat',
    'kich thuoc hat',
    'd50',
    'd90',
    'd10',
    'mean particle size',
    'psd',
  ],
  'Độ thấm': ['permeability', 'do tham', 'membrane permeability'],
  'Điểm chảy': ['melting point', 'melting range', 'diem chay', 'mp', 'softening point'],
  'Điểm sôi': ['boiling point', 'bp', 'diem soi'],
  'Hàm lượng nước (Karl Fischer)': [
    'water content kf',
    'karl fischer',
    'water determination',
    'kf titration',
    'moisture (karl fischer)',
    'water (kf)',
  ],
  'Độ hấp thụ quang': [
    'absorbance',
    'optical density',
    'od',
    'uv absorbance',
    'absorption',
    'a (1%, 1cm)',
    'e (1%, 1cm)',
    'specific absorbance',
  ],
  'Độ trong suốt': [
    'clarity',
    'clarity of solution',
    'do trong',
    'transparency',
    'turbidity',
    'opalescence',
    'appearance of solution',
  ],
  'Màu sắc dung dịch': [
    'colour of solution',
    'color of solution',
    'mau sac dung dich',
    'degree of coloration',
    'solution colour',
  ],
  'Tổng hàm lượng tạp chất': [
    'total impurities',
    'total related substances',
    'tong tap chat',
    'sum of impurities',
    'total organic impurities',
  ],

  // === Định lượng hoạt chất cụ thể ===
  Paracetamol: ['paracetamol', 'acetaminophen', 'pcm', 'apap'],
  Ibuprofen: ['ibuprofen', 'ibuprofene'],
  Amoxicillin: ['amoxicillin', 'amoxycillin', 'amox'],
  Cetirizine: ['cetirizine', 'cetirizine hydrochloride', 'cetirizin'],
  Omeprazole: ['omeprazole', 'omeprazol'],
  Metformin: ['metformin', 'metformin hydrochloride', 'metformine'],
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
  Kẽm: [
    'kẽm',
    'zinc',
    'zn',
    'kẽm (zn)',
    'zinc (zn)',
    'hàm lượng kẽm',
    'định lượng kẽm',
    'kẽm gluconat',
    'zinc gluconate',
    'kẽm sulfat',
    'zinc sulfate',
    'kẽm acetat',
    'zinc acetate',
    'kẽm oxyd',
    'zinc oxide',
    'kẽm picolinat',
    'zinc picolinate',
    'kẽm bisglycinat',
  ],
  Sắt: [
    'sắt',
    'iron',
    'fe',
    'sắt (fe)',
    'iron (fe)',
    'hàm lượng sắt',
    'định lượng sắt',
    'sắt fumarat',
    'ferrous fumarate',
    'sắt sulfat',
    'ferrous sulfate',
    'sắt gluconat',
    'ferrous gluconate',
    'sắt bisglycinat',
    'ferrous bisglycinate',
    'iron polymaltose',
    'ipc',
  ],
  Magie: [
    'magie',
    'magnesi',
    'magnesium',
    'mg',
    'magie (mg)',
    'magnesi (mg)',
    'magnesium (mg)',
    'magnesi lactat',
    'magnesium lactate',
    'magnesi oxyd',
    'magnesium oxide',
    'magnesi citrat',
    'magnesium citrate',
    'magnesi stearat',
    'magnesium stearate',
  ],
  Canxi: [
    'canxi',
    'calci',
    'calcium',
    'ca',
    'canxi (ca)',
    'calci (ca)',
    'calcium (ca)',
    'canxi carbonat',
    'calcium carbonate',
    'calci gluconat',
    'calcium gluconate',
    'calci glucoheptonat',
    'calcium glucoheptonate',
    'calci citrat',
    'calcium citrate',
    'canxi nano',
    'calcium nano',
    'tricalcium phosphate',
  ],
  Đồng: [
    'đồng',
    'copper',
    'cu',
    'đồng (cu)',
    'copper (cu)',
    'đồng sulfat',
    'copper sulfate',
    'cupric sulfate',
  ],
  Mangan: [
    'mangan',
    'manganese',
    'mn',
    'mangan (mn)',
    'manganese (mn)',
    'mangan sulfat',
    'manganese sulfate',
    'mangan gluconat',
  ],
  Selen: [
    'selen',
    'selenium',
    'se',
    'selen (se)',
    'selenium (se)',
    'sodium selenite',
    'selenomethionine',
    'men selen',
    'selenium yeast',
  ],
  Iod: ['iod', 'iốt', 'iodine', 'i', 'iod (i)', 'potassium iodide', 'kali iodid', 'ki'],
  Kali: [
    'kali',
    'potassium',
    'k',
    'kali (k)',
    'potassium (k)',
    'kali clorid',
    'potassium chloride',
    'kcl',
  ],
  Natri: [
    'natri',
    'sodium',
    'na',
    'natri (na)',
    'sodium (na)',
    'natri clorid',
    'sodium chloride',
    'nacl',
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
    'men vi sinh',
  ],
  'Tổng số vi khuẩn hiếu khí': [
    'tổng vi khuẩn hiếu khí',
    'tvkhk',
    'aerobic microbial count',
    'total aerobic microbial count',
    'total viable count',
    'tvc',
    'total plate count',
    'tpc',
    'aerobic plate count',
    'apc',
    'total bacteria count',
    'tamc',
    'tam',
    'tổng số vi sinh vật hiếu khí',
    'tsvsv',
    'mesophilic aerobic bacteria',
    'bacterial count',
  ],
  'Tổng số nấm mốc và nấm men': [
    'nấm mốc nấm men',
    'tsnm',
    'yeast and mould',
    'yeast & mould',
    'fungi',
    'mold and yeast',
    'total combined yeast and mould count',
    'tymc',
    'tymcl',
    'nấm mốc',
    'nấm men',
    'yeast mold count',
    'yeasts and moulds',
    'fungal count',
  ],
  Lactobacillus: [
    'lactobacillus',
    'lactobacillus acidophilus',
    'l. acidophilus',
    'lactobacillus plantarum',
    'l. plantarum',
    'lactobacillus rhamnosus',
    'l. rhamnosus',
    'lactobacillus reuteri',
    'l. reuteri',
    'lactobacillus casei',
    'l. casei',
  ],
  Bifidobacterium: [
    'bifidobacterium',
    'bifidobacterium animalis',
    'bifidobacterium lactis',
    'bifidobacterium longum',
    'bifidobacterium bifidum',
    'b. lactis',
    'b. longum',
    'b. bifidum',
  ],
  'Saccharomyces boulardii': [
    'saccharomyces boulardii',
    's. boulardii',
    'saccharomyces',
    'men saccharomyces',
  ],
  'E. coli': ['e.coli', 'e. coli', 'escherichia coli', 'coliform', 'coliforms', 'faecal coliforms'],
  Salmonella: ['salmonella', 'salmonella spp', 'salmonella spp.', 'salmonella species'],
  'Staphylococcus aureus': [
    'staphylococcus aureus',
    's. aureus',
    'staph aureus',
    'staphylococci',
    'coagulase positive staphylococci',
  ],
  'Pseudomonas aeruginosa': ['pseudomonas aeruginosa', 'p. aeruginosa', 'pseudomonas'],
  Clostridium: ['clostridium', 'clostridia', 'clostridium spp'],
  'Candida albicans': ['candida', 'candida albicans', 'c. albicans'],

  // === Kim loại nặng ===
  Asen: [
    'asen',
    'arsenic',
    'as',
    'as (arsenic)',
    'arsen',
    'arsenic (as)',
    'total arsenic',
    'asen tổng số',
    'arsen tổng số',
    'arsen (as) tổng số',
  ],
  'Asen vô cơ': [
    'asen vô cơ',
    'asen vo co',
    'arsen vô cơ',
    'arsen vo co',
    'inorganic arsenic',
    'inorganic as',
    'thạch tín vô cơ',
    'arsen (vô cơ)',
  ],
  Chì: ['chì', 'lead', 'pb', 'lead (pb)', 'pb (lead)', 'chi (pb)', 'total lead'],
  'Thủy ngân': [
    'thủy ngân',
    'mercury',
    'hg',
    'mercury (hg)',
    'hg (mercury)',
    'thuy ngan',
    'total mercury',
  ],
  Cadmi: ['cadmi', 'cadmium', 'cd', 'cadmium (cd)', 'cd (cadmium)', 'cadimi', 'total cadmium'],
  'Kim loại nặng': ['heavy metals', 'kim loai nang', 'heavy metal total', 'total heavy metals'],
  Krom: ['chromium', 'cr', 'chrome'],
  Niken: ['nickel', 'ni'],

  // === Amino acids (Axêt amin) ===
  'L-Lysine': [
    'l-lysine',
    'lysine',
    'l-lysine hcl',
    'l-lysine hydrochloride',
    'lysine hcl',
    'lysine hydrochloride',
    'l-lysine monohydrochloride',
    'lysine monohydrochloride',
    'l-lysin',
    'lysin hcl',
    'lysin hydrochloride',
  ],
  'L-Methionine': ['l-methionine', 'methionine', 'dl-methionine', 'l-metionin', 'metionin'],
  'L-Threonine': ['l-threonine', 'threonine', 'l-threonin', 'threonin'],
  'L-Tryptophan': ['l-tryptophan', 'tryptophan', 'l-tryptofan', 'tryptofan'],
  'L-Valine': ['l-valine', 'valine', 'l-valin', 'valin'],
  'L-Leucine': ['l-leucine', 'leucine', 'l-leucin', 'leucin'],
  'L-Isoleucine': ['l-isoleucine', 'isoleucine', 'l-isoleusin', 'isoleusin'],
  'L-Phenylalanine': ['l-phenylalanine', 'phenylalanine', 'l-phenylalanil', 'phenylalanil'],
  'L-Arginine': [
    'l-arginine',
    'arginine',
    'l-arginin',
    'arginin',
    'l-arginine hcl',
    'arginine hydrochloride',
    'l-arginine hydrochloride',
  ],
  'L-Glutamine': ['l-glutamine', 'glutamine', 'l-glutamin', 'glutamin'],
  'L-Cysteine': [
    'l-cysteine',
    'cysteine',
    'l-cystin',
    'cystine',
    'l-cysteine hcl',
    'cysteine hydrochloride',
    'n-acetyl cysteine',
    'nac',
  ],
  'L-Tyrosine': ['l-tyrosine', 'tyrosine', 'l-tyrosin', 'tyrosin'],
  'L-Histidine': [
    'l-histidine',
    'histidine',
    'l-histidin',
    'histidin',
    'l-histidine hcl',
    'histidine hydrochloride',
  ],
  Glycine: ['glycine', 'gly', 'glycin', 'aminoacetic acid'],
  'L-Proline': ['l-proline', 'proline', 'l-prolin', 'prolin'],
  'L-Serine': ['l-serine', 'serine', 'l-serin', 'serin'],
  'L-Alanine': ['l-alanine', 'alanine', 'l-alanin', 'alanin', 'beta-alanine', 'beta-alanin'],
  'L-Aspartic acid': ['l-aspartic acid', 'aspartic acid', 'l-aspartate', 'aspartate'],
  'L-Glutamic acid': ['l-glutamic acid', 'glutamic acid', 'l-glutamate', 'glutamate'],
  BCAA: ['bcaa', 'branched chain amino acids', 'amino acid'],

  // === Hoạt chất supplement phổ biến ===
  'L-Carnitine': [
    'l-carnitine',
    'carnitine',
    'l-carnitin',
    'carnitin',
    'l-carnitine tartrate',
    'acetyl-l-carnitine',
    'alcar',
    'l-carnitine l-tartrate',
    'carnitine tartrate',
  ],
  Taurine: ['taurine', 'taurin', 'tau', '2-aminoethanesulfonic acid'],
  'Coenzyme Q10': [
    'coenzyme q10',
    'coq10',
    'ubiquinone',
    'ubiquinol',
    'co q10',
    'coq-10',
    'ubidecarenone',
    'co-enzyme q10',
  ],
  Collagen: [
    'collagen',
    'collagen peptide',
    'hydrolyzed collagen',
    'fish collagen',
    'marine collagen',
    'bovine collagen',
    'collagen type i',
    'collagen type ii',
    'collagen type iii',
    'collagen hydrolysate',
    'collagen peptides',
  ],
  Glucosamine: [
    'glucosamine',
    'glucosamine hcl',
    'glucosamine hydrochloride',
    'glucosamine sulfate',
    'n-acetyl glucosamine',
  ],
  Chondroitin: ['chondroitin', 'chondroitin sulfate', 'chondroitin sulphate'],
  'Hyaluronic acid': [
    'hyaluronic acid',
    'hyaluronate',
    'sodium hyaluronate',
    'ha',
    'axit hyaluronic',
    'acid hyaluronic',
  ],
  Lutein: ['lutein', 'lutein ester', 'zeaxanthin', 'marigold extract'],
  Lycopene: ['lycopene', 'lycopen'],
  Resveratrol: ['resveratrol', 'trans-resveratrol'],
  Curcumin: ['curcumin', 'curcuminoid', 'turmeric extract', 'diferuloylmethane'],
  'Omega-3': [
    'omega-3',
    'omega 3',
    'dha',
    'epa',
    'dha+epa',
    'fish oil',
    'docosahexaenoic acid',
    'eicosapentaenoic acid',
    'omega-3 fatty acids',
  ],
  DHA: ['dha', 'docosahexaenoic acid', 'dha (docosahexaenoic acid)'],
  EPA: ['epa', 'eicosapentaenoic acid', 'epa (eicosapentaenoic acid)'],
  Inositol: ['inositol', 'myo-inositol', 'd-chiro-inositol'],
  Choline: ['choline', 'choline bitartrate', 'choline chloride', 'alpha-gpc'],
  Biotin: ['biotin', 'vitamin b7', 'vitamin h', 'd-biotin'],
  'Alpha lipoic acid': [
    'alpha lipoic acid',
    'ala',
    'lipoic acid',
    'thioctic acid',
    'r-lipoic acid',
    'r-ala',
    'alpha-lipoic acid',
  ],
  Berberine: ['berberine', 'berberine hcl', 'berberine hydrochloride', 'berberin'],
  Spirulina: ['spirulina', 'spirulina powder', 'arthrospira platensis'],
  Chlorella: ['chlorella', 'chlorella powder', 'chlorella vulgaris'],
  Melatonin: ['melatonin', 'n-acetyl-5-methoxytryptamine'],
  GABA: ['gaba', 'gamma-aminobutyric acid', 'gamma aminobutyric acid'],
  '5-HTP': ['5-htp', '5-hydroxytryptophan', '5 htp', 'griffonia simplicifolia'],
};

/**
 * Bảng chuẩn hóa đơn vị đo lường trong kiểm nghiệm dược phẩm.
 * Key = đơn vị gốc (đã normalize thành lowercase, không dấu).
 * Value = đơn vị chuẩn trả về.
 */
const UNIT_NORMALIZATION_MAP: Record<string, string> = {
  // Đơn vị phần triệu
  ppm: 'ppm',
  'mg/kg': 'ppm',
  mgg: 'ppm', // mg/g → đôi khi viết liền
  'ug/g': 'ppm',
  'mcg/g': 'ppm',
  'µg/g': 'ppm',
  'microg/g': 'ppm',
  // Đơn vị phần tỷ
  ppb: 'ppb',
  'ug/kg': 'ppb',
  'mcg/kg': 'ppb',
  'µg/kg': 'ppb',
  // Vi sinh vật
  'cfu/g': 'CFU/g',
  'cfu/ml': 'CFU/mL',
  'cfu/g (kl/g)': 'CFU/g',
  'kl/g': 'CFU/g',
  cfug: 'CFU/g',
  cfu: 'CFU/g',
  'cfu/25g': 'CFU/25g',
  'cfu/10g': 'CFU/10g',
  // Thể tích & dung tích
  ml: 'mL',
  l: 'L',
  lit: 'L',
  // Phân liều dạng dùng
  'mg/vien': 'mg/viên',
  'mg/viên': 'mg/viên',
  'mg/tablet': 'mg/viên',
  'mg/capsule': 'mg/viên',
  'mg/goi': 'mg/gói',
  'mg/gói': 'mg/gói',
  'mg/sachet': 'mg/gói',
  // Phần trăm
  'g/100g': '%',
  'g/100ml': '% (w/v)',
  'w/w': '% (w/w)',
  ww: '% (w/w)',
  // Gram
  gam: 'g',
  gram: 'g',
  // Milli
  milligam: 'mg',
  milligram: 'mg',
  // Micro
  microgram: 'µg',
  mcg: 'µg',
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
    .replace(/μ/g, 'µ') // normalize micro ký tự khác nhau
    .replace(/×/g, 'x');
  return UNIT_NORMALIZATION_MAP[cleaned] ?? unit;
};

/**
 * Chuẩn hóa chuỗi: loại bỏ dấu tiếng Việt, ký tự đặc biệt, và chuyển thành chữ thường.
 */
export const normalizeString = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '') // Bỏ cả khoảng trắng và dấu câu để so khớp chặt hơn
    .trim();
};

/**
 * Tách chuỗi thành mảng các từ (tokens) viết thường, không dấu, bỏ ký tự đặc biệt.
 * Phục vụ so khớp nguyên từ (Whole Word Match), ngăn ngừa triệt để hiện tượng
 * cắt vụn ký tự trong từ la-tinh (ví dụ: 'chi' trong 'escherichia').
 */
export const tokenizeWords = (str: string): string[] => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
};

/**
 * Kiểm tra xem chuỗi nguồn có chứa cụm từ mục tiêu dưới dạng chuỗi các từ liên tiếp hay không.
 */
export const containsPhraseTokens = (source: string, targetPhrase: string): boolean => {
  const sourceWords = tokenizeWords(source);
  const targetWords = tokenizeWords(targetPhrase);
  if (targetWords.length === 0 || sourceWords.length < targetWords.length) return false;

  for (let i = 0; i <= sourceWords.length - targetWords.length; i++) {
    let match = true;
    for (let j = 0; j < targetWords.length; j++) {
      if (sourceWords[i + j] !== targetWords[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
};

/**
 * Nhận diện nhóm kiểm nghiệm dược điển của chỉ tiêu để thực thi Rào chắn An toàn (Negative Guard).
 * Các nhóm kiểm nghiệm sau đây là LOẠI TRỪ LẪN NHAU (Mutually Exclusive):
 * - HEAVY_METAL (Kim loại nặng: Pb, As, Cd, Hg...)
 * - MICROBIAL (Vi sinh vật: E. coli, Salmonella, TVKHK, TSNM...)
 * - PHYSICAL (Lý học & Cảm quan: Cảm quan, Độ ẩm, pH, Tỷ trọng...)
 */
export const getCriterionCategory = (
  name: string
): 'HEAVY_METAL' | 'MICROBIAL' | 'PHYSICAL' | 'UNKNOWN' => {
  if (!name) return 'UNKNOWN';
  const words = tokenizeWords(name);
  const norm = normalizeString(name);

  // 1. Vi sinh vật & Men vi sinh
  const microbialTokens = new Set([
    'ecoli',
    'escherichia',
    'coli',
    'coliform',
    'coliforms',
    'salmonella',
    'staphylococcus',
    'aureus',
    'pseudomonas',
    'aeruginosa',
    'candida',
    'albicans',
    'clostridium',
    'bacillus',
    'lactobacillus',
    'bifidobacterium',
    'saccharomyces',
    'tamc',
    'tymc',
    'tvkhk',
    'tsnm',
    'visinh',
    'microbial',
    'microbiology',
    'yeast',
    'mold',
    'mould',
    'nammen',
    'nammoc',
    'khuanlac',
    'cfu',
    'probiotic',
    'probiotics',
    'loikhuan',
    'baotu',
  ]);
  if (
    words.some((w) => microbialTokens.has(w)) ||
    norm.includes('visinh') ||
    norm.includes('aerobiccount')
  ) {
    return 'MICROBIAL';
  }

  // 2. Kim loại nặng
  // Chú ý: Các ký hiệu 2 ký tự (pb, cd, as, hg, cu, zn, fe, ni, cr) hoặc từ ngắn (chi)
  // BẮT BUỘC chỉ được match khi là 1 token độc lập trong danh sách words.
  const heavyMetalExactTokens = new Set([
    'pb',
    'lead',
    'chi',
    'as',
    'asen',
    'arsenic',
    'arsen',
    'hg',
    'thuyngan',
    'mercury',
    'cd',
    'cadmi',
    'cadmium',
    'cu',
    'copper',
    'zn',
    'zinc',
    'fe',
    'iron',
    'ni',
    'nickel',
    'cr',
    'chromium',
    'heavymetal',
    'heavymetals',
    'kimloainang',
  ]);
  if (
    words.some((w) => heavyMetalExactTokens.has(w)) ||
    norm.includes('kimloainang') ||
    norm.includes('heavymetal')
  ) {
    return 'HEAVY_METAL';
  }

  // 3. Cảm quan & Lý học
  const physicalTokens = new Set([
    'camquan',
    'appearance',
    'description',
    'doam',
    'moisture',
    'lod',
    'ph',
    'tytrong',
    'density',
    'dora',
    'disintegration',
    'docung',
    'hardness',
    'domaimon',
    'friability',
    'thetichthuc',
    'khoiluongtrungbinh',
    'uniformity',
    'chisoacid',
    'chisoiod',
    'khucxa',
    'refraction',
    'donhot',
    'viscosity',
  ]);
  if (
    words.some((w) => physicalTokens.has(w)) ||
    norm.includes('camquan') ||
    norm.includes('doam') ||
    norm.includes('lossondrying') ||
    norm.includes('khoiluongtrungbinh') ||
    norm.includes('thetichthuc') ||
    norm.includes('tytrong') ||
    norm.includes('tanra')
  ) {
    return 'PHYSICAL';
  }

  return 'UNKNOWN';
};

/**
 * Tra cứu thuật ngữ trong PHARMA_TERM_DICTIONARY.
 * Trả về tên chuẩn trong hệ thống nếu tìm thấy, hoặc null nếu không.
 * Ưu tiên: Khớp chính xác 100% → Khớp nguyên cụm từ hoàn chỉnh (Phrase Token Match).
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

  // 2. Khớp theo word tokens hoặc cụm từ hoàn chỉnh (tránh cắt vụn từ)
  const aiWords = tokenizeWords(aiName);
  let bestMatch: { systemName: string; matchLength: number } | null = null;

  for (const [systemName, aliases] of Object.entries(PHARMA_TERM_DICTIONARY)) {
    const systemWords = tokenizeWords(systemName);
    if (containsPhraseTokens(aiName, systemName)) {
      const len = systemWords.join('').length;
      if (!bestMatch || len > bestMatch.matchLength) {
        bestMatch = { systemName, matchLength: len };
      }
    }

    for (const alias of aliases) {
      const aliasWords = tokenizeWords(alias);
      if (aliasWords.length === 0) continue;

      // Nếu alias chỉ có 1 từ ngắn (<= 3 ký tự như pb, cd, as, fe, zn, chi, iod):
      // BẮT BUỘC phải là 1 token độc lập trong aiWords!
      if (aliasWords.length === 1 && aliasWords[0].length <= 3) {
        if (aiWords.includes(aliasWords[0])) {
          if (!bestMatch || aliasWords[0].length > bestMatch.matchLength) {
            bestMatch = { systemName, matchLength: aliasWords[0].length };
          }
        }
      } else if (containsPhraseTokens(aiName, alias)) {
        const len = aliasWords.join('').length;
        if (!bestMatch || len > bestMatch.matchLength) {
          bestMatch = { systemName, matchLength: len };
        }
      }
    }
  }

  return bestMatch ? bestMatch.systemName : null;
};

/**
 * Kiểm tra mức độ tương đồng giữa 2 chuỗi tên chỉ tiêu.
 * Thứ tự ưu tiên:
 * 1. Learned Mappings
 * 2. Pharma Category Negative Guard (Tuyệt đối không map Kim loại nặng vs Vi sinh vs Lý tính)
 * 3. Pharma Dictionary (Song phương & Phân tách rõ ràng)
 * 4. Word-token Sequence Match
 */
export const isCriteriaMatch = (
  aiCriteriaName: string,
  systemCriteriaName: string,
  learnedMappings: AILearnedMapping[] = []
) => {
  const norm1 = normalizeString(aiCriteriaName);
  const norm2 = normalizeString(systemCriteriaName);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // RÀO CHẮN NGHIỆP VỤ DƯỢC KHOA (PHARMA TEST TYPE GUARD):
  // Định tính (Identification) và Định lượng/Hàm lượng (Assay/Content) là 2 loại phép thử hoàn toàn khác nhau.
  const isIdentity1 = norm1.includes('dinhtinh') || norm1.includes('identification');
  const isIdentity2 = norm2.includes('dinhtinh') || norm2.includes('identification');
  const isAssay1 =
    norm1.includes('dinhluong') || norm1.includes('assay') || norm1.includes('hamluong');
  const isAssay2 =
    norm2.includes('dinhluong') || norm2.includes('assay') || norm2.includes('hamluong');

  if ((isIdentity1 && isAssay2) || (isAssay1 && isIdentity2)) {
    return false;
  }

  // RÀO CHẮN LOẠI TRỪ DANH MỤC KIỂM NGHIỆM (CATEGORY NEGATIVE GUARD):
  // Kim loại nặng (Pb, Cd, As, Hg...) TUYỆT ĐỐI KHÔNG BAO GIỜ được khớp với Vi sinh vật (E. coli, TAMC, Salmonella...)
  // hoặc Lý học (Độ ẩm, Cảm quan...) và ngược lại!
  const cat1 = getCriterionCategory(aiCriteriaName);
  const cat2 = getCriterionCategory(systemCriteriaName);
  if (cat1 !== 'UNKNOWN' && cat2 !== 'UNKNOWN' && cat1 !== cat2) {
    return false;
  }

  // 1. Ưu tiên kiểm tra trong cơ sở dữ liệu đã học (Learned Mappings)
  const relevantMappings = learnedMappings
    .filter((m) => m.systemName === systemCriteriaName)
    .sort((a, b) => b.frequency - a.frequency);

  for (const mapping of relevantMappings) {
    if (norm1 === normalizeString(mapping.originalName)) {
      return true;
    }
  }

  // 2. Tra cứu từ điển thuật ngữ dược khoa (Song phương)
  const dictAi = lookupPharmaTerm(aiCriteriaName);
  const dictSystem = lookupPharmaTerm(systemCriteriaName);

  // 2.1. Cả 2 bên đều quy về cùng một nhóm hoạt chất / nguyên tố trong từ điển
  if (dictAi && dictSystem) {
    return dictAi === dictSystem;
  }

  // 2.2. Nhóm từ điển của AI nằm trong tên hệ thống (dưới dạng từ/cụm từ hoàn chỉnh)
  if (dictAi) {
    if (
      containsPhraseTokens(systemCriteriaName, dictAi) ||
      containsPhraseTokens(systemCriteriaName, aiCriteriaName)
    ) {
      return true;
    }
  }

  // 2.3. Nhóm từ điển của System chứa trong AI name (dưới dạng từ/cụm từ hoàn chỉnh)
  if (dictSystem) {
    if (
      containsPhraseTokens(aiCriteriaName, dictSystem) ||
      containsPhraseTokens(aiCriteriaName, systemCriteriaName)
    ) {
      return true;
    }
  }

  // 3. Fallback về so khớp cụm từ (Word Token Matching) — chỉ chấp nhận khi là cụm từ hoàn chỉnh
  if (norm1 === norm2) return true;

  if (
    containsPhraseTokens(aiCriteriaName, systemCriteriaName) ||
    containsPhraseTokens(systemCriteriaName, aiCriteriaName)
  ) {
    return true;
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
  tccsCriteria.forEach((criterion) => {
    // Tìm kết quả tốt nhất từ AI (có sử dụng learnedMappings + dictionary)
    const matchIndex = extractedResults.findIndex(
      (aiRes, index) =>
        !usedAiIndexes.has(index) &&
        isCriteriaMatch(aiRes.criteriaName, criterion.name, learnedMappings)
    );

    if (matchIndex !== -1) {
      const matchedResult = extractedResults[matchIndex];
      usedAiIndexes.add(matchIndex);

      mappedEntries.push({
        criteriaName: criterion.name, // Lấy tên chuẩn của hệ thống
        value: matchedResult.value,
        unit: normalizeUnit(matchedResult.unit || ''), // Chuẩn hóa đơn vị
        limit: matchedResult.limit,
        // Trick để luân chuyển originalName cho TestResultForm
        ...({ aiOriginalName: matchedResult.criteriaName } as any),
      });
    }
  });

  return mappedEntries;
};
