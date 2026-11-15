import assert from 'node:assert/strict';
import test from 'node:test';
import { repoFrom, runScript, withoutGh } from './helpers.mjs';

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
