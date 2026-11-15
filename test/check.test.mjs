import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { repoFrom, runScript, withoutGh } from './helpers.mjs';

const check = (dir) => runScript(dir, 'check.mjs', [], { env: withoutGh() });

/** Rewrites one settings row, keeping the meaning column, or removes it. */
function setSetting(dir, key, value, { remove = false } = {}) {
  const file = join(dir, 'docs', 'factory.md');
  const lines = readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((line) => line.startsWith(`| \`${key}\` |`));
  assert.ok(at >= 0, `no setting row for ${key}`);
  if (remove) {
    lines.splice(at, 1);
  } else {
    const meaning = lines[at].split('|').slice(3, -1).join('|').trim();
    lines[at] = `| \`${key}\` | ${value === '' ? ' ' : `\`${value}\``} | ${meaning} |`;
  }
  writeFileSync(file, lines.join('\n'));
}

test('the numbered fixture passes', () => {
  const result = check(repoFrom('numbered'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ factory check passed \(5 of 5 plans, docs\/roadmap\.md\)/);
});

test('the dated fixture passes, with feature docs, a sightings folder and a short roadmap', () => {
  const result = check(repoFrom('dated'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ factory check passed \(3 of 3 plans, 1 feature, docs\/roadmap\.md\)/);
});

test('a repository with no plans, intake, changelog or roadmap passes', () => {
  // The fab's own repository holds no docs beyond its settings, so check.mjs must read absent directories as empty.
  const dir = repoFrom('numbered');
  for (const name of ['plans', 'intake', 'changelog']) rmSync(join(dir, 'docs', name), { recursive: true });
  rmSync(join(dir, 'docs', 'roadmap.md'));
  const result = check(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ factory check passed \(0 of 0 plans, no roadmap yet\)/);
});

test('a workspace without docs/factory.md says how to create it', () => {
  const dir = repoFrom('numbered');
  rmSync(join(dir, 'docs', 'factory.md'));
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\/factory\.md is missing: copy \.factory\/templates\/setup\/factory\.md there and set its values/);
});

test('a settings file with no settings table is reported as such', () => {
  const dir = repoFrom('numbered');
  writeFileSync(join(dir, 'docs', 'factory.md'), '# Settings\n\nNothing here yet.\n');
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no "\| Setting \| Value \|" table/);
});

test('a missing setting fails, naming the key', () => {
  const dir = repoFrom('numbered');
  setSetting(dir, 'verify', '', { remove: true });
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"verify"/);
  assert.match(result.stderr, /<set me>/);
});

test('a release branch equal to the trunk fails when release is on', () => {
  const dir = repoFrom('numbered');
  setSetting(dir, 'release', 'on');
  setSetting(dir, 'release-branch', 'main');
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release-branch is "main", the same as trunk/);
});

test('a missing release guide fails when release is on', () => {
  const dir = repoFrom('numbered');
  setSetting(dir, 'release', 'on');
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release-guide docs\/releasing\.md does not exist/);
});

test('more open roadmap lines than roadmap-max-lines allows fails', () => {
  const dir = repoFrom('dated');
  setSetting(dir, 'roadmap-max-lines', '1');
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has 3 open lines; it holds at most 1/);
});

test('a plan file name from the other scheme is rejected', () => {
  const dir = repoFrom('numbered');
  writeFileSync(join(dir, 'docs', 'plans', '2026-11-15-date-named.md'), ['---', 'title: "feat: a dated name"', 'status: ready', 'kind: feature', 'owns:', '  - docs/**', 'proves: "node --test"', '---', ''].join('\n'));
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /plan files are named <round>\.<NNN>-<slug>\.md/);
});

test('a plan code is rejected when features is empty', () => {
  const dir = repoFrom('dated');
  setSetting(dir, 'features', '');
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /features is empty/);
});

test('a sightings folder with no note beside it is rejected', () => {
  const dir = repoFrom('dated');
  rmSync(join(dir, 'docs', 'intake', '2026-11-11-invite-twice.md'));
  const result = check(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /holds sightings of docs\/intake\/2026-11-11-invite-twice\.md, which does not exist/);
});
