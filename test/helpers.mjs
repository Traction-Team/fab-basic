/**
 * Test helpers: a temporary repository holding a fixture's docs and a copy of the factory's scripts, plus a runner that keeps `gh` out of reach. No test reaches the network: the fixtures are local files and the only child processes are `node` and `git`.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = join(FAB, 'test', 'fixtures');

export function tempDir(prefix = 'fab-basic-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A temporary repository: the fixture's docs, plus the factory's scripts, so the scripts' own root is the temporary directory. */
export function repoFrom(fixture) {
  const dir = tempDir();
  cpSync(join(FIXTURES, fixture), dir, { recursive: true });
  cpSync(join(FAB, '.factory', 'scripts'), join(dir, '.factory', 'scripts'), { recursive: true });
  return dir;
}

/** Runs one factory script in a repository. Returns its status and both streams, so a failing run is asserted rather than thrown. */
export function runScript(dir, script, args = [], options = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(dir, '.factory', 'scripts', script), ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

export function json(result) {
  return JSON.parse(result.stdout);
}

/** An environment with an empty `PATH`, so neither `gh` nor `git` is found. Scripts handle both being unavailable. */
export function withoutGh() {
  const bin = join(tempDir('fab-basic-bin-'), 'bin');
  mkdirSync(bin, { recursive: true });
  return { ...process.env, PATH: bin };
}

export function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
