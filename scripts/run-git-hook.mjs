import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git } from './resume-common.mjs';
import { main } from './resume-guard.mjs';

const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).toString().trim();
const name = process.argv[2];
try {
  // pre-push consumes stdin. Retain it for the existing Git LFS hook too.
  const input = name === 'pre-push' ? fs.readFileSync(0) : undefined;
  if (name === 'pre-push') {
    const { prePush } = await import('./resume-guard.mjs');
    prePush(root, input.toString('utf8'));
  } else if (name === 'pre-commit') await main('pre-commit');
  let previous = '';
  try { previous = git(root, ['config', '--get', 'resume.previousHooksPath']).toString().trim(); }
  catch (error) { if (error.status !== 1) throw error; }
  const oldHook = previous && path.join(previous, name);
  if (oldHook && fs.existsSync(oldHook)) {
    const result = spawnSync('sh', [oldHook, ...process.argv.slice(3)], {
      cwd: root, windowsHide: true, input,
      stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit']
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 2;
  }
} catch (error) { console.error('[resume] ' + error.message); process.exitCode = 2; }
