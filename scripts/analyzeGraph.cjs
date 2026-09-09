const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (/\.(ts|tsx)$/.test(file)) results.push(file);
  });
  return results;
}

const files = walk('src');
const importRegex = /import\s+(?:(?:(?:\*\s+as\s+\w+|[\w\s{},*]+)\s+from\s+)?['"]([^'"]+)['"]|['"]([^'"]+)['"])/g;

let firebaseDirectImports = [];
let storeDirectImports = [];
let aiDirectImports = [];

files.forEach(f => {
  const norm = f.replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (importPath.includes('firebase') && !norm.includes('firebase.ts') && !norm.includes('.test.')) {
      firebaseDirectImports.push({ file: norm, import: importPath });
    }
    if (importPath.includes('useAppStore') && !norm.includes('useAppStore.ts') && !norm.includes('.test.')) {
      storeDirectImports.push(norm);
    }
    if ((importPath.includes('geminiService') || importPath.includes('@google/generative-ai')) && !norm.includes('geminiService.ts') && !norm.includes('.test.')) {
      aiDirectImports.push({ file: norm, import: importPath });
    }
  }
});

const summary = {
  totalFiles: files.length,
  firebaseImports: [...new Set(firebaseDirectImports.map(x => x.file))],
  storeImports: [...new Set(storeDirectImports)],
  aiImports: [...new Set(aiDirectImports.map(x => x.file))]
};

console.log('Total files scanned:', summary.totalFiles);
console.log('Unique files importing Firebase directly:', summary.firebaseImports.length);
console.log('Unique files directly importing useAppStore:', summary.storeImports.length);
console.log('Unique files importing AI directly:', summary.aiImports.length);

fs.writeFileSync('scripts/graph_summary.json', JSON.stringify(summary, null, 2));
