const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (/\.(ts|tsx|js|jsx|json|rules|html|css)$/.test(file) && !file.includes('node_modules') && !file.includes('dist')) {
      results.push(file.replace(/\\/g, '/'));
    }
  });
  return results;
}

const allFiles = walk('src').concat(walk('tests')).concat(['database.rules.json', 'storage.rules', 'package.json', 'vite.config.ts']);

function classifyFile(f) {
  if (f.includes('.test.') || f.startsWith('tests/')) return 'tests';
  if (f.includes('src/services/ai/') || f.includes('aiTools') || f.includes('aiMapping')) return 'AI';
  if (f.startsWith('src/pages/') || f.startsWith('src/components/')) return 'presentation';
  if (f.startsWith('src/hooks/')) return 'presentation/hooks';
  if (f.startsWith('src/store/')) return 'state';
  if (f.includes('databaseService') || f.includes('storageService') || f.includes('firebase') || f.includes('offlineMutationQueue') || f.includes('.rules')) return 'infrastructure';
  if (f.startsWith('src/services/')) return 'application';
  if (f.includes('criteriaEvaluation') || f.includes('ootDetection') || f.includes('basisCalculation') || f.includes('types.ts')) return 'domain';
  if (f.startsWith('src/providers/') || f.includes('App.tsx') || f.includes('main.tsx')) return 'app';
  if (f.startsWith('src/utils/')) return 'shared';
  return 'other';
}

const breakdown = {};
let totalLines = 0;

allFiles.forEach(file => {
  const cat = classifyFile(file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').length;
  totalLines += lines;
  if (!breakdown[cat]) {
    breakdown[cat] = { count: 0, lines: 0, files: [] };
  }
  breakdown[cat].count++;
  breakdown[cat].lines += lines;
  breakdown[cat].files.push({ file, lines });
});

console.log('=== SYSTEM BASELINE METRICS ===');
console.log('Total files:', allFiles.length);
console.log('Total lines:', totalLines);
for (const [cat, data] of Object.entries(breakdown)) {
  console.log(`- ${cat}: ${data.count} files, ${data.lines} lines`);
}

fs.writeFileSync('scripts/classification.json', JSON.stringify({ totalFiles: allFiles.length, totalLines, breakdown }, null, 2));
