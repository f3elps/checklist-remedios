/**
 * scripts/gen-icons.mjs
 * Generates provisional PWA icons from docs/design/logo.svg using sharp.
 * Run once with: node scripts/gen-icons.mjs
 *
 * Output:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/maskable-512.png  (logo on solid #2aa179 background with padding)
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const BRAND_GREEN = '#2aa179'

// Read SVG and replace currentColor with the brand green so the icon isn't transparent
const svgRaw = readFileSync(resolve(root, 'docs/design/logo.svg'), 'utf8')
const svgColored = svgRaw.replace(/currentColor/g, BRAND_GREEN)
const svgBuffer = Buffer.from(svgColored)

mkdirSync(resolve(root, 'public/icons'), { recursive: true })

async function makeIcon(size, outputPath) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(root, outputPath))
  console.log(`Generated ${outputPath} (${size}x${size})`)
}

async function makeMaskableIcon(size, outputPath) {
  // For maskable icons, render the logo at 72% of size (safe zone) on a solid background
  const logoSize = Math.round(size * 0.72)
  const padding = Math.round((size - logoSize) / 2)

  // Render the logo at smaller size
  const logoBuffer = await sharp(svgBuffer)
    .resize(logoSize, logoSize)
    .png()
    .toBuffer()

  // Create solid background and composite the logo centered
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: logoBuffer, top: padding, left: padding }])
    .png()
    .toFile(resolve(root, outputPath))

  console.log(`Generated ${outputPath} (${size}x${size} maskable with padding)`)
}

async function main() {
  await makeIcon(192, 'public/icons/icon-192.png')
  await makeIcon(512, 'public/icons/icon-512.png')
  await makeMaskableIcon(512, 'public/icons/maskable-512.png')
  console.log('All icons generated successfully.')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
