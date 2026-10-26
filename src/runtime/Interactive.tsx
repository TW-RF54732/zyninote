import type { ReactNode } from "react";

type InteractiveProps = {
  /** Plain-text description of what the component shows; used for search and by AI readers instead of the rendered UI. */
  description: string;
  children?: ReactNode;
};

/** Wrap every interactive component's output in this so its section text carries a readable description. */
export function Interactive({ description, children }: InteractiveProps) {
  return (
    <figure className="zn-interactive" data-zn-description={description}>
      {children}
    </figure>
  );
}
