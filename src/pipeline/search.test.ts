import { describe, expect, it } from "vitest";
import type { Page, Section } from "../shared/types.ts";
import { buildSearchDocs, fold, search } from "./search.ts";

const section = (id: string, title: string, text: string): Section => ({ id, level: 2, title, fold: false, html: "", text, links: [], children: [] });

const pages = [
  {
    path: "net/ch1-intro.md",
    subject: "net",
    slug: "ch1-intro",
    meta: { title: "網路概論", tags: ["basic"], summary: "分層模型" },
    sections: [section("osi", "OSI 七層", "OSI 模型把網路通訊拆成七層。\n傳輸層負責端到端。"), section("delay", "傳輸延遲", "延遲 = 封包長度 / 頻寬")],
  },
  {
    path: "net/ch2-tcp.mdx",
    subject: "net",
    slug: "ch2-tcp",
    meta: { title: "TCP", tags: ["傳輸層"] },
    sections: [section("tcp-flags", "TCP Flags", "SYN、ACK、FIN 等控制位元")],
  },
  {
    path: "calc/ch1-limits.md",
    subject: "calc",
    slug: "ch1-limits",
    meta: { title: "極限", tags: [] },
    sections: [section("epsilon-delta", "ε-δ 定義", "對任意 ε > 0，存在 δ > 0")],
  },
] as Page[];

const docs = buildSearchDocs(pages, (s) => ({ net: "計算機網路", calc: "微積分" })[s]!);

describe("search", () => {
  it("finds Chinese substrings without segmentation and links to the heading", () => {
    const { hits } = search(docs, "端到端");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ page: "net/ch1-intro", section: { id: "osi" }, url: "/net/ch1-intro#osi", subjectTitle: "計算機網路" });
    expect(hits[0].snippet.text.slice(...hits[0].snippet.matches[0])).toBe("端到端");
  });

  it("requires every term, which may match the page title", () => {
    expect(search(docs, "tcp 控制").hits.map((h) => h.section?.id)).toEqual(["tcp-flags"]);
    expect(search(docs, "tcp 不存在").total).toBe(0);
  });

  it("ranks heading matches above text matches", () => {
    const ids = search(docs, "傳輸").hits.map((h) => h.section?.id ?? h.page);
    expect(ids[0]).toBe("delay");
    expect(ids).toContain("osi");
  });

  it("is case and width insensitive and highlights the original text", () => {
    const { hits } = search(docs, "ｓｙｎ");
    expect(hits[0].section?.id).toBe("tcp-flags");
    expect(hits[0].snippet.matches).toEqual([[0, 3]]);
    expect(search(docs, "Tcp flags").hits[0].title).toEqual({ text: "TCP Flags", matches: [[0, 3], [4, 9]] });
  });

  it("limits to a subject", () => {
    expect(search(docs, "定義").hits.map((h) => h.subject)).toEqual(["calc"]);
    expect(search(docs, "定義", { subject: "net" }).total).toBe(0);
  });

  it("finds pages by tag and summary", () => {
    expect(search(docs, "分層").hits.map((h) => [h.page, h.section])).toEqual([["net/ch1-intro", null]]);
  });

  it("cuts long text around the first match", () => {
    const long = buildSearchDocs([{ ...pages[0], sections: [section("x", "X", `${"甲".repeat(200)}目標${"乙".repeat(200)}`)] } as Page], () => "");
    const { snippet } = search(long, "目標").hits[0];
    expect(snippet.before && snippet.after).toBe(true);
    expect(snippet.text.slice(...snippet.matches[0])).toBe("目標");
  });
});

describe("fold", () => {
  it("keeps the length of the input", () => {
    for (const text of ["İstanbul", "ﬁle", "ＡＢＣ１２３", "𝐀b", "中文"]) expect(fold(text)).toHaveLength(text.length);
    expect(fold("ＡＢＣ")).toBe("abc");
  });
});
