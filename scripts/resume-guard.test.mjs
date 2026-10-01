import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config, fingerprints, hash, git } from './resume-common.mjs';
import { lint, assertCommitted, preCommit, prePush, hook, commandKind } from './resume-guard.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-guard-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Resume test']);
  git(root, ['config', 'user.email', 'resume-test@example.invalid']);
  const hookDir = path.join(root, 'empty-hooks');
  fs.mkdirSync(hookDir);
  git(root, ['config', 'core.hooksPath', hookDir]);
  fs.writeFileSync(path.join(root, 'resume.config.json'), JSON.stringify({html:'index.html',pdf:'resume.pdf',manifest:'.resume-build.json',inputs:['index.html']}));
  fs.writeFileSync(path.join(root, 'index.html'), '<p>initial</p>\n');
  fs.writeFileSync(path.join(root, 'resume.pdf'), 'fixture PDF');
  receipt(root);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'initial']);
  return root;
}
function receipt(root) {
  const cfg = config(root);
  fs.writeFileSync(path.join(root, cfg.manifest), JSON.stringify({inputs:fingerprints(root,cfg),pdfSha256:hash(fs.readFileSync(path.join(root,cfg.pdf)))}));
}
test('clean matching resume passes; unrelated drafts do not block', t => {
  const root=fixture(t);
  fs.writeFileSync(path.join(root,'unrelated-draft.md'),'draft');
  assert.doesNotThrow(()=>assertCommitted(root));
});
test('editing HTML makes the old PDF stale and blocks Stop and push', async t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'index.html'),'<p>new</p>');
  assert.throws(()=>lint(root),/out of sync/);
  assert.equal((await hook(root,{hook_event_name:'Stop'})).decision,'block');
  assert.equal((await hook(root,{hook_event_name:'PreToolUse',tool_input:{cmd:'git push origin main'}})).hookSpecificOutput.permissionDecision,'deny');
});
test('changing PDF without its receipt is detected', t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'resume.pdf'),'changed');
  assert.throws(()=>lint(root),/PDF changed/);
});
test('partially staged source is rejected before generation', async t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'index.html'),'staged');
  git(root,['add','index.html']);
  fs.appendFileSync(path.join(root,'index.html'),'unstaged');
  await assert.rejects(preCommit(root),/partially staged/);
});
test('pre-commit stages matching PDF and receipt; Stop requires the commit', async t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'index.html'),'new');
  fs.writeFileSync(path.join(root,'resume.pdf'),'new PDF');
  receipt(root);
  git(root,['add','index.html']);
  await preCommit(root);
  assert.doesNotThrow(()=>lint(root,':'));
  assert.throws(()=>assertCommitted(root),/must be committed/);
  git(root,['commit','-qm','change']);
  assert.deepEqual(await hook(root,{hook_event_name:'Stop'}),{});
});
test('pre-push checks the actual outgoing commit, not only current HEAD', t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'index.html'),'stale');
  git(root,['add','index.html']); git(root,['commit','-qm','stale']);
  const bad=git(root,['rev-parse','HEAD']).toString().trim();
  fs.writeFileSync(path.join(root,'resume.pdf'),'fixed PDF'); receipt(root);
  git(root,['add','.']); git(root,['commit','-qm','fixed']);
  const good=git(root,['rev-parse','HEAD']).toString().trim();
  assert.doesNotThrow(()=>prePush(root,'refs/heads/main '+good+' refs/heads/main '+'0'.repeat(40)));
  assert.throws(()=>prePush(root,'refs/heads/old '+bad+' refs/heads/old '+'0'.repeat(40)),/out of sync/);
});
test('commit and push commands from both agents are recognized', () => {
  assert.equal(commandKind({command:'git -C "G:/folder with spaces" commit -m "update"'}),'commit');
  assert.equal(commandKind({cmd:'git.exe push origin main'}),'push');
  assert.equal(commandKind({command:'git status --short'}),null);
});
