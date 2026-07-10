import { Fragment, type ReactNode } from "react";

// Matches numbers with optional sign/decimals and an optional unit (% m s x),
// so "+75%", "12m", "2s", "×0.85" render as highlighted values — the in-game
// tooltip aesthetic (bold/coloured numbers over gray body text).
const NUMBER = /([+\-−×]?\s?\d+(?:\.\d+)?\s?(?:%|m\b|s\b|x\b)?)/g;

/**
 * Splits body text into plain runs and highlighted numeric runs. Returns React
 * nodes so callers can drop it straight into a paragraph.
 */
export function highlightNumbers(text: string): ReactNode {
  const parts = text.split(NUMBER);
  return parts.map((part, i) => {
    if (i % 2 === 1 && part.trim() !== "") {
      return (
        <span key={i} className="font-semibold text-foreground">
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
