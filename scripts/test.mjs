// Compiles tests/*.test.ts with esbuild and runs them with Node's built-in test runner.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => 'tests/' + f);
rmSync('.test-build', { recursive: true, force: true });
await build({ entryPoints: files, bundle: true, platform: 'node', format: 'esm', outdir: '.test-build', outExtension: { '.js': '.mjs' }, jsx: 'automatic', logLevel: 'warning', loader: { '.json': 'json' } });
const out = files.map((f) => '.test-build/' + f.slice(6).replace(/\.ts$/, '.mjs'));
const r = spawnSync(process.execPath, ['--test', ...out], { stdio: 'inherit', env: { ...process.env, TZ: 'Asia/Karachi' } });
process.exit(r.status ?? 1);
