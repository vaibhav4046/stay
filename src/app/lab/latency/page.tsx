import Link from 'next/link';

/**
 * T2.8 real-microphone run: instructions. The recorder itself is a panel inside the app at /app/today?lab=latency (the app refuses
 * to be shown in a frame, so a separate page cannot read it). This is the only evidence that may be quoted as a public latency number.
 */
export default function LatencyRun() {
  return (
    <div data-testid="latency-run">
      <h1 className="section-title">Real-microphone run</h1>
      <ol className="text-ink-2 mt-3 list-decimal space-y-1 pl-5 text-[0.95rem]">
        <li>Use a laptop with headphones. Close other tabs.</li>
        <li>Open the recorder link below. A small panel appears at the bottom right of the app.</li>
        <li>Tap Talk and say yes to the microphone.</li>
        <li>Do 20 turns in your own voice. Say something real each time, stop, and let Stay finish before the next.</li>
        <li>Press Export JSON in the panel and give the file to the person writing the report. Report all of it, including the slow turns.</li>
      </ol>
      <p className="mt-4">
        <Link className="btn btn-primary" href="/app/today?lab=latency" data-testid="latency-open">Open the recorder</Link>
      </p>
      <p className="meta mt-3">
        It measures from the last moment your microphone was loud to the first sample of Stay&apos;s reply that the audio system actually
        output. Fewer than five turns should not be quoted; fewer than 20 should say how many there were.
      </p>
    </div>
  );
}
