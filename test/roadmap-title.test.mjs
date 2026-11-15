import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoadmap } from '../.factory/scripts/lib.mjs';

const settings = { plans: 'docs/plans', roadmap: 'docs/roadmap.md' };
const parse = (line) => parseRoadmap(`---\nupdated: 2026-11-15\n---\n\n${line}\n`, settings).lines[0];

test('a line with no plan link is named after the text before the first ": "', () => {
  const line = parse('- [ ] Due dates: ... ([spec](specs/todo.md#due-dates))');
  assert.equal(line.title, 'Due dates');
});

test('a bold line is named after its bold text, colon and all', () => {
  const line = parse('- [ ] **Pre-release fixes** — needs a plan · git+file:///srv/fab · ([intake](intake/2026-11-10-x.md))');
  assert.equal(line.title, 'Pre-release fixes');
});

test('a plan-linked line is named after the plan link', () => {
  const line = parse('- [ ] [1.004 The process doc](plans/1.004-docs.md): what it adds');
  assert.equal(line.title, '1.004 The process doc');
});

test('a line whose first link is a spec is still named after the plan link', () => {
  const line = parse('- [ ] First the spec ([spec](specs/todo.md)) and then the plan ([1.005 The check](plans/1.005-check.md))');
  assert.equal(line.title, '1.005 The check');
});

test('a line with no bold text and no ": " keeps its first 80 characters, with links reduced to their text', () => {
  const text = 'This repository keeps plans ... from [its draft](specs/next/metastore-cloud.md))';
  const line = parse(`- [ ] ${text}`);
  const expected = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').slice(0, 80).trim();
  assert.equal(line.title, expected);
  assert.equal(line.title, 'This repository keeps plans ... from its draft)');
});

test('links are { text, path } pairs, resolved against the roadmap and without their anchor', () => {
  const line = parse('- [ ] First ([spec](specs/todo.md#due-dates)) then the plan ([1.005 The check](plans/1.005-check.md))');
  assert.deepEqual(line.links, [
    { text: 'spec', path: 'docs/specs/todo.md' },
    { text: '1.005 The check', path: 'docs/plans/1.005-check.md' },
  ]);
});

test('a record keeps its checkbox, its section and its line number', () => {
  const text = ['---', 'updated: 2026-11-15', '---', '', '## Milestone 1', '', '- [x] [1.001 Foundation](plans/1.001-foundation.md): done', ''].join('\n');
  const { data, lines } = parseRoadmap(text, settings);
  assert.deepEqual(data, { updated: '2026-11-15' });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].done, true);
  assert.equal(lines[0].section, 'Milestone 1');
  assert.equal(lines[0].line, 4);
  assert.equal(lines[0].title, '1.001 Foundation');
});
