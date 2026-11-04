/**
 * What the film shows, in four lines, for a visitor who never presses Sound. Each line is something Stay does in the film; none of them is
 * a claim about any other product.
 */
const SEEN: Array<[string, string]> = [
  ['No lecture.', 'He asks for it straight and gets two plain sentences, then silence.'],
  ['The clock starts when he asks.', 'It does not start one on its own.'],
  ['It comes back first.', 'When the minute ends it waits until he has finished talking, then speaks and asks how it went.'],
  ['It keeps what helps.', 'He tells it one thing to remember. The block he finished is logged on his own device.'],
];

export function FilmSeen() {
  return (
    <>
      <ul className="lp-seen" aria-label="What the film shows">
        {SEEN.map(([title, detail]) => (
          <li key={title}>
            <p className="lp-seen-title">{title}</p>
            <p className="lp-seen-detail">{detail}</p>
          </li>
        ))}
      </ul>
      <p className="lp-night-copy mt-8 max-w-[62ch]">
        Stay is built around getting you started. It starts the clock when you ask, speaks first when the time is up, and keeps what helped
        on your device.
      </p>
    </>
  );
}
