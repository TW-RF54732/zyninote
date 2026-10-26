import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Page } from "../shared/types.ts";
import { checkTags, normalizeTag, readTags, TagError, TagStore, writeTags } from "./tags.ts";

describe("frontmatter tags", () => {
  it("rewrites a flow list and keeps everything else as written", () => {
    const source = `---\ntitle: TCP # 標題\ntags: [basic, 傳輸層]\norder: 2\n---\n\n## A\n`;
    expect(writeTags(source, "md", ["basic", "網路層"])).toBe(`---\ntitle: TCP # 標題\ntags: [basic, 網路層]\norder: 2\n---\n\n## A\n`);
  });

  it("replaces block and multi-line flow lists", () => {
    expect(writeTags(`---\ntags:\n  - a\n  - b\nsummary: s\n---\nx`, "mdx", ["c"])).toBe(`---\ntags: [c]\nsummary: s\n---\nx`);
    expect(writeTags(`---\ntags:\n- a\n- b\n---\n`, "md", [])).toBe(`---\ntags: []\n---\n`);
    expect(writeTags(`---\ntags: [a,\n  b]\nx: 1\n---\n`, "md", ["b"])).toBe(`---\ntags: [b]\nx: 1\n---\n`);
    expect(writeTags(`---\ntags: a\n---\n`, "md", ["a", "b"])).toBe(`---\ntags: [a, b]\n---\n`);
  });

  it("adds tags after the title, or a frontmatter when there is none", () => {
    expect(writeTags(`---\ntitle: T\nsummary: s\n---\n`, "md", ["a"])).toBe(`---\ntitle: T\ntags: [a]\nsummary: s\n---\n`);
    expect(writeTags(`## A\n`, "md", ["a"])).toBe(`---\ntags: [a]\n---\n\n## A\n`);
  });

  it("quotes tags that YAML would read differently", () => {
    const next = writeTags(`---\ntags: []\n---\n`, "md", ["a, b", "true", "2", "#x", "C++", "re: x"]);
    expect(readTags(next, "md")).toEqual(["a, b", "true", "2", "#x", "C++", "re: x"]);
  });

  it("keeps CRLF line endings", () => {
    expect(writeTags(`---\r\ntitle: T\r\ntags: [a]\r\n---\r\nx\r\n`, "md", ["b"])).toBe(`---\r\ntitle: T\r\ntags: [b]\r\n---\r\nx\r\n`);
  });
});

describe("TSX meta tags", () => {
  const tsx = (meta: string) => `import { Section } from "zyninote";\n\nexport const meta = ${meta};\n\nexport default function A() {\n  return null;\n}\n`;

  it("reads and rewrites the tags array literal", () => {
    const source = tsx(`{\n  title: "路由",\n  tags: ['網路層', "a]b"],\n  order: 3,\n}`);
    expect(readTags(source, "tsx")).toEqual(["網路層", "a]b"]);
    expect(writeTags(source, "tsx", ["網路層", "basic"])).toBe(tsx(`{\n  title: "路由",\n  tags: ["網路層", "basic"],\n  order: 3,\n}`));
  });

  it("ignores nested tags keys and adds the property when missing", () => {
    const source = tsx(`{\n  title: "x",\n  extra: { tags: ["no"] },\n}`);
    expect(readTags(source, "tsx")).toEqual([]);
    expect(writeTags(source, "tsx", ["a"])).toBe(tsx(`{\n  tags: ["a"],\n  title: "x",\n  extra: { tags: ["no"] },\n}`));
    expect(writeTags(tsx(`{ title: "x" }`), "tsx", ["a"])).toBe(tsx(`{ tags: ["a"], title: "x" }`));
  });

  it("refuses tags it cannot rewrite", () => {
    expect(() => writeTags(tsx(`{ tags: TAGS }`), "tsx", ["a"])).toThrow(TagError);
    expect(() => writeTags(tsx(`{ tags: [...base, "a"] }`), "tsx", ["a"])).toThrow(TagError);
    expect(() => writeTags(`export default () => null;`, "tsx", ["a"])).toThrow(/export const meta/);
  });
});

describe("normalizeTag", () => {
  it("trims and rejects empty or control characters", () => {
    expect(normalizeTag("  basic ")).toBe("basic");
    expect(() => normalizeTag(" ")).toThrow(TagError);
    expect(() => normalizeTag("a\nb")).toThrow(TagError);
    expect(() => normalizeTag(3)).toThrow(TagError);
  });
});

