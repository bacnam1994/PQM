const fs = require('fs');
const path = require('path');
const glob = require('glob');

function escapeAttr(s){
  return s.replace(/\"/g, '&quot;').replace(/\n/g, ' ');
}

const files = glob.sync('**/*.{tsx,jsx}', { ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'] });
let changed = 0;
files.forEach(file => {
  let src = fs.readFileSync(file, 'utf8');
  let out = src;

  // replace inputs
  out = out.replace(/<input(\s[^>]*?)?>/g, (match, attrs) => {
    if (!attrs) attrs = '';
    if (/aria-label\s*=/.test(attrs)) return match;
    const placeholderMatch = attrs.match(/placeholder=("|')(.*?)("|')/s);
    const nameMatch = attrs.match(/name=("|')(.*?)("|')/s);
    const idMatch = attrs.match(/id=("|')(.*?)("|')/s);
    const candidate = placeholderMatch ? placeholderMatch[2] : (nameMatch ? nameMatch[2] : (idMatch ? idMatch[2] : null));
    if (!candidate) return match;
    const label = escapeAttr(candidate.trim());
    return `<input aria-label="${label}"${attrs || ''}>`;
  });

  // replace textareas
  out = out.replace(/<textarea(\s[^>]*?)?>/g, (match, attrs) => {
    if (!attrs) attrs = '';
    if (/aria-label\s*=/.test(attrs)) return match;
    const placeholderMatch = attrs.match(/placeholder=("|')(.*?)("|')/s);
    const nameMatch = attrs.match(/name=("|')(.*?)("|')/s);
    const idMatch = attrs.match(/id=("|')(.*?)("|')/s);
    const candidate = placeholderMatch ? placeholderMatch[2] : (nameMatch ? nameMatch[2] : (idMatch ? idMatch[2] : null));
    if (!candidate) return match;
    const label = escapeAttr(candidate.trim());
    return `<textarea aria-label="${label}"${attrs || ''}>`;
  });

  // replace selects
  out = out.replace(/<select(\s[^>]*?)?>/g, (match, attrs) => {
    if (!attrs) attrs = '';
    if (/aria-label\s*=/.test(attrs)) return match;
    const placeholderMatch = attrs.match(/placeholder=("|')(.*?)("|')/s);
    const nameMatch = attrs.match(/name=("|')(.*?)("|')/s);
    const idMatch = attrs.match(/id=("|')(.*?)("|')/s);
    const candidate = placeholderMatch ? placeholderMatch[2] : (nameMatch ? nameMatch[2] : (idMatch ? idMatch[2] : null));
    if (!candidate) return match;
    const label = escapeAttr(candidate.trim());
    return `<select aria-label="${label}"${attrs || ''}>`;
  });

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    changed++;
    console.log('patched', file);
  }
});
console.log(`Done. Files changed: ${changed}`);
