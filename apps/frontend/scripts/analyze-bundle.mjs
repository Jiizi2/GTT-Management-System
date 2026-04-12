import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const distDir = join(process.cwd(), "dist");
const metafilePath = join(process.cwd(), "build-meta", "esbuild-meta.json");

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, entryPath)));
      continue;
    }

    const fileStat = await stat(entryPath);
    files.push({
      path: relative(rootDir, entryPath).replaceAll("\\", "/"),
      bytes: fileStat.size,
    });
  }

  return files.sort((left, right) => right.bytes - left.bytes);
}

function collectTopInputContributors(outputName, metafile, limit = 5) {
  const output =
    metafile.outputs?.[outputName] ??
    metafile.outputs?.[`dist/${outputName}`] ??
    Object.entries(metafile.outputs ?? {}).find(([candidate]) => candidate.endsWith(`/${outputName}`))?.[1];
  if (!output || !output.inputs) {
    return [];
  }

  return Object.entries(output.inputs)
    .map(([inputPath, inputMeta]) => ({
      path: inputPath.replaceAll("\\", "/"),
      bytes: inputMeta.bytesInOutput ?? 0,
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function resolveOutputMeta(outputPath, metafile) {
  return (
    metafile.outputs?.[outputPath] ??
    metafile.outputs?.[`dist/${outputPath}`] ??
    Object.entries(metafile.outputs ?? {}).find(([candidate]) => candidate.endsWith(`/${outputPath}`))?.[1] ??
    null
  );
}

function collectStaticImportGraph(entryOutputPath, metafile) {
  const visited = new Set();
  const dynamicImports = [];

  function visit(outputPath) {
    const normalizedPath = outputPath.replaceAll("\\", "/");
    if (visited.has(normalizedPath)) {
      return;
    }

    visited.add(normalizedPath);

    const outputMeta = resolveOutputMeta(normalizedPath, metafile);
    if (!outputMeta?.imports) {
      return;
    }

    for (const imported of outputMeta.imports) {
      if (imported.kind === "dynamic-import") {
        dynamicImports.push(imported.path.replaceAll("\\", "/"));
        continue;
      }

      visit(imported.path);
    }
  }

  visit(entryOutputPath);

  return {
    staticOutputs: Array.from(visited),
    dynamicImports: Array.from(new Set(dynamicImports)),
  };
}

function printSection(title) {
  console.log(`\n${title}`);
}

async function main() {
  const metafile = JSON.parse(await readFile(metafilePath, "utf8"));
  const distFiles = await collectFiles(distDir);

  const topAssets = distFiles.slice(0, 12);
  const jsOutputs = topAssets.filter((file) => file.path.endsWith(".js"));
  const initialJs = jsOutputs.find((file) => file.path === "index.js");
  const initialCss = distFiles.find((file) => file.path === "index.css");
  const { staticOutputs, dynamicImports } = collectStaticImportGraph("dist/index.js", metafile);
  const distFilesByPath = new Map(distFiles.map((file) => [`dist/${file.path}`, file]));
  const initialGraphAssets = staticOutputs
    .map((outputPath) => distFilesByPath.get(outputPath))
    .filter((file) => file !== undefined);
  const initialGraphJs = initialGraphAssets.filter((file) => file.path.endsWith(".js"));
  const initialGraphBytes = initialGraphJs.reduce((total, file) => total + file.bytes, 0);

  console.log("Bundle Baseline");
  if (initialJs) {
    console.log(`- Entry JS File: ${formatBytes(initialJs.bytes)} (${initialJs.path})`);
  }
  if (initialCss) {
    console.log(`- Initial CSS: ${formatBytes(initialCss.bytes)} (${initialCss.path})`);
  }
  console.log(`- Initial JS Graph: ${formatBytes(initialGraphBytes)} (${initialGraphJs.length} files)`);

  printSection("Initial JS Graph Assets");
  for (const file of initialGraphJs) {
    console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
  }

  if (dynamicImports.length > 0) {
    printSection("Dynamic Entry Chunks");
    for (const outputPath of dynamicImports) {
      const file = distFilesByPath.get(outputPath);
      if (!file) {
        continue;
      }

      console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
    }
  }

  printSection("Top Dist Assets");
  for (const file of topAssets) {
    console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
  }

  printSection("Top JS Contributors");
  for (const file of jsOutputs.slice(0, 6)) {
    console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
    const contributors = collectTopInputContributors(file.path, metafile);
    for (const contributor of contributors) {
      console.log(`  ${contributor.path}: ${formatBytes(contributor.bytes)}`);
    }
  }
}

main().catch((error) => {
  console.error("Bundle analysis failed:", error);
  process.exitCode = 1;
});
