import { Fragment } from 'react';

/**
 * A heading's words, each in its own span (index in --i) so scroll.css can reveal them one by one. Rendered on the server: the text
 * stays selectable, stays one string for a screen reader (the spans are inline, the spaces are real), and is fully visible without CSS support.
 */
export function SplitWords({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="lp-w" style={{ '--i': i } as React.CSSProperties}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </>
  );
}
