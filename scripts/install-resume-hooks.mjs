import fs from 'node:fs';
import path from 'node:path';
import { git } from './resume-common.mjs';

const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).toString().trim();
let previous = '';
try { previous = git(root, ['config', '--get', 'core.hooksPath']).toString().trim(); }
catch (error) { if (error.status !== 1) throw error; }
if (previous !== '.githooks') {
  const oldDirectory = previous ? path.resolve(root, previous) : path.join(root, '.git/hooks');
  git(root, ['config', '--local', 'resume.previousHooksPath', oldDirectory]);
  git(root, ['config', '--local', 'core.hooksPath', '.githooks']);
}
console.log('Git hooks installed. Existing hooks are chained through resume.previousHooksPath.');
console.log('Claude: reload this project session. Codex: open /hooks and trust the project PreToolUse and Stop hooks.');
