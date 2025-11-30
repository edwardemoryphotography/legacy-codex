import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const SVG_PATH = './icon-base.svg';
const ICONS_DIR = './icons';

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  console.log(`Created ${ICONS_DIR} directory`);
}

async function generateIcons() {
  try {
    console.log('Generating PWA icons...\n');

    for (const size of ICON_SIZES) {
      await sharp(SVG_PATH)
        .resize(size, size, {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));

      console.log(`✓ Generated icon-${size}x${size}.png`);
    }

    console.log('\nGenerating maskable icons...\n');

    for (const size of MASKABLE_SIZES) {
      await sharp(SVG_PATH)
        .resize(size, size, {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(path.join(ICONS_DIR, `icon-${size}x${size}-maskable.png`));

      console.log(`✓ Generated icon-${size}x${size}-maskable.png`);
    }

    console.log('\n✅ All icons generated successfully!');
    console.log(`Icons saved to: ${ICONS_DIR}/`);
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
