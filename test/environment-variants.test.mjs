/**
 * Each environment's text must reach the fab intact, and only in its own case. These are static
 * checks over the fab's own files: a partial that loses a case, a marker that drifts into another
 * case, or a workflow that hand-writes one harness's steps fails here, before `metafab check` runs.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { FAB } from './helpers.mjs';

const FACTORY = join(FAB, '.factory');
const PARTIALS = join(FACTORY, 'partials');
const WORKFLOWS = join(FACTORY, 'workflows');

const read = (file) => readFileSync(file, 'utf8');
const partial = (name) => read(join(PARTIALS, `${name}.md`));
const workflow = (name) => read(join(WORKFLOWS, name, 'SKILL.md'));

/** The marker each case must carry: the text a preview for that value has to contain. */
const CASES = {
  'sub-agents': {
    variable: 'harness',
    markers: { opencode: 'opencode.json', claude: '.claude/agents/', amp: 'send_thread_message' },
  },
  workers: {
    variable: 'workspace',
    markers: { orca: 'orca worktree create', orb: 'parallel-work', worktree: 'git worktree add' },
  },
  'worker-setup': {
    variable: 'workspace',
    markers: { orca: 'hookSettings', orb: 'already ran', worktree: 'the setup setting' },
  },
  'worker-cleanup': {
    variable: 'workspace',
    markers: { orca: 'orca worktree rm', orb: 'archive the worker thread', worktree: 'git worktree remove' },
  },
};

/** The variable a file switches on, and each case's text. */
function branches(text, where) {
  const variable = /<!-- factory:switch env\.([a-z-]+) -->/.exec(text)?.[1];
  assert.ok(variable, `${where} has no switch directive`);
  const starts = [...text.matchAll(/<!-- factory:case ([a-z -]+) -->/g)];
  assert.ok(starts.length > 0, `${where} has no case`);

  const cases = new Map();
  for (const [index, match] of starts.entries()) {
    const end =
      index + 1 < starts.length
        ? starts[index + 1].index
        : text.indexOf('<!-- factory:endswitch -->', match.index);
    assert.ok(end > match.index, `${where} has a case with no endswitch`);
    for (const value of match[1].trim().split(/\s+/)) {
      cases.set(value, text.slice(match.index + match[0].length, end));
    }
  }
  return { variable, cases };
}