describe("checkTags", () => {
  const page = (path: string, slug: string, tags: string[]) => ({ path, subject: "net", slug, meta: { title: slug, tags } }) as Page;

  it("warns about tags missing from the subject registry", () => {
    const diagnostics = checkTags([page("net/_subject.md", "", ["x"]), page("net/a.md", "a", ["basic", "typo"])], () => ["basic"]);
    expect(diagnostics).toEqual([{ level: "warning", path: "net/a.md", message: expect.stringContaining("未註冊的 tag「typo」") }]);
  });
});

describe("TagStore", () => {
  const setup = (files: Record<string, string>, indexed: Record<string, string[]> = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "zn-tags-"));
    mkdirSync(join(dir, "net"));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, "net", name), text);
    const read = (name: string) => readFileSync(join(dir, "net", name), "utf8");
    return { store: new TagStore(dir, (path) => indexed[path]), read, dir };
  };

  it("refuses unregistered tags unless asked to register them", async () => {
    const { store, read } = setup({ "_subject.md": `---\ntitle: 網路\ntags: [basic]\n---\n`, "a.md": `---\ntags: [basic]\n---\n` });
    await expect(store.setNoteTags("net", "a", ["basic", "新"], false)).rejects.toMatchObject({ status: 409, unregistered: ["新"] });
    expect(read("a.md")).toBe(`---\ntags: [basic]\n---\n`);
    expect(await store.setNoteTags("net", "a", ["basic", "新"], true)).toEqual({ files: ["net/_subject.md", "net/a.md"] });
    expect(read("_subject.md")).toBe(`---\ntitle: 網路\ntags: [basic, 新]\n---\n`);
    expect(read("a.md")).toBe(`---\ntags: [basic, 新]\n---\n`);
  });

  it("renames across notes and merges into an existing tag", async () => {
    const { store, read, dir } = setup({
      "_subject.md": `---\ntags: [a, b, c]\n---\n`,
      "one.md": `---\ntags: [a, b]\n---\n`,
      "two.tsx": `export const meta = { title: "2", tags: ["a"] };\nexport default () => null;\n`,
      "three.md": `---\ntags: [c]\n---\n`,
    });
    await store.rename("net", "a", "x");
    expect(read("_subject.md")).toBe(`---\ntags: [x, b, c]\n---\n`);
    expect(read("one.md")).toBe(`---\ntags: [x, b]\n---\n`);
    expect(read("two.tsx")).toContain(`tags: ["x"]`);
    expect(read("three.md")).toBe(`---\ntags: [c]\n---\n`);

    await store.rename("net", "x", "b");
    expect(read("_subject.md")).toBe(`---\ntags: [b, c]\n---\n`);
    expect(read("one.md")).toBe(`---\ntags: [b]\n---\n`);
    expect(readdirSync(join(dir, "net")).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("writes nothing when any file cannot be rewritten", async () => {
    const { store, read } = setup({
      "_subject.md": `---\ntags: [a]\n---\n`,
      "one.md": `---\ntags: [a]\n---\n`,
      "two.tsx": `const T = ["a"];\nexport const meta = { tags: T };\nexport default () => null;\n`,
    });
    // two.tsx's tags are not a literal; without an index entry it counts as untagged and is left alone.
    await store.remove("net", "a");
    expect(read("one.md")).toBe(`---\ntags: []\n---\n`);

    const bad = setup({ "_subject.md": `---\ntags: [a]\n---\n`, "one.md": `---\ntags: [a]\n---\n`, "two.tsx": `export const meta = { tags: ["a", ...more] };\n` }, { "net/two.tsx": ["a"] });
    await expect(bad.store.rename("net", "a", "b")).rejects.toThrow(/two\.tsx/);
    expect(bad.read("one.md")).toBe(`---\ntags: [a]\n---\n`);
    expect(bad.read("_subject.md")).toBe(`---\ntags: [a]\n---\n`);
  });

  it("registers and creates _subject.md when missing", async () => {
    const { store, read } = setup({ "a.md": `# x\n` });
    await store.register("net", "basic");
    expect(read("_subject.md")).toBe(`---\ntitle: net\ntags: [basic]\n---\n`);
    await expect(store.register("net", "basic")).rejects.toMatchObject({ status: 409 });
  });
});
