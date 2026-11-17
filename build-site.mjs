import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Keep the original questionnaire completely unchanged.
const questionnaire = await readFile('spa_gemini_ai.html', 'utf8');
if (!/<\/body>/i.test(questionnaire)) throw new Error('Questionnaire HTML is invalid.');

await mkdir('public', { recursive: true });
await writeFile(join('public', 'index.html'), questionnaire, 'utf8');
await writeFile(join('public', 'spa_gemini_ai.html'), questionnaire, 'utf8');

// Independent recommendation-sheet builder, with the latest product names
// from the same source database. No questionnaire matrix or scoring changes.
const catalogMatch = questionnaire.match(/\bconst\s+PRODUCT_DB\s*=\s*(\{[\s\S]*?\})\s*;\s*const\s+NUTRIENT_DB\b/);
if (!catalogMatch) throw new Error('PRODUCT_DB not found in questionnaire source.');

const pageDir = join('public', 'recommendation-list');
await mkdir(pageDir, { recursive: true });
await writeFile(join(pageDir, 'index.html'), await readFile('recommendation-list.html', 'utf8'), 'utf8');
await writeFile(join(pageDir, 'recommendation-list.js'), await readFile('recommendation-list.js', 'utf8'), 'utf8');

const manuallyAdded = {
  name: '樂優選™胜肽益生亮白牙膏',
  brand: '樂優選™ The Usuals',
  price: 'NT$340',
  tags: ['個人衛生'],
  manualOnly: true,
  desc: '[日常口腔潔淨與亮白保養] 清新薄荷牙膏，結合羥基磷灰石、胜肽及發酵來源成分，幫助清潔牙齒、去除表面牙漬，使牙齒維持自然潔淨光澤，並帶來清新口氣。適合重視牙齒日常清潔、自然亮白及口腔保養的人士。'
};
const catalog = 'window.RECOMMENDATION_CATALOG = ' + catalogMatch[1] + ';\n' +
  'window.RECOMMENDATION_CATALOG["manual-usuals-toothpaste"] = ' + JSON.stringify(manuallyAdded) + ';\n';
await writeFile(join(pageDir, 'product-data.js'), catalog, 'utf8');
console.log('Built original health questionnaire + separate recommendation-list tool.');
