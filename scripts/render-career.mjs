import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dependency, hash, git } from './resume-common.mjs';

export function careerConfig(root) {
  const configFile = path.join(root, 'career.config.json');
  if (fs.existsSync(configFile)) {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
  return {
    markdown: 'output/경력기술서/career_description_draft.md',
    pdf: 'output/경력기술서/AI Agent Developer 황화인 경력기술서.pdf',
    manifest: 'output/경력기술서/.career-build.json',
    inputs: [
      'output/경력기술서/career_description_draft.md',
      'scripts/render-career.mjs',
      'scripts/resume-common.mjs',
      'career.config.json'
    ]
  };
}

export function inputHash(file, data) {
  return hash(/\.(md|html|json|mjs|css)$/.test(file) ? data.toString('utf8').replace(/\r\n/g, '\n') : data);
}

export function careerFingerprints(root, cfg, ref = null) {
  return Object.fromEntries(cfg.inputs.map(file => {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) return [file, 'missing'];
    const data = ref === null ? fs.readFileSync(fullPath) : git(root, ['show', ref === ':' ? ':' + file : ref + ':' + file]);
    return [file, inputHash(file, data)];
  }));
}

export function buildHtml(markdownContent) {
  const markedModule = dependency('marked');
  const markedFn = markedModule.marked || markedModule;
  // Preprocess: convert **...** into <strong>...</strong> to avoid CommonMark punctuation/Korean 조사 parsing failures
  const safeMarkdown = markdownContent.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  const bodyHtml = markedFn(safeMarkdown);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>AI Agent Developer 황화인 경력기술서</title>
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  
  @page {
    size: A4 portrait;
    margin: 18mm 16mm 18mm 16mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.3pt;
    line-height: 1.62;
    color: #1e293b;
    margin: 0;
    padding: 0;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  h1 {
    font-size: 18pt;
    font-weight: 800;
    color: #0f172a;
    margin-top: 0;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #0f172a;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 13.5pt;
    font-weight: 700;
    color: #1d4ed8;
    margin-top: 24px;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid #cbd5e1;
    break-after: avoid;
    page-break-after: avoid;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
    margin-top: 18px;
    margin-bottom: 8px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
    break-after: avoid;
    page-break-after: avoid;
  }

  h4 {
    font-size: 9.8pt;
    font-weight: 600;
    color: #334155;
    margin-top: 12px;
    margin-bottom: 5px;
    break-after: avoid;
    page-break-after: avoid;
  }

  p {
    margin-top: 4px;
    margin-bottom: 6px;
    word-break: keep-all;
  }

  ul, ol {
    margin-top: 4px;
    margin-bottom: 8px;
    padding-left: 18px;
  }

  li {
    margin-bottom: 3.5px;
    word-break: keep-all;
  }

  li > p {
    margin: 2px 0;
  }

  strong {
    color: #0f172a;
    font-weight: 700;
  }

  code {
    font-family: 'Consolas', 'Courier New', monospace;
    background: #f1f5f9;
    color: #0f172a;
    padding: 1px 4.5px;
    border-radius: 3px;
    font-size: 8.5pt;
    border: 1px solid #e2e8f0;
  }

  hr {
    border: none;
    border-top: 1px dashed #cbd5e1;
    margin: 18px 0;
  }

  blockquote {
    margin: 8px 0;
    padding: 6px 12px;
    background-color: #f8fafc;
    border-left: 3.5px solid #3b82f6;
    color: #475569;
    font-style: normal;
  }

  /* Prevent awkward page breaks */
  h1, h2, h3, h4 {
    break-after: avoid;
    page-break-after: avoid;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 8.8pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    text-align: left;
  }

  th {
    background-color: #f1f5f9;
    font-weight: 600;
    color: #1e293b;
  }
</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

export async function renderCareer(root) {
  const cfg = careerConfig(root);
  const before = careerFingerprints(root, cfg);
  const markdownPath = path.join(root, cfg.markdown);

  if (!fs.existsSync(markdownPath)) {
    throw new Error('Markdown source not found: ' + markdownPath);
  }

  const markdownContent = fs.readFileSync(markdownPath, 'utf8');
  const fullHtml = buildHtml(markdownContent);

  const { chromium } = dependency('playwright');
  const { PDFDocument } = dependency('pdf-lib');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const raw = await page.pdf({
      format: 'A4',
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; font-family: sans-serif;"><span>AI Agent Developer 황화인 경력기술서</span><span></span></div>',
      footerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; font-family: sans-serif;"><span></span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
    });

    const pdf = await PDFDocument.load(raw, { updateMetadata: false });
    const pageCount = pdf.getPageCount();

    for (const p of pdf.getPages()) {
      const s = p.getSize();
      if (Math.abs(s.width - 595.28) > 2 || Math.abs(s.height - 841.89) > 2) {
        throw new Error('Rendered page is not A4 standard dimensions.');
      }
    }

    pdf.setTitle('AI Agent Developer 황화인 경력기술서');
    pdf.setSubject('경력기술서');
    pdf.setLanguage('ko');
    const bytes = await pdf.save();

    const outputPdf = path.join(root, cfg.pdf);
    const receiptPath = path.join(root, cfg.manifest);

    fs.mkdirSync(path.dirname(outputPdf), { recursive: true });
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });

    const manifest = {
      version: 1,
      inputs: before,
      pdfSha256: hash(bytes),
      pages: pageCount,
      print: { format: 'A4', printBackground: true, displayHeaderFooter: true }
    };

    fs.writeFileSync(outputPdf + '.tmp', bytes);
    fs.writeFileSync(receiptPath + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(outputPdf + '.tmp', outputPdf);
    fs.renameSync(receiptPath + '.tmp', receiptPath);

    console.error(`[career] PDF updated: ${pageCount} A4 pages -> ${cfg.pdf}`);
    return manifest;
  } finally {
    await browser.close();
  }
}
