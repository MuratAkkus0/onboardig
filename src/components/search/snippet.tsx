import { splitFragment, type SnippetFragment } from "./highlight";

/** Renders matches as <mark> elements from text ranges; no HTML is ever parsed. */
export function Snippet({ fragments }: { fragments: SnippetFragment[] }) {
  if (fragments.length === 0) return null;
  return (
    <p className="text-sm break-words text-muted-foreground">
      {fragments.map((fragment, index) => (
        <span key={index}>
          {index > 0 ? " … " : null}
          {splitFragment(fragment).map((part, partIndex) =>
            part.highlighted ? (
              <mark key={partIndex} className="rounded-sm bg-accent px-0.5 text-accent-foreground">
                {part.text}
              </mark>
            ) : (
              <span key={partIndex}>{part.text}</span>
            ),
          )}
        </span>
      ))}
    </p>
  );
}
