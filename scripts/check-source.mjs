import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
function visit(dir) { for (const file of readdirSync(dir)) { const path = join(dir, file); if (statSync(path).isDirectory()) visit(path); else if (/\.(tsx?|css|json|mjs)$/.test(file)) files.push(path); } }
visit('src'); visit('scripts');
const failures = [];
for (const path of files) {
  if (path.startsWith('scripts/legacy/')) continue;
  const content = readFileSync(path, 'utf8');
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) failures.push(`${path}: merge conflict marker`);
  if (/\bdebugger\s*;/.test(content)) failures.push(`${path}: debugger statement`);
  if (/ +$/m.test(content)) failures.push(`${path}: trailing whitespace`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Source hygiene checked: ${files.length} files. TypeScript noUnused checks run separately. This is not ESLint.`);
