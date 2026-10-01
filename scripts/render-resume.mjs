import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, fingerprints, hash, dependency } from './resume-common.mjs';

export async function render(root) {
  const cfg = config(root);
  const before = fingerprints(root, cfg);
  const { chromium } = dependency('playwright');
  const { PDFDocument } = dependency('pdf-lib');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.goto(pathToFileURL(path.join(root, cfg.html)).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
      title: document.title,
      subject: document.querySelector('meta[name="description"]')?.content || '',
      fontLoaded: document.fonts.check('12px Pretendard'),
      imageErrors: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
      pages: [...document.querySelectorAll('.page')].map(p => {
        const box = p.getBoundingClientRect(), footer = p.querySelector('.footer').getBoundingClientRect();
        const content = p.querySelector('.content').getBoundingClientRect();
        return { heightMm: box.height * 25.4 / 96, footerOverlap: content.bottom > footer.top + 0.5 };
      })
    }));
    if (!layout.fontLoaded || layout.imageErrors.length) throw Error('Fonts or images failed to load; PDF preserved.');
    if (layout.pages.length !== cfg.pages || layout.pages.some(p => p.heightMm > 277.1 || p.footerOverlap)) {
      throw Error('A4 layout overflow: ' + JSON.stringify(layout.pages));
    }
    const raw = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: cfg.scale, outline: true, tagged: true });
    const pdf = await PDFDocument.load(raw, { updateMetadata: false });
    if (pdf.getPageCount() !== cfg.pages) throw Error('Expected ' + cfg.pages + ' PDF pages, got ' + pdf.getPageCount());
    for (const p of pdf.getPages()) {
      const s = p.getSize();
      if (Math.abs(s.width - 595.28) > 1 || Math.abs(s.height - 841.89) > 1) throw Error('PDF is not A4.');
    }
    pdf.setTitle(layout.title);
    pdf.setSubject(layout.subject);
    pdf.setLanguage('ko');
    const bytes = await pdf.save();
    if (JSON.stringify(before) !== JSON.stringify(fingerprints(root, cfg))) throw Error('Source changed during rendering; retry.');
    const manifest = { version: 1, inputs: before, pdfSha256: hash(bytes), pages: cfg.pages, print: { format: 'A4', scale: cfg.scale, preferCSSPageSize: true, printBackground: true } };
    // Replace only after the complete output passes validation.
    const output = path.join(root, cfg.pdf), receipt = path.join(root, cfg.manifest);
    fs.writeFileSync(output + '.tmp', bytes);
    fs.writeFileSync(receipt + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(output + '.tmp', output);
    fs.renameSync(receipt + '.tmp', receipt);
    console.error('[resume] PDF updated: ' + cfg.pages + ' A4 pages.');
    return manifest;
  } finally { await browser.close(); }
}
