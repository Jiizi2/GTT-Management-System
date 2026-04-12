import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const srcDir = path.join(frontendDir, "src");
const fontOutputPath = path.join(frontendDir, "public", "fonts", "material-symbols-outlined.woff2");

const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_DIRECTORY_NAMES = new Set(["unit", "smoke", "e2e"]);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const EXTRA_ICON_NAMES = [];

const ICON_PATTERNS = [
  /<span[^>]*material-symbols-outlined[^>]*>\s*(?<name>[a-z0-9_]+)\s*<\/span>/gisu,
  /\bicon\s*[:=]\s*["'](?<name>[a-z0-9_]+)["']/giu,
  /\bicon\s*:\s*[^,\r\n{};]*["'](?<name>[a-z0-9_]+)["']/giu,
  /\b[a-zA-Z_$][\w$]*icon[a-zA-Z_$]*\s*=\s*[^;\r\n]*["'](?<name>[a-z0-9_]+)["']/gu,
  /\b[a-zA-Z_$][\w$]*Icon[a-zA-Z_$]*\s*=\s*[^;\r\n]*["'](?<name>[a-z0-9_]+)["']/gu,
];

async function collectSourceFiles(directoryPath) {
  const sourceFiles = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      sourceFiles.push(...(await collectSourceFiles(path.join(directoryPath, entry.name))));
      continue;
    }

    if (SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      sourceFiles.push(path.join(directoryPath, entry.name));
    }
  }

  return sourceFiles;
}

async function extractIconNames() {
  const sourceFiles = await collectSourceFiles(srcDir);
  const iconNames = new Set(EXTRA_ICON_NAMES);

  for (const sourceFile of sourceFiles) {
    const contents = await readFile(sourceFile, "utf8");

    for (const pattern of ICON_PATTERNS) {
      for (const match of contents.matchAll(pattern)) {
        const iconName = match.groups?.name?.trim().toLowerCase();

        if (iconName) {
          iconNames.add(iconName);
        }
      }
    }
  }

  return Array.from(iconNames).sort((left, right) => left.localeCompare(right));
}

async function fetchSubsetFont(iconNames) {
  const stylesheetUrl = new URL("https://fonts.googleapis.com/css2");
  stylesheetUrl.searchParams.set("family", "Material Symbols Outlined");
  stylesheetUrl.searchParams.set("icon_names", iconNames.join(","));
  stylesheetUrl.searchParams.set("display", "block");

  const stylesheetResponse = await fetch(stylesheetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!stylesheetResponse.ok) {
    throw new Error(`Failed to fetch Material Symbols stylesheet (${stylesheetResponse.status})`);
  }

  const stylesheet = await stylesheetResponse.text();
  const fontUrlMatch = stylesheet.match(/url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/u);

  if (!fontUrlMatch) {
    throw new Error("Material Symbols subset stylesheet did not expose a woff2 URL.");
  }

  const fontResponse = await fetch(fontUrlMatch[1], {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!fontResponse.ok) {
    throw new Error(`Failed to download Material Symbols subset font (${fontResponse.status})`);
  }

  return {
    fontBuffer: Buffer.from(await fontResponse.arrayBuffer()),
    fontUrl: fontUrlMatch[1],
  };
}

async function main() {
  const iconNames = await extractIconNames();

  if (iconNames.length === 0) {
    throw new Error("No Material Symbols icons were detected in frontend source.");
  }

  const { fontBuffer, fontUrl } = await fetchSubsetFont(iconNames);

  await mkdir(path.dirname(fontOutputPath), { recursive: true });
  await writeFile(fontOutputPath, fontBuffer);

  console.log(
    JSON.stringify(
      {
        iconCount: iconNames.length,
        outputPath: path.relative(frontendDir, fontOutputPath),
        fontBytes: fontBuffer.length,
        sourceUrl: fontUrl,
        iconNames,
      },
      null,
      2,
    ),
  );
}

await main();
