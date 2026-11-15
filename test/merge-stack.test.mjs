import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { repoFrom, runScript, stubGh, withoutGh } from './helpers.mjs';

test('merge-stack refuses to run while stacking is off', () => {
  const result = runScript(repoFrom('numbered'), 'merge-stack.mjs', ['12'], { env: withoutGh() });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /merge-stack: stacking is off in docs\/factory\.md/);
});

test('with stacking on it reads the chain, and reports when gh is unavailable rather than crashing', () => {
  const result = runScript(repoFrom('dated'), 'merge-stack.mjs', ['12', '--dry-run'], { env: withoutGh() });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^merge-stack: /);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('a missing pull request number prints the usage line', () => {
  const result = runScript(repoFrom('dated'), 'merge-stack.mjs', [], { env: withoutGh() });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: node \.factory\/scripts\/merge-stack\.mjs <top pull request number> \[--dry-run\]/);
});

/**
 * A stand-in for `gh`. It answers `pr view` with the pull request in `state.json`, where the head is `head` on the first read and `headAfter` on every later one (so a push during the run can be played back), and answers the merge request with `mergeReply`. Every call is appended to `calls.log`.
 */
const STUB_GH = [
  '#!/usr/bin/env node',
  "import { appendFileSync, existsSync, readFileSync } from 'node:fs';",
  "import { join } from 'node:path';",
  '',
  'const dir = process.env.GH_STUB_DIR;',
  "const calls = join(dir, 'calls.log');",
  'const args = process.argv.slice(2);',
  'const seen = existsSync(calls) ? readFileSync(calls, "utf8").split("\\n").filter(Boolean).map((line) => JSON.parse(line)) : [];',
  'appendFileSync(calls, JSON.stringify(args) + "\\n");',
  "const state = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));",
  "const views = seen.filter((call) => call[0] === 'pr' && call[1] === 'view').length;",
  '',
  "if (args[0] === 'pr' && args[1] === 'view') {",
  '  process.stdout.write(JSON.stringify({',
  '    number: state.number,',
  "    title: 'feat: a stacked plan',",
  "    state: 'OPEN',",
  '    isDraft: false,',
  '    baseRefName: state.base,',
  "    headRefName: 'feat/a',",
  '    headRefOid: views === 0 ? state.head : (state.headAfter ?? state.head),',
  '    statusCheckRollup: [],',
  '  }) + "\\n");',
  "} else if (args[0] === 'pr' && args[1] === 'list') {",
  '  process.stdout.write("[]\\n");',
  "} else if (args[0] === 'api') {",
  '  process.stdout.write(JSON.stringify(state.mergeReply ?? { status: "merged" }) + "\\n");',
  '} else {',
  '  process.stderr.write("stub gh: unexpected call " + args.join(" ") + "\\n");',
  '  process.exit(1);',
  '}',
  '',
].join('\n');

const skipOnWindows = process.platform === 'win32' ? 'a stub gh cannot be launched through execFileSync on Windows' : false;

/** Every call the stub `gh` received, oldest first. */
function callsFrom(dir) {
  const file = join(dir, 'calls.log');
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

test('a merge request pins the head whose checks were read, so the host refuses a head that moved', { skip: skipOnWindows }, () => {
  const { dir, env } = stubGh(STUB_GH, { 'state.json': { number: 12, base: 'main', head: 'aaa' } });
  const result = runScript(repoFrom('dated'), 'merge-stack.mjs', ['12'], { env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /merged #12/);
  const request = callsFrom(dir).find((call) => call[0] === 'api');
  assert.ok(request, 'the merge request was sent');
  assert.ok(request.includes('sha=aaa'), `the merge request carries the inspected head: ${request.join(' ')}`);
});

test('a head that moved after preflight stops the run instead of merging it with the bypass', { skip: skipOnWindows }, () => {
  const { dir, env } = stubGh(STUB_GH, { 'state.json': { number: 12, base: 'main', head: 'aaa', headAfter: 'bbb' } });
  const result = runScript(repoFrom('dated'), 'merge-stack.mjs', ['12'], { env });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /#12's head moved from aaa to bbb/);
  assert.equal(callsFrom(dir).filter((call) => call[0] === 'api').length, 0, 'no merge request is sent for a head nobody inspected');
});
