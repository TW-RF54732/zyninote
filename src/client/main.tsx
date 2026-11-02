import "katex/dist/katex.min.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installShell } from "./shell.ts";

installShell();

createRoot(document.getElementById("root")!).render(<App />);
