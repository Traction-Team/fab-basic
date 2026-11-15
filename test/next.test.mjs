import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { json, repoFrom, runScript, withoutGh } from './helpers.mjs';

const next = (dir, args = []) => runScript(dir, 'next.mjs', ['--json', ...args], { env: withoutGh() });

/** Rewrites the roadmap's `stacking` row. */
function setStacking(dir, value) {
  const file = join(dir, 'docs', 'factory.md');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/(\| `stacking` \| )([^|]*)( \|)/, `$1\`${value}\`$3`));
}

test('with stacking off, a plan whose need is building is blocked and the rest are ready in roadmap order', () => {
  const result = next(repoFrom('numbered'));
  assert.equal(result.status, 0, result.stderr);
  const out = json(result);
  assert.equal(out.ref, 'working tree');
  assert.equal(out.prClaimsRead, false);
  assert.deepEqual(out.ready.map((r) => r.plan), ['docs/plans/1.004-docs.md', 'docs/plans/1.005-check.md']);
  assert.deepEqual(out.ready.map((r) => r.rank.position), [3, 4]);
  assert.deepEqual(out.ready[0].stackedOn, []);
  assert.deepEqual(out.blocked.map((b) => b.plan), ['docs/plans/1.003-templates.md']);
  assert.match(out.blocked[0].reason, /needs 1\.002-settings\.md, which is not merged; stacking is off/);
  assert.deepEqual(out.inFlight.map((f) => f.plan), ['docs/plans/1.002-settings.md']);
  assert.deepEqual(out.unplanned, []);
});

test('with stacking on, a plan whose need is building is ready and carries that need as stackedOn', () => {
  const result = next(repoFrom('dated'));
  assert.equal(result.status, 0, result.stderr);
  const out = json(result);
  assert.deepEqual(out.ready.map((r) => r.plan), ['docs/plans/2026-11-03-onb-3-third.md']);
  assert.deepEqual(out.blocked, []);
  assert.deepEqual(out.ready[0].stackedOn, [{ plan: 'docs/plans/2026-11-02-onb-2-second.md', pr: '5' }]);
});

test('the same dated workspace with stacking off blocks the stacked plan', () => {
  const dir = repoFrom('dated');
  setStacking(dir, 'off');
  const out = json(next(dir));
  assert.deepEqual(out.ready, []);
  assert.deepEqual(out.blocked.map((b) => b.plan), ['docs/plans/2026-11-03-onb-3-third.md']);
  assert.match(out.blocked[0].reason, /stacking is off/);
});

test('a roadmap line with no plan is listed as unplanned, named by the fix', () => {
  const out = json(next(repoFrom('dated')));
  assert.deepEqual(out.unplanned, [{ position: 3, section: '', title: 'Ship the beta' }]);
});

test('a plan no roadmap line links is listed after, as unranked', () => {
  const dir = repoFrom('numbered');
  writeFileSync(
    join(dir, 'docs', 'plans', '1.006-off-roadmap.md'),
    ['---', 'title: "test: a plan off the roadmap"', 'status: ready', 'kind: feature', 'owns:', '  - docs/notes.md', 'proves: "node --test"', '---', ''].join('\n'),
  );
  const out = json(next(dir));
  assert.deepEqual(out.ready.at(-1).plan, 'docs/plans/1.006-off-roadmap.md');
  assert.equal(out.ready.at(-1).rank.position, null);
  assert.equal(out.ready.at(-1).rank.section, 'unranked');
});

test('the text output names what is ready, blocked and in flight', () => {
  const result = runScript(repoFrom('numbered'), 'next.mjs', [], { env: withoutGh() });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Ready \(2\) — from working tree/);
  assert.match(result.stdout, /1\.004-docs\.md/);
  assert.match(result.stdout, /Blocked \(1\)/);
  assert.match(result.stdout, /In flight \(1\)/);
});
