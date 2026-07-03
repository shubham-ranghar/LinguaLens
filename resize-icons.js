import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');

async function resizeIcons() {
  try {
    // Copy favicon-16x16.png to icon16.png
    await sharp(path.join(publicDir, 'favicon-16x16.png'))
      .toFile(path.join(publicDir, 'icon16.png'));
    console.log('✓ Created icon16.png');

    // Copy favicon-32x32.png to icon32.png
    await sharp(path.join(publicDir, 'favicon-32x32.png'))
      .toFile(path.join(publicDir, 'icon32.png'));
    console.log('✓ Created icon32.png');

    // Resize android-chrome-192x192.png to 48x48 as icon48.png
    await sharp(path.join(publicDir, 'android-chrome-192x192.png'))
      .resize(48, 48)
      .toFile(path.join(publicDir, 'icon48.png'));
    console.log('✓ Created icon48.png (resized from 192x192)');

    // Resize android-chrome-512x512.png to 128x128 as icon128.png
    await sharp(path.join(publicDir, 'android-chrome-512x512.png'))
      .resize(128, 128)
      .toFile(path.join(publicDir, 'icon128.png'));
    console.log('✓ Created icon128.png (resized from 512x512)');

    console.log('\nAll icons created successfully!');
  } catch (error) {
    console.error('Error creating icons:', error);
    process.exit(1);
  }
}

resizeIcons();
