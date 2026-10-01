import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
try {
  // Hook runtimes may start in a repository subdirectory.
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true }).trim();
  process.chdir(root);
  const { main } = await import(pathToFileURL(path.join(root, 'scripts/resume-guard.mjs')).href);
  await main('hook');
} catch (error) { console.error('[resume] ' + error.message); process.exitCode = 2; }
