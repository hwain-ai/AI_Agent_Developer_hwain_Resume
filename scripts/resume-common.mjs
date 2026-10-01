import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

export function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
}
export function read(root, file, ref = null) {
  return ref === null ? fs.readFileSync(path.join(root, file)) : git(root, ['show', ref === ':' ? ':' + file : ref + ':' + file]);
}
export const hash = data => createHash('sha256').update(data).digest('hex');
export function inputHash(file, data) {
  return hash(/\.(html|json|mjs|css)$/.test(file) ? data.toString('utf8').replace(/\r\n/g, '\n') : data);
}
export const config = (root, ref = null) => JSON.parse(read(root, 'resume.config.json', ref));
export function fingerprints(root, cfg, ref = null) {
  return Object.fromEntries(cfg.inputs.map(file => [file, inputHash(file, read(root, file, ref))]));
}
export function dependency(name) {
  const require = createRequire(import.meta.url);
  try { return require(name); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', name);
    if (!fs.existsSync(bundled)) throw Error('Missing ' + name + '. Run npm install.');
    console.error('[resume] Using bundled dependency: ' + bundled);
    return require(bundled);
  }
}
