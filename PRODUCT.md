# Product

## Register
Brand (the landing page, `src/components/landing/*`). The app itself (`/app/*`) is product register.

## What it is
Stay is a voice companion for adults with ADHD. Say what you keep putting off; it gives one small first step and stays with you while you do it. Built on AssemblyAI speech-to-text and voice for AssemblyAI's voice hackathon. Written from the repository and the owner's messages, not from an interview.

## Who it is for
People with ADHD, often late at night or on a bad day, who stall on starting. They want to talk, not fill in a form, and they do not want a lecture.

## Voice of the page
Plain, specific, honest. Every number on the page comes from a script in the repository and carries its limits. Short sentences. No hype words, no "X, not Y" refrains, no em dashes, no jargon when a plain word exists (say "slowest 1 in 20", not "95th percentile"). Never names another product as worse.

## Anti-references
Generic AI-startup landing pages: gradient text, glass cards everywhere, identical icon-heading-text grids, eyebrow labels over every heading, metric walls without context, claims that cannot be checked.

## Design principles
1. One card family. Every card shares face, border, radius and hover; motion differs only where the content differs.
2. Motion explains: a voice wave when someone speaks, thinking dots before Stay answers, words arriving as they are spoken. Ease-out, under 300 ms for UI, transform and opacity only, and a still page under reduced motion. The one longer move is the hero fold (about 1.2 s, ease in and out, transform, opacity and a blur) that carries the recorded call from one scene to the next.
3. Say the limit next to the number.
4. Dark theme only; text contrast at least 4.5:1.
