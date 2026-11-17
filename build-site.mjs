import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// Keep the entire health questionnaire unchanged.
const questionnaire = await readFile('spa_gemini_ai.html', 'utf8');
if (!questionnaire.toLowerCase().includes('</body>')) {
  throw new Error('Original questionnaire HTML is invalid.');
}

// Re-create output to avoid shipping obsolete client-list or prototype scripts.
await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });
await writeFile(join('public', 'index.html'), questionnaire, 'utf8');
await writeFile(join('public', 'spa_gemini_ai.html'), questionnaire, 'utf8');

// Deploy the two user-uploaded original HTML tools, with their original
// JavaScript, design, paste support, IndexedDB, and ZIP import/export intact.
// These are independent pages and do not change the questionnaire matrices.
const tools = [
  { src: 'tools/圖片核對中心.html', url: 'image-review' },
  { src: 'tools/產品選購清單.html', url: 'recommendation-list' }
];
for (const tool of tools) {
  const source = await readFile(tool.src, 'utf8');
  if (!source.includes('</html>')) throw new Error('Invalid tool HTML: ' + tool.src);
  const cloudScript = tool.url === 'image-review' ? 'cloud-sync-review.js' : 'cloud-sync-cart.js';
  const withSync = source.replace('</body>', '<script src="/' + tool.url + '/cloud-sync.js"></script>\\n</body>');
  const folder = join('public', tool.url);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'index.html'), withSync, 'utf8');
  await writeFile(join(folder, 'cloud-sync.js'), await readFile(cloudScript, 'utf8'), 'utf8');
}

console.log('Built unchanged questionnaire + two original private HTML tool subpages.');
