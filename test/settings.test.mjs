import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DEFAULTS, SETTINGS_MISSING, parseSettings, readSettings } from '../.factory/scripts/lib.mjs';
import { FAB, git, json, repoFrom, runScript } from './helpers.mjs';

const table = (rows) => ['# Settings', '', '| Setting | Value | Meaning |', '| --- | --- | --- |', ...rows, ''].join('\n');
const row = (key, value) => `| \`${key}\` | ${value} | What it means. |`;

test('a value is read, and an absent key keeps its template default', () => {
  const { values, keys, errors, warnings } = parseSettings(table([row('trunk', '`develop`')]));
  assert.equal(values.trunk, 'develop');
  assert.equal(values.plans, DEFAULTS.plans);
  assert.equal(values.roadmap, DEFAULTS.roadmap);
  assert.deepEqual(keys, ['trunk']);
  assert.deepEqual(warnings, []);
  // The default for `verify` is still `<set me>`, so it is reported even though the key is absent.
  assert.equal(values.verify, '<set me>');
  assert.ok(errors.some((e) => e.includes('"verify"') && e.includes('<set me>')));
});

test('CRLF and a BOM are accepted', () => {
  const text = `\uFEFF${table([row('trunk', '`develop`'), row('plans', '`docs/work/plans`')]).replace(/\n/g, '\r\n')}`;
  const { values, errors } = parseSettings(text);
  assert.equal(values.trunk, 'develop');
  assert.equal(values.plans, 'docs/work/plans');
  assert.deepEqual(errors.filter((e) => !e.includes('verify')), []);
});

test('one pair of backticks is stripped and the rest of the cell is kept as written', () => {
  const { values } = parseSettings(table([row('trunk', '``main``'), row('setup', 'npm install && npm test')]));
  assert.equal(values.trunk, '`main`');
  assert.equal(values.setup, 'npm install && npm test');
});

test('an escaped pipe in a command value survives', () => {
  const { values } = parseSettings(table([row('check-changed', '`npm test \\| tee results.log`')]));
  assert.equal(values['check-changed'], 'npm test | tee results.log');
});

test('an unknown key is a warning that suggests the setting meant', () => {
  const { values, warnings, errors } = parseSettings(table([row('trunck', '`develop`')]));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unknown setting "trunck"/);
  assert.match(warnings[0], /did you mean "trunk"\?/);
  assert.equal(values.trunk, DEFAULTS.trunk);
  assert.ok(errors.some((e) => e.includes('"verify"')));
});

test('a <set me> value is an error that names the key', () => {
  const { errors } = parseSettings(table([row('verify', '`<set me>`')]));
  const found = errors.find((e) => e.includes('<set me>'));
  assert.ok(found, errors.join('\n'));
  assert.match(found, /"verify"/);
  assert.match(found, /^docs\/factory\.md:\d+:/);
});

test('a key set twice names both lines and keeps the first value', () => {
  const text = table([row('trunk', '`develop`'), row('plans', '`docs/plans`'), row('trunk', '`main`'), row('verify', '`node --test`')]);
  const { values, errors } = parseSettings(text);
  const found = errors.find((e) => e.includes('set twice'));
  assert.ok(found, errors.join('\n'));
  assert.match(found, /"trunk"/);
  assert.match(found, /first on line 5/);
  assert.match(found, /^docs\/factory\.md:7:/);
  assert.equal(values.trunk, 'develop');
});

test('a missing settings file returns the defaults and says how to create it', () => {
  const { values, errors, warnings } = readSettings({ read: () => undefined });
  assert.deepEqual(errors, [SETTINGS_MISSING]);
  assert.deepEqual(warnings, []);
  assert.deepEqual(values, { ...DEFAULTS });
  assert.equal(SETTINGS_MISSING, 'docs/factory.md is missing: copy .factory/templates/setup/factory.md there and set its values');
});

