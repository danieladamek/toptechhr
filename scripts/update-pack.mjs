/**
 * npm run update:pack (KICKOFF §2.3): move the pinned Key Personnel pack to its newest `pack-*` tag.
 *
 * Lists the pack repo's tags matching `pack-*`; if one sorts after the pinned tag (package.json → toptechhr.packTag),
 * checks the submodule out at it, rewrites packTag, then runs `npm run build:content` and the HR-layer validator.
 * Exits non-zero if either fails, so the pull request the weekly workflow opens shows red. With nothing newer it says
 * so and exits 0 without touching anything. Writes `moved=<tag>` to $GITHUB_OUTPUT when it moves the pin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUB = path.join(ROOT, 'pack', 'key-personnel');
const PKG = path.join(ROOT, 'package.json');
const git = (...args) => execFileSync('git', ['-C', SUB, ...args], { encoding: 'utf8' }).trim();

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const pinned = pkg.toptechhr?.packTag;
if (!pinned) { console.error('package.json has no toptechhr.packTag'); process.exit(1); }
if (!fs.existsSync(path.join(SUB, '.git'))) { console.error(`${path.relative(ROOT, SUB)} is not a checked-out submodule (git submodule update --init)`); process.exit(1); }

git('fetch', '--tags', '--force', 'origin');
// pack-YYYY-MM-DD tags sort by name; a same-day re-tag (pack-YYYY-MM-DD.2) sorts after its base
const tags = git('tag', '--list', 'pack-*').split('\n').filter(Boolean).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const newest = tags.at(-1);
console.log(`pinned ${pinned}; pack tags: ${tags.join(', ') || '(none)'}`);
if (!newest || newest.localeCompare(pinned, 'en', { numeric: true }) <= 0) { console.log('nothing newer — the pin stays'); process.exit(0); }

git('checkout', '--quiet', newest);
pkg.toptechhr.packTag = newest;
fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
console.log(`moved the pack to ${newest}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `moved=${newest}\n`);

const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
const content = run('npm', ['run', 'build:content']);
const hr = run('python3', ['tools/validate_hr_layer.py', 'hr-layer', 'pack/key-personnel/content-pack']);
if (content !== 0 || hr !== 0) {
  console.error(`the new pack does not build cleanly: build:content exit ${content}, validate_hr_layer exit ${hr}`);
  process.exit(1);
}
