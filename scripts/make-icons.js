const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'assets', 'icon.svg');
const PNG_PATH = path.join(ROOT, 'assets', 'icon.png');

async function main() {
  console.log('→ Convertendo SVG para PNG 1024x1024...');
  const svgContent = fs.readFileSync(SVG_PATH);
  await sharp(svgContent)
    .resize(1024, 1024)
    .png()
    .toFile(PNG_PATH);
  console.log('✓ assets/icon.png criado');

  console.log('→ Gerando ícones com electron-icon-maker...');
  execSync(
    `electron-icon-maker --input="${PNG_PATH}" --output="${path.join(ROOT, 'assets')}"`,
    { stdio: 'inherit', cwd: ROOT }
  );

  // Copia para os caminhos esperados pelo forge.config.ts
  const icnsSource = path.join(ROOT, 'assets', 'icons', 'mac', 'icon.icns');
  const icoSource  = path.join(ROOT, 'assets', 'icons', 'win', 'icon.ico');
  const icnsDest   = path.join(ROOT, 'assets', 'icon.icns');
  const icoDest    = path.join(ROOT, 'assets', 'icon.ico');

  if (fs.existsSync(icnsSource)) {
    fs.copyFileSync(icnsSource, icnsDest);
    console.log('✓ assets/icon.icns criado');
  }
  if (fs.existsSync(icoSource)) {
    fs.copyFileSync(icoSource, icoDest);
    console.log('✓ assets/icon.ico criado');
  }

  console.log('\n✅ Ícones gerados com sucesso!');
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
