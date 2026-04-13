import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe } from "vitest";
import { runCase } from "../test/run-case.js";

function readPublicIndexHtml(): string {
  return readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
}

describe("public entry html", () => {
  runCase("uses root-absolute asset paths so nested routes can refresh safely", () => {
    const html = readPublicIndexHtml();

    assert.match(html, /href="\/fonts\.css"/);
    assert.match(html, /href="\/index\.css"/);
    assert.match(html, /src="\/runtime-config\.js"/);
    assert.match(html, /src="\/index\.js"/);
    assert.doesNotMatch(html, /href="\.\//);
    assert.doesNotMatch(html, /src="\.\//);
  });
});
