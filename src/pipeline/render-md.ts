import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rehypePlugins, remarkPlugins } from "./plugins.ts";

const processor = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypePlugins)
  .use(rehypeStringify);

/** Renders a Markdown body (frontmatter already removed) to HTML with section markup. */
export async function renderMarkdown(body: string): Promise<string> {
  return String(await processor.process(body));
}
