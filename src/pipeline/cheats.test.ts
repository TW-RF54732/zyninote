import { describe, expect, it } from "vitest";
import { filterCards, moveCard, relatedSections } from "../shared/cheats.ts";
import type { CheatCardView, Page } from "../shared/types.ts";
import { addCard, CheatError, describeCards, parseCheats, removeCard, reorderCards, repointCard, serializeCheats, type StoredCard } from "./cheats.ts";

describe("parseCheats", () => {
  it("treats a missing file as an empty cheat sheet", () => {
    expect(parseCheats(null)).toEqual({ data: {}, cards: [], error: null });
  });

  it("reports malformed files instead of guessing", () => {
    expect(parseCheats("{ cards: [").error).toMatch(/JSON 格式錯誤/);
    expect(parseCheats(`{ "cards": {} }`).error).toMatch(/cards 陣列/);
    expect(parseCheats(`{ "cards": [{ "id": "c_1" }] }`).error).toMatch(/第 1 張卡片/);
  });

  it("keeps unknown fields through a rewrite, one card per line", () => {
    const file = parseCheats(`{"note":{"a":1},"cards":[{"id":"c_1","ref":"ch1.md#a","added":"2026-10-26","pin":true}]}`);
    const text = serializeCheats(file.data, file.cards);
    expect(text).toBe(`{\n  "note": {\n    "a": 1\n  },\n  "cards": [\n    { "id": "c_1", "ref": "ch1.md#a", "added": "2026-10-26", "pin": true }\n  ]\n}\n`);
    expect(parseCheats(text)).toEqual(file);
    expect(serializeCheats({}, [])).toBe(`{\n  "cards": []\n}\n`);
  });
});

