import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const srcDir = path.join(frontendDir, "src");
const fontOutputPath = path.join(frontendDir, "public", "fonts", "material-symbols-outlined.woff2");
const manifestOutputPath = path.join(frontendDir, "public", "fonts", "material-symbols-outlined.json");

const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_DIRECTORY_NAMES = new Set(["unit", "smoke", "e2e"]);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const EXTRA_ICON_NAMES = ["map", "train", "directions_bus"];
const ICON_NAME_PATTERN = /^[a-z0-9_]+$/u;
const MAX_RESOLVED_VALUES = 32;
const CHECK_MODE_FLAG = "--check";

const ICON_PATTERNS = [
  /<span[^>]*material-symbols-outlined[^>]*>\s*(?<name>[a-z0-9_]+)\s*<\/span>/gisu,
  /\bicon\s*[:=]\s*["'](?<name>[a-z0-9_]+)["']/giu,
  /\bicon\s*:\s*[^,\r\n{};]*["'](?<name>[a-z0-9_]+)["']/giu,
  /\b[a-zA-Z_$][\w$]*icon[a-zA-Z_$]*\s*=\s*[^;\r\n]*["'](?<name>[a-z0-9_]+)["']/gu,
  /\b[a-zA-Z_$][\w$]*Icon[a-zA-Z_$]*\s*=\s*[^;\r\n]*["'](?<name>[a-z0-9_]+)["']/gu,
];

function normalizeIconName(value) {
  const normalizedValue = value.trim().toLowerCase();
  return ICON_NAME_PATTERN.test(normalizedValue) ? normalizedValue : null;
}

function addIconName(iconNames, value) {
  const normalizedValue = normalizeIconName(value);

  if (normalizedValue) {
    iconNames.add(normalizedValue);
  }
}

function mergeValueLists(...valueLists) {
  const mergedValues = new Set();

  for (const valueList of valueLists) {
    if (!valueList) {
      continue;
    }

    for (const value of valueList) {
      mergedValues.add(value);

      if (mergedValues.size >= MAX_RESOLVED_VALUES) {
        return Array.from(mergedValues);
      }
    }
  }

  return mergedValues.size > 0 ? Array.from(mergedValues) : null;
}

function combineValueLists(leftValues, rightValues) {
  if (!leftValues || !rightValues) {
    return null;
  }

  const combinedValues = [];

  for (const leftValue of leftValues) {
    for (const rightValue of rightValues) {
      combinedValues.push(`${leftValue}${rightValue}`);

      if (combinedValues.length >= MAX_RESOLVED_VALUES) {
        return combinedValues;
      }
    }
  }

  return combinedValues.length > 0 ? combinedValues : null;
}

function createSourceFile(sourceFilePath, sourceText) {
  return ts.createSourceFile(
    sourceFilePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceFilePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectVariableInitializers(sourceFile) {
  const variableInitializers = new Map();

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const existingInitializers = variableInitializers.get(node.name.text) ?? [];
      existingInitializers.push(node.initializer);
      variableInitializers.set(node.name.text, existingInitializers);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return variableInitializers;
}

function extractIconNamesFromJsx(sourceFile, iconNames) {
  const variableInitializers = collectVariableInitializers(sourceFile);
  const resolvedExpressionCache = new Map();
  const resolvedIdentifierCache = new Map();

  function resolveIdentifierValues(identifierName, activeIdentifiers = new Set()) {
    const cacheKey = `${identifierName}:${Array.from(activeIdentifiers).sort().join(",")}`;

    if (resolvedIdentifierCache.has(cacheKey)) {
      return resolvedIdentifierCache.get(cacheKey);
    }

    if (activeIdentifiers.has(identifierName)) {
      return null;
    }

    const initializers = variableInitializers.get(identifierName);

    if (!initializers) {
      resolvedIdentifierCache.set(cacheKey, null);
      return null;
    }

    const nextActiveIdentifiers = new Set(activeIdentifiers);
    nextActiveIdentifiers.add(identifierName);

    const resolvedValues = mergeValueLists(
      ...initializers.map((initializer) => resolveExpressionValues(initializer, nextActiveIdentifiers)),
    );

    resolvedIdentifierCache.set(cacheKey, resolvedValues);
    return resolvedValues;
  }

  function resolveTemplateExpressionValues(expression, activeIdentifiers) {
    let currentValues = [expression.head.text];

    for (const span of expression.templateSpans) {
      const expressionValues = resolveExpressionValues(span.expression, activeIdentifiers);

      if (!expressionValues) {
        return null;
      }

      const nextValues = combineValueLists(currentValues, expressionValues);

      if (!nextValues) {
        return null;
      }

      currentValues = nextValues.map((value) => `${value}${span.literal.text}`);
    }

    return currentValues;
  }

  function resolveExpressionValues(expression, activeIdentifiers = new Set()) {
    if (!expression) {
      return null;
    }

    if (resolvedExpressionCache.has(expression)) {
      return resolvedExpressionCache.get(expression);
    }

    let resolvedValues = null;

    if (ts.isStringLiteralLike(expression)) {
      resolvedValues = [expression.text];
    } else if (ts.isParenthesizedExpression(expression)) {
      resolvedValues = resolveExpressionValues(expression.expression, activeIdentifiers);
    } else if (
      ts.isAsExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isTypeAssertionExpression(expression)
    ) {
      resolvedValues = resolveExpressionValues(expression.expression, activeIdentifiers);
    } else if (ts.isConditionalExpression(expression)) {
      resolvedValues = mergeValueLists(
        resolveExpressionValues(expression.whenTrue, activeIdentifiers),
        resolveExpressionValues(expression.whenFalse, activeIdentifiers),
      );
    } else if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        resolvedValues = combineValueLists(
          resolveExpressionValues(expression.left, activeIdentifiers),
          resolveExpressionValues(expression.right, activeIdentifiers),
        );
      } else if (
        expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        resolvedValues = mergeValueLists(
          resolveExpressionValues(expression.left, activeIdentifiers),
          resolveExpressionValues(expression.right, activeIdentifiers),
        );
      }
    } else if (ts.isNoSubstitutionTemplateLiteral(expression)) {
      resolvedValues = [expression.text];
    } else if (ts.isTemplateExpression(expression)) {
      resolvedValues = resolveTemplateExpressionValues(expression, activeIdentifiers);
    } else if (ts.isIdentifier(expression)) {
      resolvedValues = resolveIdentifierValues(expression.text, activeIdentifiers);
    }

    resolvedExpressionCache.set(expression, resolvedValues);
    return resolvedValues;
  }

  function jsxAttributeContainsMaterialSymbols(attribute) {
    if (!attribute || !attribute.initializer) {
      return false;
    }

    if (ts.isStringLiteral(attribute.initializer)) {
      return attribute.initializer.text.includes("material-symbols-outlined");
    }

    if (ts.isJsxExpression(attribute.initializer)) {
      const expressionValues = resolveExpressionValues(attribute.initializer.expression);
      return expressionValues?.some((value) => value.includes("material-symbols-outlined")) ?? false;
    }

    return false;
  }

  function isMaterialSymbolsElement(openingElement) {
    return openingElement.attributes.properties.some((attribute) => {
      if (!ts.isJsxAttribute(attribute)) {
        return false;
      }

      const attributeName = attribute.name.text;
      if (attributeName !== "className" && attributeName !== "class") {
        return false;
      }

      return jsxAttributeContainsMaterialSymbols(attribute);
    });
  }

  function collectIconNamesFromChildExpression(expression) {
    const expressionValues = resolveExpressionValues(expression);

    if (!expressionValues) {
      return;
    }

    for (const value of expressionValues) {
      addIconName(iconNames, value);
    }
  }

  function collectIconNamesFromChildren(children) {
    for (const child of children) {
      if (ts.isJsxText(child)) {
        addIconName(iconNames, child.getText(sourceFile));
        continue;
      }

      if (ts.isJsxExpression(child) && child.expression) {
        collectIconNamesFromChildExpression(child.expression);
      }
    }
  }

  function visit(node) {
    if (ts.isJsxElement(node) && isMaterialSymbolsElement(node.openingElement)) {
      collectIconNamesFromChildren(node.children);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function extractIconNamesFromText(contents, iconNames) {
  for (const pattern of ICON_PATTERNS) {
    for (const match of contents.matchAll(pattern)) {
      const iconName = match.groups?.name?.trim().toLowerCase();

      if (iconName) {
        iconNames.add(iconName);
      }
    }
  }
}

async function readStoredManifest() {
  try {
    const manifestContents = await readFile(manifestOutputPath, "utf8");
    const manifest = JSON.parse(manifestContents);

    if (!Array.isArray(manifest.iconNames)) {
      return null;
    }

    return manifest.iconNames
      .map((iconName) => normalizeIconName(String(iconName)))
      .filter((iconName) => iconName !== null);
  } catch {
    return null;
  }
}

function compareIconLists(expectedIconNames, actualIconNames) {
  const expectedSet = new Set(expectedIconNames);
  const actualSet = new Set(actualIconNames);

  return {
    missingFromManifest: expectedIconNames.filter((iconName) => !actualSet.has(iconName)),
    obsoleteInManifest: actualIconNames.filter((iconName) => !expectedSet.has(iconName)),
    isEqual:
      expectedIconNames.length === actualIconNames.length &&
      expectedIconNames.every((iconName, index) => iconName === actualIconNames[index]),
  };
}

async function verifyStoredSubset(iconNames) {
  const storedIconNames = await readStoredManifest();

  if (!storedIconNames) {
    throw new Error("Material Symbols subset manifest is missing. Run `npm run assets:icons --workspace frontend`.");
  }

  const comparison = compareIconLists(iconNames, storedIconNames);

  if (!comparison.isEqual) {
    const missingLabel = comparison.missingFromManifest.slice(0, 12).join(", ");
    const obsoleteLabel = comparison.obsoleteInManifest.slice(0, 12).join(", ");

    throw new Error(
      [
        "Material Symbols subset is out of date. Run `npm run assets:icons --workspace frontend`.",
        comparison.missingFromManifest.length > 0 ? `Missing icons: ${missingLabel}` : "",
        comparison.obsoleteInManifest.length > 0 ? `Obsolete icons: ${obsoleteLabel}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        iconCount: iconNames.length,
        manifestPath: path.relative(frontendDir, manifestOutputPath),
      },
      null,
      2,
    ),
  );
}

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
    const parsedSourceFile = createSourceFile(sourceFile, contents);
    extractIconNamesFromText(contents, iconNames);
    extractIconNamesFromJsx(parsedSourceFile, iconNames);
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
  const isCheckMode = process.argv.includes(CHECK_MODE_FLAG);

  if (iconNames.length === 0) {
    throw new Error("No Material Symbols icons were detected in frontend source.");
  }

  if (isCheckMode) {
    await verifyStoredSubset(iconNames);
    return;
  }

  const storedIconNames = await readStoredManifest();
  const storedSubsetComparison = storedIconNames ? compareIconLists(iconNames, storedIconNames) : null;

  if (storedSubsetComparison?.isEqual) {
    try {
      await readFile(fontOutputPath);
      console.log(
        JSON.stringify(
          {
            iconCount: iconNames.length,
            outputPath: path.relative(frontendDir, fontOutputPath),
            manifestPath: path.relative(frontendDir, manifestOutputPath),
            unchanged: true,
            iconNames,
          },
          null,
          2,
        ),
      );
      return;
    } catch {
      // Font file is missing, regenerate it below.
    }
  }

  const { fontBuffer, fontUrl } = await fetchSubsetFont(iconNames);

  await mkdir(path.dirname(fontOutputPath), { recursive: true });
  await writeFile(fontOutputPath, fontBuffer);
  await writeFile(
    manifestOutputPath,
    JSON.stringify(
      {
        iconNames,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        iconCount: iconNames.length,
        outputPath: path.relative(frontendDir, fontOutputPath),
        manifestPath: path.relative(frontendDir, manifestOutputPath),
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
