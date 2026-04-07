const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function slugify(value) {
  return String(value || 'scenario')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function timestampPart() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function generateEarningsPdf({ result, page }) {
  const rootDir = path.join(__dirname, '..');
  const tmpDir = path.join(rootDir, 'tmp', 'pdfs');
  const outputDir = path.join(rootDir, 'output', 'pdf');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = `simulatore-${slugify(result.audience)}-${slugify(result.input.ruolo)}-${timestampPart()}`;
  const inputPath = path.join(tmpDir, `${baseName}.json`);
  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  const scriptPath = path.join(rootDir, 'scripts', 'generate_earnings_pdf.py');

  fs.writeFileSync(inputPath, JSON.stringify({ result, page }, null, 2), 'utf8');

  const run = spawnSync('python', [scriptPath, inputPath, outputPath], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  try {
    fs.unlinkSync(inputPath);
  } catch (error) {
    // Best effort cleanup.
  }

  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || 'Errore nella generazione del PDF');
  }

  return outputPath;
}

module.exports = {
  generateEarningsPdf
};
