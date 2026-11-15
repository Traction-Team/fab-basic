/**
 * Test helpers: a temporary repository holding a fixture's docs and a copy of the factory's scripts, plus a runner that keeps `gh` out of reach. No test reaches the network: the fixtures are local files and the only child processes are `node` and `git`.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
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

/** The first `name` on the current `PATH`, resolved the way the OS does: with `PATHEXT` on Windows. */
function onPath(name) {
  const dirs = Object.entries(process.env)
    .filter(([key]) => key.toLowerCase() === 'path')
    .flatMap(([, value]) => String(value ?? '').split(delimiter));
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      for (const candidate of [`${name}${ext}`, `${name}${ext.toLowerCase()}`]) {
        if (candidate && existsSync(join(dir, candidate))) return join(dir, candidate);
      }
    }
  }
  return undefined;
}

/**
 * An environment whose `PATH` holds only what the test asks for, so `gh` is never found. On Windows the variable is usually spelled `Path`, so every spelling is dropped and one `PATH` is set; scripts and tests then see a single value everywhere.
 *
 * `git: true` adds git, for a test that reads a ref and no `gh`. On Windows git's own directory goes on the path, because an executable shim cannot be launched through `execFileSync`; Git for Windows keeps `gh` in another directory. Elsewhere one link to git is made, so `gh` stays hidden even when both live in the same directory.
 */
export function withoutGh({ git: withGit = false } = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (key.toLowerCase() !== 'path') env[key] = value;
  const bin = join(tempDir('fab-basic-bin-'), 'bin');
  mkdirSync(bin, { recursive: true });
  if (withGit) {
    const gitPath = onPath('git');
    if (!gitPath) throw new Error('git is not on PATH, and this test needs it');
    if (process.platform === 'win32') {
      env.PATH = dirname(gitPath);
    } else {
      symlinkSync(gitPath, join(bin, 'git'));
      env.PATH = bin;
    }
  } else {
    env.PATH = bin;
  }
  return env;
}

export function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
