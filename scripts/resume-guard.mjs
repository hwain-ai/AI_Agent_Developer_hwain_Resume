import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, fingerprints, hash, git, read } from './resume-common.mjs';

export function lint(root, ref = null) {
  const cfg = config(root, ref);
  const receipt = JSON.parse(read(root, cfg.manifest, ref));
  if (JSON.stringify(receipt.inputs) !== JSON.stringify(fingerprints(root, cfg, ref))) {
    throw Error('HTML/PDF out of sync. Run npm run resume:pdf, then commit HTML, PDF and .resume-build.json together.');
  }
  if (receipt.pdfSha256 !== hash(read(root, cfg.pdf, ref))) throw Error('PDF changed without a matching build receipt. Run npm run resume:pdf.');
}
export function assertCommitted(root) {
  const cfg = config(root);
  const files = [...cfg.inputs, cfg.pdf, cfg.manifest];
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...files]).toString().trim();
  if (dirty) throw Error('Resume changes must be committed before finishing or pushing. Run npm run resume:pdf; git add the resume files; git commit.');
  lint(root);
}
export async function sync(root) {
  try { lint(root); return; } catch (error) { console.error('[resume] Rebuilding: ' + error.message); }
  const { render } = await import('./render-resume.mjs');
  await render(root);
  lint(root);
}
export async function preCommit(root) {
  const cfg = config(root);
  const staged = git(root, ['diff', '--cached', '--name-only', '-z']).toString().split('\0');
  if (![...cfg.inputs, cfg.pdf, cfg.manifest].some(f => staged.includes(f))) return;
  // Do not include unstaged edits in a partially staged commit.
  if (JSON.stringify(fingerprints(root, cfg, ':')) !== JSON.stringify(fingerprints(root, cfg))) {
    throw Error('Resume inputs are partially staged. Stage all intended resume source changes before committing.');
  }
  await sync(root);
  git(root, ['add', '--', cfg.pdf, cfg.manifest]);
  lint(root, ':');
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
