/**
 * The Amp variant must reach the fab intact, beside the Orca and OpenCode one. These are static checks:
 * they read the fab's own workflow files, so a rewrite that drops a thread, a report or a setting fails here.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { FAB } from './helpers.mjs';

const WORKFLOWS = join(FAB, '.factory', 'workflows');
const MODEL_KEYS = ['amp-model-coding', 'amp-model-review'];

const workflow = (name) => readFileSync(join(WORKFLOWS, name, 'SKILL.md'), 'utf8');

function has(text, needle, where) {
  assert.ok(text.includes(needle), `${where} does not name \`${needle}\``);
}

test('start-plan keeps the Amp worker and its clean-up beside the Orca worker', () => {
  const text = workflow('start-plan');
  const where = 'start-plan';

  // The detection rule every Amp variant branches on.
  has(text, 'AMP_THREAD_ID', where);
  has(text, 'create_thread', where);

  // One Amp worker per plan, in its own orb, from a brief that creates the branch.
  has(text, 'executor', where);
  has(text, 'orb', where);
  has(text, 'parallel-work', where);
  has(text, 'git switch -c <type>/<plan-file-stem>', where);

  // The Orca worker is still there, and its brief names both sub-agent settings.
  has(text, 'orca worktree create', where);
  has(text, 'sub-agent-coding', where);
  has(text, 'sub-agent-review', where);

  // Clean-up: the thread is archived where the Orca worktree is removed.
  has(text, 'archive', where);
  has(text, 'orca worktree rm', where);
});

test('build-plan keeps the Amp sub-agent thread, its models as settings, and the unshallow step', () => {
  const text = workflow('build-plan');
  const where = 'build-plan';

  has(text, 'AMP_THREAD_ID', where);
  has(text, 'create_thread', where);
  has(text, 'delegation', where);
  has(text, 'send_thread_message', where);
  has(text, 'read_thread', where);
  has(text, 'git push` the branch before each thread', where);
  has(text, 'review thread', where);

  // The models are settings, never written into the workflow.
  has(text, 'amp-model-coding', where);
  has(text, 'amp-model-review', where);
  assert.ok(!/deepseek/i.test(text), 'build-plan names a model instead of the amp-model setting');
  assert.ok(!/gpt-6/i.test(text), 'build-plan names a model instead of the amp-model setting');

  // A shallow clone cannot merge the base.
  has(text, '--unshallow', where);
});

test('finish-plan dispatches to Amp threads and the sub-agent settings', () => {
  const text = workflow('finish-plan');
  const where = 'finish-plan';

  has(text, 'create_thread', where);
  has(text, 'Amp thread', where);
  has(text, 'sub-agent-coding', where);
  has(text, 'sub-agent-review', where);
});

test('plan-feature reviews in an Amp thread on the review setting', () => {
  const text = workflow('plan-feature');

  has(text, 'create_thread', 'plan-feature');
  has(text, 'amp-model-review', 'plan-feature');
});

test('no workflow names a model outside the two amp-model settings', () => {
  for (const name of readdirSync(WORKFLOWS)) {
    const lines = workflow(name).split('\n');
    for (const [index, line] of lines.entries()) {
      assert.ok(
        !/deepseek|gpt-6|claude-opus/i.test(line),
        `${name}/SKILL.md:${index + 1} names a model instead of the amp-model setting: ${line.trim()}`,
      );
      if (/model/i.test(line)) {
        assert.ok(
          MODEL_KEYS.some((key) => line.includes(key)),
          `${name}/SKILL.md:${index + 1} names a model that is not a setting: ${line.trim()}`,
        );
      }
    }
  }
});