/** Every installed skill file: the workflows and the skills the build copies. */
function installedSkillFiles() {
  const files = [];
  for (const group of ['workflows', 'skills']) {
    const dir = join(FACTORY, group);
    for (const name of readdirSync(dir)) {
      const file = join(dir, name, 'SKILL.md');
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

test('the factory declares one harness per agent tool and one workspace per checkout source', () => {
  const text = read(join(FACTORY, 'factory.yaml'));
  assert.match(text, /^format: 2$/m, 'factory.yaml must be format 2');

  const harness = /harness:\n(?:.*\n)*? {6}(opencode|claude|amp):/;
  assert.match(text, harness, 'env.harness is missing');
  for (const value of ['opencode', 'claude', 'amp']) {
    assert.match(text, new RegExp(`^ {6}${value}:`, 'm'), `harness has no ${value} value`);
  }
  for (const value of ['orca', 'orb', 'worktree']) {
    assert.match(text, new RegExp(`^ {6}${value}:`, 'm'), `workspace has no ${value} value`);
  }
  assert.match(text, /^ {2}workspace:$/m, 'env.workspace is missing');
});

test('each partial is one switch with one case per value', () => {
  for (const [name, { variable, markers }] of Object.entries(CASES)) {
    const { variable: declared, cases } = branches(partial(name), name);
    assert.equal(declared, variable, `${name} switches on the wrong variable`);
    for (const value of Object.keys(markers)) {
      assert.ok(cases.has(value), `${name} has no case for ${value}`);
    }
    assert.equal(cases.size, Object.keys(markers).length, `${name} has an extra case`);
  }
});

test('each case carries its own marker and none of the other cases markers', () => {
  for (const [name, { markers }] of Object.entries(CASES)) {
    const text = partial(name);
    const { cases } = branches(text, name);

    for (const [value, marker] of Object.entries(markers)) {
      const others = Object.entries(markers).filter(([other]) => other !== value);
      assert.ok(cases.get(value).includes(marker), `${name}: the ${value} case does not contain "${marker}"`);
      for (const [other, otherMarker] of others) {
        assert.ok(
          !cases.get(value).includes(otherMarker),
          `${name}: the ${value} case contains the ${other} marker "${otherMarker}"`,
        );
      }
    }
  }
});

test('a marker appears once, in its own partial, so a preview for another value cannot contain it', () => {
  const files = [...readdirSync(PARTIALS).map((file) => join(PARTIALS, file)), ...installedSkillFiles()];
  const texts = new Map(files.map((file) => [file, read(file)]));

  for (const [name, { markers }] of Object.entries(CASES)) {
    for (const [value, marker] of Object.entries(markers)) {
      const owners = [...texts.entries()]
        .filter(([, text]) => text.includes(marker))
        .map(([file]) => file.slice(FACTORY.length + 1));
      assert.deepEqual(
        owners,
        [`partials/${name}.md`],
        `"${marker}" (${name}, ${value}) must appear only in partials/${name}.md`,
      );
    }
  }
});

test('no partial names a sub-agent or a model: both are settings', () => {
  for (const file of readdirSync(PARTIALS)) {
    const text = partial(file.replace(/\.md$/, ''));
    assert.ok(
      !/(?<!sub-)agent-(coding|review|planning)/.test(text),
      `partials/${file} names a sub-agent instead of the setting`,
    );
    assert.ok(
      !/deepseek|gpt-|claude-opus|claude-sonnet|claude-haiku|gemini|grok/i.test(text),
      `partials/${file} names a model`,
    );
  }
});

test('the workflows import the partials where their procedure lives', () => {
  const imports = {
    'build-plan': ['sub-agents', 'worker-setup'],
    'finish-plan': ['sub-agents'],
    'plan-feature': ['sub-agents'],
    'start-plan': ['workers', 'worker-cleanup'],
  };
  for (const [name, names] of Object.entries(imports)) {
    const text = workflow(name);
    for (const partialName of names) {
      assert.ok(
        text.includes(`<!-- factory:import ../../partials/${partialName}.md -->`),
        `${name} does not import partials/${partialName}.md`,
      );
    }
  }
});

test('no workflow description names a harness, a workspace or a sub-agent', () => {
  for (const name of readdirSync(WORKFLOWS)) {
    const description = /^description: (.*)$/m.exec(workflow(name))?.[1] ?? '';
    assert.ok(description.length > 0, `${name} has no description`);
    assert.ok(
      !/Amp|Orca|OpenCode|opencode|Claude|Codex|agent-coding|agent-review|agent-planning/.test(description),
      `${name} names a harness, a workspace or a sub-agent in its description`,
    );
  }
});

test('the standing sub-agent rule is a three-case switch that imports nothing', () => {
  const text = read(join(FACTORY, 'AGENTS.md'));
  const { variable, cases } = branches(text, '.factory/AGENTS.md');
  assert.equal(variable, 'harness');
  assert.deepEqual([...cases.keys()], ['opencode', 'claude', 'amp']);
  assert.ok(!text.includes('factory:import'), '.factory/AGENTS.md imports a partial');
  for (const key of ['sub-agent-coding', 'sub-agent-review', 'sub-agent-planning']) {
    assert.ok(text.includes(key), `.factory/AGENTS.md does not name the ${key} setting`);
  }
});

test('the agent-harnesses skill is gone and nothing in the factory refers to it', () => {
  assert.ok(!existsSync(join(FACTORY, 'skills', 'agent-harnesses')), 'the agent-harnesses skill still exists');
  const files = [...installedSkillFiles(), ...readdirSync(PARTIALS).map((file) => join(PARTIALS, file))];
  for (const file of files) {
    assert.ok(!read(file).includes('agent-harnesses'), `${file.slice(FACTORY.length + 1)} refers to agent-harnesses`);
  }
});
