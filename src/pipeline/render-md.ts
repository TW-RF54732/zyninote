import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { notePlugins } from "./plugins.ts";

/** Returns a renderer from a Markdown body (frontmatter already removed) to HTML with section markup. */
export function createMarkdownRenderer(contentDir: string) {
  const { remarkPlugins, rehypePlugins } = notePlugins(contentDir);
  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypePlugins)
    .use(rehypeStringify);

  /** `file` is the note's absolute path, used to resolve relative links. */
  return async (body: string, file: string): Promise<string> => String(await processor.process({ value: body, path: file }));
}
