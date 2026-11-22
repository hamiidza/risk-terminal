/* Inlines CSS + JS into one offline file: index.html (no bundler, no network needed). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const parts = {
  CSS: rd('src/style.css'), ENGINE: rd('src/engine.js'), I18N: rd('src/i18n.js'),
  APP: ['app1.js', 'app2.js', 'app3.js'].map((f) => rd('src/' + f)).join('\n')
};
let html = rd('src/template.html');
for (const [k, v] of Object.entries(parts)) {
  if (/<\/script/i.test(v)) throw new Error('forbidden </script in ' + k);
  html = html.replace('/*' + k + '*/', () => v);
}
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('built index.html (' + (html.length / 1024).toFixed(1) + ' KB)');
