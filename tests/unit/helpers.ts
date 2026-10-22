import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';

export const ROOT = path.resolve(__dirname, '../..');
export const MINI = path.join(ROOT, 'tests/fixtures/minipack');

export interface BuildRun { code: number; errors: { where: string; message: string }[]; stdout: string; buildErrorsMd: string | null }

/**
 * Copy the fixture pack to a temp dir, let `mutate` break it, and run the real content build over it with every
 * output redirected (BX_PACK / BX_OUT), so src/data is never touched. Returns the exit code and the errors.
 */
export function runBuild(mutate: (dir: string) => void = () => {}): BuildRun {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-pack-'));
  const pack = path.join(tmp, 'pack');
  const out = path.join(tmp, 'out');
  fs.cpSync(MINI, pack, { recursive: true });
  mutate(pack);
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync(path.join(ROOT, 'node_modules/.bin/tsx'), [path.join(ROOT, 'scripts/build-content.ts')], {
      env: { ...process.env, BX_PACK: pack, BX_OUT: out, BX_ERRORS_FILE: path.join(pack, 'BUILD-ERRORS.md'), BX_SKIP_HR_VALIDATOR: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { status: number; stdout: string };
    code = err.status; stdout = err.stdout;
  }
  const ef = path.join(out, 'src/data/build-errors.json');
  const errors = fs.existsSync(ef) ? JSON.parse(fs.readFileSync(ef, 'utf8')) : [];
  const mdPath = path.join(pack, 'BUILD-ERRORS.md');
  const buildErrorsMd = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : null;
  fs.rmSync(tmp, { recursive: true, force: true });
  return { code, errors, stdout, buildErrorsMd };
}

/** Load a YAML file of the pack copy, change it, write it back. */
export function editYaml<T>(dir: string, file: string, change: (data: T) => void) {
  const p = path.join(dir, file);
  const data = yaml.load(fs.readFileSync(p, 'utf8')) as T;
  change(data);
  fs.writeFileSync(p, yaml.dump(data));
}

export const loadYaml = <T,>(dir: string, file: string) => yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')) as T;
