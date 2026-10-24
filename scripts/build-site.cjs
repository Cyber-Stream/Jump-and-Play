const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
// Only replace the generated output directory inside this checkout.
if (fs.existsSync(output) && (fs.lstatSync(output).isSymbolicLink() || path.relative(root, fs.realpathSync(output)) !== 'public')) {
  throw new Error('Refusing to replace output outside the project.');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const html = fs.readFileSync(path.join(root, 'jumpplay_website (Shafin&Zawad).html'), 'utf8');
fs.writeFileSync(path.join(output, 'index.html'), html);
const files = new Set();
const enqueue = value => {
  if (!value.startsWith('/assets/')) return;
  const relative = value.split(/[?#]/)[0].slice(1);
  const source = path.resolve(root, relative);
  if (!source.startsWith(path.join(root, 'assets') + path.sep)) throw new Error('Invalid asset path');
  files.add(relative);
};
for (const match of html.matchAll(/(?:src|href|poster)="([^"]+)"/g)) enqueue(match[1]);
for (const relative of files) {
  const source = path.join(root, relative);
  if (relative.endsWith('.css')) {
    const css = fs.readFileSync(source, 'utf8');
    for (const match of css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) enqueue(match[1]);
  }
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
console.log(`Static website built in public/ with ${files.size} referenced assets.`);
