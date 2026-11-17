import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = await readFile('spa_gemini_ai.html', 'utf8');
if (!/<\/body>/i.test(source)) {
  throw new Error('Source questionnaire is missing the closing body tag.');
}
const extension = '<script src="/client-list.js"></script>';
const built = source.replace(/<\/body>/i, '    ' + extension + '\n</body>');

await mkdir('public', { recursive: true });
await writeFile(join('public', 'index.html'), built, 'utf8');
await writeFile(join('public', 'spa_gemini_ai.html'), built, 'utf8');
await writeFile(join('public', 'client-list.js'), await readFile('client-list.js', 'utf8'), 'utf8');

console.log('Website built from spa_gemini_ai.html; client list export enabled.');
