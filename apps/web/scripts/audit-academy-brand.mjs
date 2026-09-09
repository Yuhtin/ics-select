import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = ['app', 'components', 'public/slides'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css']);
const oldBrand = /ICS Select|Inteli Consulting Society|ICS · SELECT/g;
const findings = [];

async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const absolutePath = join(path, entry.name);
    if (entry.isDirectory()) {
      await scan(absolutePath);
      continue;
    }
    if (!extensions.has(extname(entry.name))) continue;

    const lines = (await readFile(absolutePath, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      oldBrand.lastIndex = 0;
      if (oldBrand.test(line)) {
        findings.push(`${relative('.', absolutePath)}:${index + 1}:${line.trim()}`);
      }
    });
  }
}

for (const root of roots) await scan(root);

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
