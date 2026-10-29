// Builds the app into dist/ with esbuild: one minified JS file and one CSS file, named by content hash
// so phones and GitHub Pages never serve a stale copy. Static files are copied alongside.
import { build, context } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out + '/runners', { recursive: true });

const opts = {
  entryPoints: ['src/main.tsx'], bundle: true, outdir: out, entryNames: 'app-[hash]',
  minify: !watch, sourcemap: watch ? 'inline' : false, format: 'iife', jsx: 'automatic',
  target: ['es2020'], metafile: true, legalComments: 'none',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
};

function writeHtml(meta) {
  const files = Object.keys(meta.outputs).map((f) => f.replace(out + '/', ''));
  const js = files.find((f) => f.endsWith('.js')), css = files.find((f) => f.endsWith('.css'));
  const html = readFileSync('index.html', 'utf8').replace('%JS%', js).replace('%CSS%', css);
  writeFileSync(out + '/index.html', html);
  for (const f of readdirSync('public')) cpSync('public/' + f, out + '/' + f, { recursive: true });
  if (existsSync('data.json')) cpSync('data.json', out + '/data.json');
  cpSync('runners/background.js', out + '/runners/background.js');
  const size = (f) => (readFileSync(out + '/' + f).length / 1024).toFixed(1) + ' KB';
  console.log('built', js, size(js), '|', css, size(css));
}

if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'html', setup(b) { b.onEnd((r) => r.metafile && writeHtml(r.metafile)); } }] });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log('Nivo dev server on http://localhost:' + port);
} else {
  const r = await build(opts);
  writeHtml(r.metafile);
}
