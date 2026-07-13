import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const coverageFiles = [
  { path: 'coverage/unit/backend/lcov.info', baseDir: 'apps/backend' },
  { path: 'coverage/integration/backend/lcov.info', baseDir: 'apps/backend' },
  { path: 'coverage/unit/frontend/lcov.info', baseDir: 'apps/frontend' },
  { path: 'coverage/component/frontend/lcov.info', baseDir: 'apps/frontend' },
];

function normalizePath(sfPath, baseDir) {
  // If it is absolute, make it relative to rootDir
  let resolved = sfPath;
  if (path.isAbsolute(sfPath)) {
    resolved = path.relative(rootDir, sfPath);
  } else {
    // If it's already starting with apps/, it's relative to root
    if (!sfPath.startsWith('apps/')) {
      resolved = path.join(baseDir, sfPath);
    }
  }
  // Replace backslashes with forward slashes for cross-platform stability
  return resolved.replace(/\\/g, '/');
}

function parseLcov(content, baseDir) {
  const files = {};
  const records = content.split('end_of_record');
  
  for (const record of records) {
    const lines = record.trim().split('\n');
    let currentFile = null;
    let fileData = {
      lines: {}, // lineNum -> count
      functions: {}, // funcName -> count
      branches: {}, // branch info
      LF: 0,
      LH: 0,
    };

    for (const line of lines) {
      const parts = line.trim().split(':');
      if (parts.length < 2) continue;
      const cmd = parts[0];
      const rest = parts.slice(1).join(':');

      if (cmd === 'SF') {
        currentFile = normalizePath(rest, baseDir);
        if (!files[currentFile]) {
          files[currentFile] = {
            lines: {},
            functions: {},
            branches: {},
            LF: 0,
            LH: 0,
          };
        }
        fileData = files[currentFile];
      } else if (cmd === 'DA') {
        const [lineNum, count] = rest.split(',').map(Number);
        fileData.lines[lineNum] = (fileData.lines[lineNum] || 0) + count;
      } else if (cmd === 'LF') {
        fileData.LF = Number(rest);
      } else if (cmd === 'LH') {
        fileData.LH = Number(rest);
      }
    }
  }
  return files;
}

function mergeRecords(target, source) {
  for (const [file, sourceData] of Object.entries(source)) {
    if (!target[file]) {
      target[file] = {
        lines: { ...sourceData.lines },
        functions: { ...sourceData.functions },
        branches: { ...sourceData.branches },
        LF: sourceData.LF,
        LH: sourceData.LH,
      };
    } else {
      const targetData = target[file];
      // Merge lines
      for (const [lineNum, count] of Object.entries(sourceData.lines)) {
        targetData.lines[lineNum] = (targetData.lines[lineNum] || 0) + count;
      }
      // Re-calculate LF & LH
      const lineNumbers = Object.keys(targetData.lines);
      targetData.LF = lineNumbers.length;
      targetData.LH = lineNumbers.filter(l => targetData.lines[l] > 0).length;
    }
  }
}

function generateLcov(merged) {
  let output = '';
  for (const [file, data] of Object.entries(merged)) {
    output += `TN:\n`;
    output += `SF:${file}\n`;
    
    // Sort lines by line number
    const sortedLines = Object.keys(data.lines).map(Number).sort((a, b) => a - b);
    for (const line of sortedLines) {
      output += `DA:${line},${data.lines[line]}\n`;
    }
    
    output += `LF:${data.LF}\n`;
    output += `LH:${data.LH}\n`;
    output += `end_of_record\n`;
  }
  return output;
}

function main() {
  const merged = {};
  let totalLF = 0;
  let totalLH = 0;

  for (const fileInfo of coverageFiles) {
    const fullPath = path.resolve(rootDir, fileInfo.path);
    if (fs.existsSync(fullPath)) {
      console.log(`Processing coverage file: ${fileInfo.path}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = parseLcov(content, fileInfo.baseDir);
      mergeRecords(merged, parsed);
    } else {
      console.log(`Skipping missing coverage file: ${fileInfo.path}`);
    }
  }

  // Calculate totals
  for (const fileData of Object.values(merged)) {
    totalLF += fileData.LF;
    totalLH += fileData.LH;
  }

  const overallPercent = totalLF > 0 ? ((totalLH / totalLF) * 100).toFixed(2) : '0.00';
  console.log('\n--- Unified Coverage Summary ---');
  console.log(`Total Files Tracked: ${Object.keys(merged).length}`);
  console.log(`Total lines: ${totalLF}`);
  console.log(`Covered lines: ${totalLH}`);
  console.log(`Overall Line Coverage: ${overallPercent}%`);

  const outputDir = path.resolve(rootDir, 'coverage');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'lcov.info');
  fs.writeFileSync(outputPath, generateLcov(merged), 'utf8');
  console.log(`Merged LCOV report written to ${outputPath}`);
}

main();
