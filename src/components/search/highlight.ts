import { W3_SEARCH_CONFIG } from "@/config/app";

export interface SnippetFragment {
  /** Plain text; never HTML. */
  text: string;
  /** Half-open [start, end) character ranges of `text` that matched the query. */
  highlights: [number, number][];
}

const { startSel, stopSel, fragmentDelimiter } = W3_SEARCH_CONFIG.headline;

/**
 * Turns ts_headline output (control-character delimiters) into plain-text fragments with
 * highlight ranges. Nothing is interpreted as markup; the UI renders ranges as <mark> elements.
 */
export function parseHeadline(headline: string): SnippetFragment[] {
  const fragments: SnippetFragment[] = [];
  for (const raw of headline.split(fragmentDelimiter)) {
    let text = "";
    const highlights: [number, number][] = [];
    let start: number | null = null;
    for (const char of raw) {
      if (char === startSel) {
        start = text.length;
      } else if (char === stopSel) {
        if (start !== null && text.length > start) highlights.push([start, text.length]);
        start = null;
      } else {
        text += char;
      }
    }
    if (start !== null && text.length > start) highlights.push([start, text.length]);
    if (text.trim() !== "") fragments.push({ text, highlights });
  }
  return fragments;
}

export interface TextPart {
  text: string;
  highlighted: boolean;
}

/** Splits a fragment into alternating plain / highlighted parts. */
export function splitFragment(fragment: SnippetFragment): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const [start, end] of fragment.highlights) {
    if (start > cursor)
      parts.push({ text: fragment.text.slice(cursor, start), highlighted: false });
    parts.push({ text: fragment.text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < fragment.text.length) {
    parts.push({ text: fragment.text.slice(cursor), highlighted: false });
  }
  return parts;
}
