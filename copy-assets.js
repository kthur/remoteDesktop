const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'app.js',
  'tax-calculator.js',
  'optimizer.js',
  'advisor.js',
  'store.js',
  'styles.css',
  'manifest.json',
  'service-worker.js',
  'favicon.svg',
  'pdf.min.js',
  'pdf.worker.min.js'
];

const destDir = path.join(__dirname, 'www');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

files.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to www/`);
  }
});
