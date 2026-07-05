import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');

async function resizeIcons() {
  try {
    // Use LL.ico as source for all icons
    const sourceIcon = path.join(publicDir, 'LL.ico');
    const tempPng = path.join(publicDir, 'temp_source.png');

    // Convert .ico to PNG using PowerShell with a simpler approach
    try {
      const psScript = `Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile('${sourceIcon}'); $img.Save('${tempPng}', [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose()`;
      await execAsync(`powershell -Command "${psScript}"`);
      console.log('✓ Converted LL.ico to PNG using PowerShell');
    } catch (psError) {
      console.log('PowerShell conversion failed, trying ImageMagick...');
      try {
        await execAsync(`magick "${sourceIcon}" "${tempPng}"`);
        console.log('✓ Converted LL.ico to PNG using ImageMagick');
      } catch (magickError) {
        throw new Error('Could not convert .ico to PNG - neither PowerShell nor ImageMagick worked');
      }
    }

    // Load the PNG file
    const image = sharp(tempPng);

    const iconSizes = [
      { name: 'icon16.png', size: 16 },
      { name: 'icon32.png', size: 32 },
      { name: 'icon48.png', size: 48 },
      { name: 'icon128.png', size: 128 },
      { name: 'icon256.png', size: 256 },
      { name: 'icon-toolbar.png', size: 128 },
    ];

    // Resize to each size
    for (const { name, size } of iconSizes) {
      const targetPath = path.join(publicDir, name);
      await image.clone().resize(size, size, { fit: 'cover' }).toFile(targetPath);
      console.log(`✓ Created ${name} (${size}x${size})`);
    }

    // Clean up temp file
    fs.unlinkSync(tempPng);

    console.log('\nAll icons created successfully from LL.ico!');
  } catch (error) {
    console.error('Error creating icons:', error);
    process.exit(1);
  }
}

resizeIcons();
