import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');

async function resizeIcons() {
  try {
    // Use favicon-48x48.png.png as source for all icons
    const sourceIcon = path.join(publicDir, 'favicon-48x48.png.png');

    // Resize to 16x16 as icon16.png
    await sharp(sourceIcon)
      .resize(16, 16, { fit: 'cover' })
      .toFile(path.join(publicDir, 'icon16.png'));
    console.log('✓ Created icon16.png (resized from favicon-48x48.png.png)');

    // Resize to 32x32 as icon32.png
    await sharp(sourceIcon)
      .resize(32, 32, { fit: 'cover' })
      .toFile(path.join(publicDir, 'icon32.png'));
    console.log('✓ Created icon32.png (resized from favicon-48x48.png.png)');

    // Resize to 48x48 as icon48.png
    await sharp(sourceIcon)
      .resize(48, 48, { fit: 'cover' })
      .toFile(path.join(publicDir, 'icon48.png'));
    console.log('✓ Created icon48.png (resized from favicon-48x48.png.png)');

    // Resize to 128x128 as icon128.png
    await sharp(sourceIcon)
      .resize(128, 128, { fit: 'cover' })
      .toFile(path.join(publicDir, 'icon128.png'));
    console.log('✓ Created icon128.png (resized from favicon-48x48.png.png)');

    // Resize to 256x256 as icon256.png
    await sharp(sourceIcon)
      .resize(256, 256, { fit: 'cover' })
      .toFile(path.join(publicDir, 'icon256.png'));
    console.log('✓ Created icon256.png (resized from favicon-48x48.png.png)');

    // Create toolbar icon (128x128)
    await sharp(sourceIcon)
      .resize(128, 128, { fit: 'cover', position: 'center' })
      .toFile(path.join(publicDir, 'icon-toolbar.png'));
    console.log('✓ Created icon-toolbar.png (optimized for toolbar)');

    console.log('\nAll icons created successfully from favicon-48x48.png.png!');
  } catch (error) {
    console.error('Error creating icons:', error);
    process.exit(1);
  }
}

resizeIcons();
