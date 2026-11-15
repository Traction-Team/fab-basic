import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { repoFrom, runScript, withoutGh } from './helpers.mjs';

test('a workspace with no feature docs says so and stops cleanly', () => {
  const result = runScript(repoFrom('numbered'), 'feature.mjs', [], { env: withoutGh() });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No feature docs/);
  assert.match(result.stdout, /`features` is empty in docs\/factory\.md/);
});

test('every feature is one line: code, title, status and progress', () => {
  const result = runScript(repoFrom('dated'), 'feature.mjs', [], { env: withoutGh() });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ONB\s+Onboarding · building · 1 of 3 plans merged · docs\/features\/onb-onboarding\.md/);
});

test('one feature prints its table, in code order, with stages and needs', () => {
  const result = runScript(repoFrom('dated'), 'feature.mjs', ['ONB'], { env: withoutGh() });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# ONB · Onboarding · building/);
  assert.match(result.stdout, /\| Done \| Code \| Stage \| Plan \| Status \| PR \| Stacked \| Needs \| Branch \|/);
  assert.match(result.stdout, /\| \[x\] \| \*\*ONB-1\*\* \| 1 \|/);
  assert.match(result.stdout, /\| \[ \] \| \*\*ONB-2\*\* \| 2 \|/);
  assert.match(result.stdout, /\| \[ \] \| \*\*ONB-3\*\* \| 3 \|/);
  // No `gh`: the pull request number still shows, just without a link.
  assert.match(result.stdout, /\| #3 \|/);
  assert.match(result.stdout, /\*\*ONB-3\*\*/);
  assert.match(result.stdout, /onb-3-/);
});

test('--write regenerates the table between the markers', () => {
  const dir = repoFrom('dated');
  const file = join(dir, 'docs', 'features', 'onb-onboarding.md');
  const before = readFileSync(file, 'utf8');
  assert.match(before, /<!-- factory:plans:start[^\n]*-->\n\n<!-- factory:plans:end -->/);
  const result = runScript(dir, 'feature.mjs', ['ONB', '--write'], { env: withoutGh() });
  assert.equal(result.status, 0, result.stderr);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<!-- factory:plans:start[^\n]*-->\n\n1 of 3 plans merged\./);
  assert.match(after, /\*\*ONB-1\*\*/);
  assert.match(after, /<!-- factory:plans:end -->/);
});

test('an unknown feature code fails and lists the codes there are', () => {
  const result = runScript(repoFrom('dated'), 'feature.mjs', ['NOPE'], { env: withoutGh() });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No feature doc with code NOPE\. Features: ONB/);
});
