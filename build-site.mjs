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

// Keep the original image-review tool. The shopping-list page is a minimal
// checkbox interface backed by the original product catalogue.
const reviewSource = await readFile('tools/圖片核對中心.html', 'utf8');
if (!reviewSource.includes('</html>')) throw new Error('Invalid original review HTML');
const reviewDir = join('public', 'image-review');
await mkdir(reviewDir, { recursive: true });
await writeFile(
  join(reviewDir, 'index.html'),
  reviewSource.replace('</body>', '<script src="/image-review/cloud-sync.js"></script></body>'),
  'utf8'
);
await writeFile(
  join(reviewDir, 'cloud-sync.js'),
  await readFile('cloud-sync-review.js', 'utf8'),
  'utf8'
);

const originalCatalog = await readFile('tools/產品選購清單.html', 'utf8');
const catalogMatch = originalCatalog.match(/const BASE_PRODUCTS\s*=\s*(\[[\s\S]*?\]);/);
if (!catalogMatch) throw new Error('Cannot extract the original shopping-list product catalogue');
const catalog = JSON.parse(catalogMatch[1]);
const uniqueIds = new Set(catalog.map(p => p.id));
if (catalog.length < 100 || catalog.length !== uniqueIds.size) {
  throw new Error('Unexpected or duplicated product catalogue records');
}

const recommendationDir = join('public', 'recommendation-list');
await mkdir(recommendationDir, { recursive: true });
await writeFile(
  join(recommendationDir, 'index.html'),
  await readFile('tools/簡易產品推薦清單.html', 'utf8'),
  'utf8'
);
await writeFile(
  join(recommendationDir, 'catalog.js'),
  'window.RECOMMENDATION_PRODUCTS = ' + JSON.stringify(catalog) + ';',
  'utf8'
);
await writeFile(
  join(recommendationDir, 'simple-list.js'),
  await readFile('simple-recommendations.js', 'utf8'),
  'utf8'
);
await writeFile(
  join(recommendationDir, 'jpg-export.js'),
  await readFile('recommendation-jpg-export.js', 'utf8'),
  'utf8'
);

// Private health survey results archive: public page only contains the login UI.
const historyDir = join('public', 'health-history');
await mkdir(historyDir, { recursive: true });
await writeFile(
  join(historyDir, 'index.html'),
  await readFile('tools/健康問卷紀錄.html', 'utf8'),
  'utf8'
);

console.log('Built survey with final-result archive, image review, '+catalog.length+'-product recommendation list, and protected health history.');