describe("card edits", () => {
  const cards = (): StoredCard[] => [
    { id: "c_1", ref: "ch1.md#a" },
    { id: "c_2", ref: "ch2.md#b" },
  ];

  it("appends new cards, allowing the same block twice", () => {
    const list = cards();
    let n = 0;
    const ids = ["c_1", "c_1", "c_3"];
    addCard("net", list, "ch1.md#a", "2026-10-26", () => ids[n++]);
    expect(list.at(-1)).toEqual({ id: "c_3", ref: "ch1.md#a", added: "2026-10-26" });
    expect(list.filter((c) => c.ref === "ch1.md#a")).toHaveLength(2);
  });

  it("only accepts refs to a heading", () => {
    expect(() => addCard("net", cards(), "ch1.md", "x")).toThrow(CheatError);
    expect(() => addCard("net", cards(), "../../etc#x", "x")).toThrow(/超出 content/);
    expect(() => repointCard("net", cards(), "c_1", 3)).toThrow(/缺少 ref/);
  });

  it("removes and repoints by id", () => {
    const list = cards();
    repointCard("net", list, "c_2", "ch3.md#c");
    expect(list[1].ref).toBe("ch3.md#c");
    removeCard(list, "c_1");
    expect(list.map((c) => c.id)).toEqual(["c_2"]);
    expect(() => removeCard(list, "c_9")).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("reorders only to a permutation of the current cards", () => {
    const list = cards();
    reorderCards(list, ["c_2", "c_1"]);
    expect(list.map((c) => c.id)).toEqual(["c_2", "c_1"]);
    expect(() => reorderCards(list, ["c_1"])).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => reorderCards(list, ["c_1", "c_1"])).toThrow(CheatError);
    expect(() => reorderCards(list, "c_1")).toThrow(CheatError);
  });
});

describe("describeCards", () => {
  const page = {
    path: "net/ch1-intro.md",
    subject: "net",
    meta: { title: "導論", tags: ["basic"] },
    sections: [{ id: "osi", title: "OSI 七層", children: [] }],
    diagnostics: [],
  } as unknown as Page;
  const pageOf = (key: string) => (key === "net/ch1-intro" ? page : undefined);
  const file = (refs: string[], ids = refs.map((_, i) => `c_${i}`)) => parseCheats(JSON.stringify({ cards: refs.map((ref, i) => ({ id: ids[i], ref })) }));

  it("resolves refs relative to the subject folder", () => {
    const { cards, diagnostics } = describeCards("net", file(["ch1-intro.md#osi", "ch1-intro#osi"]), pageOf);
    expect(diagnostics).toEqual([]);
    expect(cards[0]).toMatchObject({ page: "net/ch1-intro", sectionId: "osi", url: "/net/ch1-intro#osi", pageTitle: "導論", sectionTitle: "OSI 七層", tags: ["basic"], problem: null });
    expect(cards[1].problem).toBeNull();
  });

  it("marks missing headings, missing pages and invalid paths as dead references", () => {
    const { cards, diagnostics } = describeCards("net", file(["ch1-intro.md#gone", "ch9.md#x", "../../src/a.md#x", "ch1-intro.md"]), pageOf);
    expect(cards.map((c) => c.problem)).toEqual([expect.stringMatching(/找不到標題 #gone/), expect.stringMatching(/找不到頁面/), expect.stringMatching(/超出 content/), expect.stringMatching(/需要 #id/)]);
    // A dead heading still belongs to its page, so `local` mode can show it there.
    expect(cards[0]).toMatchObject({ page: "net/ch1-intro", pageTitle: "導論" });
    expect(diagnostics.map((d) => d.level)).toEqual(["warning", "warning", "error", "warning"]);
    expect(diagnostics.every((d) => d.path === "net/_cheats.json")).toBe(true);
  });

  it("warns about duplicate card ids and unreadable files", () => {
    expect(describeCards("net", file(["ch1-intro.md#osi", "ch1-intro.md#osi"], ["c_1", "c_1"]), pageOf).diagnostics).toEqual([
      expect.objectContaining({ level: "warning", message: expect.stringMatching(/c_1.*重複/) }),
    ]);
    expect(describeCards("net", parseCheats("nope"), pageOf).diagnostics).toEqual([expect.objectContaining({ level: "error" })]);
  });
});

describe("relatedSections", () => {
  const sections = [
    { id: "a", children: ["a1", "a2"] },
    { id: "a1", children: ["a1x"] },
    { id: "a1x", children: [] },
    { id: "a2", children: [] },
    { id: "b", children: [] },
  ];

  it("finds ancestors and descendants but not siblings or the block itself", () => {
    expect(relatedSections(sections, "a1")).toEqual(new Set(["a", "a1x"]));
    expect(relatedSections(sections, "a")).toEqual(new Set(["a1", "a1x", "a2"]));
    expect(relatedSections(sections, "b")).toEqual(new Set());
  });
});

describe("filterCards", () => {
  const card = (id: string, page: string | null, tags: string[]): CheatCardView => ({
    id,
    ref: id,
    page,
    sectionId: "x",
    url: null,
    pageTitle: null,
    sectionTitle: null,
    tags,
    problem: null,
  });
  const cards = [card("1", "s/ch1", ["basic"]), card("2", "s/ch2", ["basic", "tcp"]), card("3", "s/ch3", ["tcp"]), card("4", null, [])];
  const base = { mode: "sub" as const, currentPage: "s/ch2", chapters: [], tags: [], tagMode: "any" as const };
  const ids = (list: CheatCardView[]) => list.map((c) => c.id);

  it("sub shows everything and local only the current page", () => {
    expect(ids(filterCards(cards, base))).toEqual(["1", "2", "3", "4"]);
    expect(ids(filterCards(cards, { ...base, mode: "local" }))).toEqual(["2"]);
  });

  it("advance filters by chapter and by tag union or intersection, keeping order", () => {
    const advance = { ...base, mode: "advance" as const };
    expect(ids(filterCards(cards, advance))).toEqual(["1", "2", "3", "4"]);
    expect(ids(filterCards(cards, { ...advance, chapters: ["s/ch3", "s/ch1"] }))).toEqual(["1", "3"]);
    expect(ids(filterCards(cards, { ...advance, tags: ["basic", "tcp"] }))).toEqual(["1", "2", "3"]);
    expect(ids(filterCards(cards, { ...advance, tags: ["basic", "tcp"], tagMode: "all" }))).toEqual(["2"]);
    expect(ids(filterCards(cards, { ...advance, chapters: ["s/ch1", "s/ch3"], tags: ["tcp"] }))).toEqual(["3"]);
  });
});

describe("moveCard", () => {
  it("moves relative to a neighbour in the full order", () => {
    expect(moveCard(["a", "b", "c", "d"], "d", { before: "b" })).toEqual(["a", "d", "b", "c"]);
    expect(moveCard(["a", "b", "c", "d"], "a", { after: "c" })).toEqual(["b", "c", "a", "d"]);
    expect(moveCard(["a", "b"], "a", { before: "a" })).toEqual(["a", "b"]);
    expect(moveCard(["a", "b"], "z", { before: "a" })).toEqual(["a", "b"]);
  });
});
