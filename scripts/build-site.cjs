const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'jumpplay_website (Shafin&Zawad).html'), path.join(output, 'index.html'));
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
for (const name of ['jumpplay-hero.mp4', 'jumpplay-action-highlight.mp4', 'jumpplay-action-highlight-poster.jpg']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
console.log('Static website built in public/');
