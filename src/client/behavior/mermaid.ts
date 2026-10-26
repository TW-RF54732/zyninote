// Mermaid is loaded on demand and only renders visible diagrams (it cannot measure inside collapsed sections).

let ready: Promise<typeof import("mermaid").default> | null = null;

function load() {
  ready ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        darkMode: true,
        background: "#141414",
        primaryColor: "#202020",
        primaryTextColor: "#f5f5f5",
        primaryBorderColor: "#777777",
        lineColor: "#b5b5b5",
        secondaryColor: "#2a2a2a",
        tertiaryColor: "#1b1b1b",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif',
      },
    });
    return mermaid;
  });
  return ready;
}

export async function renderMermaid(root: HTMLElement) {
  const nodes = [...root.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])")].filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const mermaid = await load();
  await mermaid.run({ nodes, suppressErrors: true });
}
