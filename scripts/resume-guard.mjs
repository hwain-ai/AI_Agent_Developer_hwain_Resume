import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, fingerprints, hash, git, read } from './resume-common.mjs';
import { careerConfig, careerFingerprints } from './render-career.mjs';

export function lintResume(root, ref = null) {
  const cfg = config(root, ref);
  const receipt = JSON.parse(read(root, cfg.manifest, ref));
  if (JSON.stringify(receipt.inputs) !== JSON.stringify(fingerprints(root, cfg, ref))) {
    throw Error('HTML/PDF out of sync. Run npm run resume:pdf, then commit HTML, PDF and .resume-build.json together.');
  }
  if (receipt.pdfSha256 !== hash(read(root, cfg.pdf, ref))) throw Error('PDF changed without a matching build receipt. Run npm run resume:pdf.');
}

export function lintCareer(root, ref = null) {
  const configFile = path.join(root, 'career.config.json');
  if (!fs.existsSync(configFile)) return;
  const cfg = careerConfig(root);
  const manifestPath = path.join(root, cfg.manifest);
  if (!fs.existsSync(manifestPath)) {
    throw Error('Career manifest missing. Run npm run career:pdf.');
  }
  const receipt = JSON.parse(read(root, cfg.manifest, ref));
  if (JSON.stringify(receipt.inputs) !== JSON.stringify(careerFingerprints(root, cfg, ref))) {
    throw Error('Career description MD/PDF out of sync. Run npm run career:pdf, then commit MD, PDF and .career-build.json together.');
  }
  if (receipt.pdfSha256 !== hash(read(root, cfg.pdf, ref))) {
    throw Error('Career PDF changed without a matching build receipt. Run npm run career:pdf.');
  }
}

export function lint(root, ref = null) {
  lintResume(root, ref);
  if (fs.existsSync(path.join(root, 'career.config.json'))) {
    lintCareer(root, ref);
  }
}

export function assertCommitted(root) {
  const cfg = config(root);
  let files = [...cfg.inputs, cfg.pdf, cfg.manifest];
  if (fs.existsSync(path.join(root, 'career.config.json'))) {
    const cCfg = careerConfig(root);
    files = [...files, ...cCfg.inputs, cCfg.pdf, cCfg.manifest];
  }
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...files]).toString().trim();
  if (dirty) throw Error('Resume or career changes must be committed before finishing or pushing. Run npm run resume:pdf / npm run career:pdf; git add; git commit.');
  lint(root);
}

export async function syncResume(root) {
  try { lintResume(root); return; } catch (error) { console.error('[resume] Rebuilding: ' + error.message); }
  const { render } = await import('./render-resume.mjs');
  await render(root);
  lintResume(root);
}

export async function syncCareer(root) {
  try { lintCareer(root); return; } catch (error) { console.error('[career] Rebuilding: ' + error.message); }
  const { renderCareer } = await import('./render-career.mjs');
  await renderCareer(root);
  lintCareer(root);
}

export async function sync(root) {
  await syncResume(root);
  if (fs.existsSync(path.join(root, 'career.config.json'))) {
    await syncCareer(root);
  }
}

export async function preCommit(root) {
  const staged = git(root, ['diff', '--cached', '--name-only', '-z']).toString().split('\0');

  // 1. Resume synchronization
  const cfg = config(root);
  const resumeRelated = [...cfg.inputs, cfg.pdf, cfg.manifest];
  if (resumeRelated.some(f => staged.includes(f))) {
    if (JSON.stringify(fingerprints(root, cfg, ':')) !== JSON.stringify(fingerprints(root, cfg))) {
      throw Error('Resume inputs are partially staged. Stage all intended resume source changes before committing.');
    }
    await syncResume(root);
    git(root, ['add', '--', cfg.pdf, cfg.manifest]);
    lintResume(root, ':');
  }

  // 2. Career description synchronization
  if (fs.existsSync(path.join(root, 'career.config.json'))) {
    const cCfg = careerConfig(root);
    const careerRelated = [...cCfg.inputs, cCfg.pdf, cCfg.manifest];
    if (careerRelated.some(f => staged.includes(f))) {
      if (JSON.stringify(careerFingerprints(root, cCfg, ':')) !== JSON.stringify(careerFingerprints(root, cCfg))) {
        throw Error('Career inputs are partially staged. Stage all intended career source changes before committing.');
      }
      await syncCareer(root);
      git(root, ['add', '--', cCfg.pdf, cCfg.manifest]);
      lintCareer(root, ':');
    }
  }
}

export function prePush(root, input) {
  assertCommitted(root);
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const [, localSha] = line.trim().split(/\s+/);
    if (/^0+$/.test(localSha)) continue;
    lint(root, localSha);
  }
}

export function commandKind(input) {
  const command = String(input?.command ?? input?.cmd ?? '');
  // Git hooks enforce the actual operation even for shell aliases or wrappers.
  if (/\bgit(?:\.exe)?\b[^\r\n;&|]*\bpush\b/i.test(command)) return 'push';
  if (/\bgit(?:\.exe)?\b[^\r\n;&|]*\bcommit\b/i.test(command)) return 'commit';
  return null;
}

export async function hook(root, input) {
  if (input.hook_event_name === 'Stop') {
    try { assertCommitted(root); }
    catch (error) { return { decision: 'block', reason: error.message }; }
  } else if (input.hook_event_name === 'PreToolUse') {
    const kind = commandKind(input.tool_input);
    try {
      if (kind === 'commit') await sync(root);
      if (kind === 'push') assertCommitted(root);
    } catch (error) {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: error.message } };
    }
  }
  return {};
}

export async function main(mode = process.argv[2]) {
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).toString().trim();
  if (mode === 'sync') await sync(root);
  else if (mode === 'sync-resume') await syncResume(root);
  else if (mode === 'sync-career') await syncCareer(root);
  else if (mode === 'lint') assertCommitted(root);
  else if (mode === 'check-pdf') lint(root);
  else if (mode === 'pre-commit') await preCommit(root);
  else if (mode === 'pre-push') prePush(root, fs.readFileSync(0, 'utf8'));
  else if (mode === 'hook') {
    const result = await hook(root, JSON.parse(fs.readFileSync(0, 'utf8')));
    if (Object.keys(result).length) process.stdout.write(JSON.stringify(result));
  } else throw Error('Unknown resume guard command: ' + mode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error('[resume] ' + error.message); process.exitCode = 2; });
}
