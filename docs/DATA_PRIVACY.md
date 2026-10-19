# Data and privacy

Local first. Nothing about a person is stored on the server.

| What | Where it lives | Who else sees it |
|---|---|---|
| Profile, sessions, outcomes, check-ins, memory, calibration, voice preferences | This browser (`stay_*` in localStorage) | Nobody |
| Today list, parked thoughts, routines, reminders | This browser | Nobody |
| Your own API keys (optional) | This browser | Sent with each request through Stay's server to the provider you chose, used once, never stored or logged |
| Microphone audio (fast voice) | Streams from the browser straight to AssemblyAI for transcription | AssemblyAI. Stay saves no audio |
| What you said, as text | Through Stay's server to the language model that writes the reply (Groq by default, or your provider). Safety gates run first | The model provider |
| The reply, as text | To AssemblyAI to be spoken | AssemblyAI |
| Microphone audio (standard voice) | AssemblyAI Voice Agent does transcription, reply and speech | AssemblyAI |
| Up to three keywords for the orb | Shape service (a small model) | The model provider; never sentences, never crisis or medication wording |
| Clinician report | Built in the browser as a PDF | Only whoever you give the file to |
| Cloud sync (optional, off by default) | Supabase with row-level security | Only you |
| Request logs | Vercel (address, time, route) | Not the content of what you said |

Controls: Settings has "Download all my data" (JSON) and "Delete all my data" (every `stay_*` key including your keys and, when signed in, the cloud rows). The menu shows what Stay remembers and lets you remove any of it.

Not claimed: end-to-end encryption, a retention policy for AssemblyAI or Groq (read theirs; links are in the privacy page), or HIPAA/GDPR certification. Voice about mental-health-adjacent topics can count as sensitive data under UK GDPR; the design choice is to keep as little as possible and none of it on Stay's server.
