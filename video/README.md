# Stay Demo Video Project (`video/`)

Programmatic video demo project built according to `docs/DEMO_SCRIPT.md` using the Remotion / HyperFrames visual framework.

## Structure

- `src/Root.tsx`: 1080x1920 (or 1920x1080) compositions with exact 30fps timing matching the 5 acts.
- `src/Composition.tsx`: Master timeline with sequenced transitions.
- `src/scenes/`:
  - `Act1Problem.tsx`: The initiation threshold problem & core proposition ("Make starting easier.").
  - `Act2VoiceLoop.tsx`: Live voice agent body doubling, barrier detection, task shrinking, and timer-end check-in.
  - `Act3Patterns.tsx`: Transparent observational strategy learning with exact counts (`3 of 3 started`).
  - `Act4ClinicianBridge.tsx`: 30-second treatment log and one-page Clinician PDF export preview.
  - `Act5SafetyClose.tsx`: Fixed UK crisis route (`999`, `NHS 111`, `Samaritans 116 123`) and data privacy guarantees.

## Quick Render

```bash
# Preview in browser
npx remotion preview

# Render MP4
npx remotion render StayDemo out/stay-demo.mp4
```
