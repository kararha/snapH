const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 1x1 transparent PNG buffer
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync(path.join(dir, 'sample1.png'), pngBuffer);
fs.writeFileSync(path.join(dir, 'sample2.png'), pngBuffer);

console.log('Fixtures generated in', dir);

