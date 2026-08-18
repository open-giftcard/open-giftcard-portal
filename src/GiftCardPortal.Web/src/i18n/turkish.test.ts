import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "./translate";
import { turkish } from "./turkish";

/**
 * Keeps the dictionary and the screens honest about each other.
 *
 * Source-string keys make an untranslated phrase invisible: it renders in
 * correct English inside an otherwise Turkish page, which reviewers skim past.
 * These tests read the screens instead of trusting them, so adding a sentence
 * without translating it, or editing one and orphaning its translation, fails
 * here rather than shipping.
 */
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });
}

function renderedPhrases(): Map<string, string> {
  // Only the first argument of a t(…) call: the second is interpolation values
  // and never reaches the dictionary.
  const call = /\bt\(\s*("(?:[^"\\]|\\.)*")/g;
  const phrases = new Map<string, string>();
  for (const file of sourceFiles(sourceRoot)) {
    // The translator's own documentation talks about t() calls without making
    // any, and its dictionary is the thing being checked.
    if (/[\\/]i18n[\\/](translate|turkish)\.ts$/.test(file)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(call)) {
      const phrase = JSON.parse(match[1]) as string;
      if (!phrases.has(phrase)) {
        phrases.set(phrase, file);
      }
    }
  }
  return phrases;
}

describe("the Turkish dictionary", () => {
  const phrases = renderedPhrases();

  it("covers every phrase the portal renders", () => {
    expect(phrases.size).toBeGreaterThan(500);
    const missing = [...phrases]
      .filter(([phrase]) => !(phrase in turkish))
      .map(([phrase, file]) => `${phrase}  (${file})`);
    expect(missing).toEqual([]);
  });

  it("keeps no entry that no screen renders any more", () => {
    const orphaned = Object.keys(turkish).filter(
      (phrase) => !phrases.has(phrase),
    );
    expect(orphaned).toEqual([]);
  });

  it("is never handed a phrase it cannot see", () => {
    // A t(variable) call renders in whatever language the dictionary happens to
    // hold for a string this file cannot read, so the two tests above go blind
    // to it. That is not hypothetical: the bulk upload's "Name" column label
    // reached production untranslated exactly this way. Every call therefore
    // takes a literal, even when that means translating a table of labels at
    // the point of definition.
    const dynamic: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      if (/[\\/]i18n[\\/](translate|turkish)\.ts$/.test(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*[^"\s]/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        dynamic.push(`${file}:${line}  ${match[0].trim()}`);
      }
    }
    expect(dynamic).toEqual([]);
  });

  it("carries every placeholder through the translation", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const broken = Object.entries(turkish)
      .filter(
        ([english, translated]) =>
          placeholders(english).join() !== placeholders(translated).join(),
      )
      .map(([english]) => english);
    expect(broken).toEqual([]);
  });

  it("translates a phrase and substitutes its values", () => {
    expect(translate("tr", "Sign out")).toBe("Oturumu kapat");
    expect(translate("tr", "Code {code}", { code: "NORTH" })).toBe("Kod NORTH");
  });

  it("falls back to the English source when a phrase is not in the dictionary", () => {
    expect(translate("tr", "A phrase nobody has translated")).toBe(
      "A phrase nobody has translated",
    );
    expect(translate("en", "Sign out")).toBe("Sign out");
  });
});