test('the amp model settings are returned as written, and are empty by default', () => {
  const sentinel = parseSettings(table([row('amp-model-coding', '`vendor/coding-model`'), row('amp-model-review', '`vendor/review-model`'), row('verify', '`node --test`')]));
  assert.equal(sentinel.values['amp-model-coding'], 'vendor/coding-model');
  assert.equal(sentinel.values['amp-model-review'], 'vendor/review-model');
  assert.equal(DEFAULTS['amp-model-coding'], '');
  assert.equal(DEFAULTS['amp-model-review'], '');
});

test('the setup template lists every setting and leaves the amp models empty', () => {
  const text = readFileSync(join(FAB, '.factory', 'templates', 'setup', 'factory.md'), 'utf8');
  const { values, keys } = parseSettings(text);
  assert.deepEqual([...keys].sort(), [...Object.keys(DEFAULTS)].sort());
  assert.equal(values['amp-model-coding'], '');
  assert.equal(values['amp-model-review'], '');
  assert.equal(values.verify, '<set me>');
});

test('settings are read at the ref, not from the working tree', () => {
  const dir = repoFrom('numbered');
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'the fixture']);
  const sha = git(dir, ['rev-parse', 'HEAD']);

  // The working tree moves the docs elsewhere and names another trunk; the commit keeps the original settings.
  writeFileSync(
    join(dir, 'docs', 'factory.md'),
    table([row('trunk', '`next`'), row('verify', '`node --test`'), row('plans', '`docs/work/plans`'), row('plan-names', '`numbered`'), row('roadmap', '`docs/work/roadmap.md`')]),
  );
  const workPlans = join(dir, 'docs', 'work', 'plans');
  mkdirSync(workPlans, { recursive: true });
  writeFileSync(join(workPlans, '1.001-other.md'), ['---', 'title: "feat: another plan"', 'status: ready', 'kind: feature', 'owns:', '  - docs/**', 'proves: "node --test"', '---', '', '# Another plan', ''].join('\n'));
  writeFileSync(join(dir, 'docs', 'work', 'roadmap.md'), ['---', 'updated: 2026-11-15', '---', '', '# Roadmap', '', '- [ ] [1.001 Another](plans/1.001-other.md): the working tree', ''].join('\n'));

  const probe = join(dir, '.factory', 'scripts', 'probe.mjs');
  writeFileSync(probe, ["import { fileSource, readSettings } from './lib.mjs';", 'const source = fileSource(process.argv[2]);', 'const s = readSettings(source).values;', 'console.log(JSON.stringify({ plans: s.plans, roadmap: s.roadmap, trunk: s.trunk }));', ''].join('\n'));

  const atRef = runScript(dir, 'probe.mjs', [sha]);
  assert.equal(atRef.status, 0, atRef.stderr);
  assert.deepEqual(json(atRef), { plans: 'docs/plans', roadmap: 'docs/roadmap.md', trunk: 'main' });

  const working = runScript(dir, 'probe.mjs');
  assert.deepEqual(json(working), { plans: 'docs/work/plans', roadmap: 'docs/work/roadmap.md', trunk: 'next' });

  // next.mjs reads the same source for both its settings and its documents. `gh` finds no remote in this
  // temporary repository, so the claim read comes back empty rather than reaching the network.
  const fromRef = json(runScript(dir, 'next.mjs', ['--ref', sha, '--json']));
  assert.equal(fromRef.ref, sha);
  assert.equal(fromRef.prClaimsRead, false);
  assert.ok(fromRef.ready.some((r) => r.plan === 'docs/plans/1.004-docs.md'), fromRef.ready.map((r) => r.plan).join(', '));
  assert.ok(!fromRef.ready.some((r) => r.plan.startsWith('docs/work/')));

  const fromTree = json(runScript(dir, 'next.mjs', ['--json']));
  assert.deepEqual(fromTree.ready.map((r) => r.plan), ['docs/work/plans/1.001-other.md']);
});
