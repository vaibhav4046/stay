# ADHD User Review Pass — Real-World Executive Function Evaluation

**Persona:** Overwhelmed adult with ADHD, easily frustrated by long text or waiting.  
**Viewport:** Mobile 375 × 740 px (iPhone SE width) & Desktop.  
**Theme:** Light & Dark Mode.  

---

### Key Scenarios Tested

#### 1. Rapid Interruption & Tangents ("Wait, actually...")
- **Experience:** When Stay begins speaking ("Let us open your taxes..."), the user speaks over it saying "Wait, actually, let's do the laundry first."
- **Behavior:** Stay cuts off speech immediately within 100 ms via `SpeechStarted` barge-in. The unfinished words are discarded, previous conversation history remains intact, and Stay smoothly addresses the laundry task.
- **Verdict:** **PASS.** Zero guilt, no robotic "please wait until I finish talking."

#### 2. Wispr Voice Editing ("Scratch that")
- **Experience:** Spoke: "I need to call the bank tomorrow, scratch that, call the accountant today."
- **Behavior:** The deterministic parser strips "scratch that" and replaces the preceding clause with "call the accountant today".
- **Verdict:** **PASS.** Eliminates need to erase or restart typing.

#### 3. Distraction / 10-Minute Walk-Away
- **Experience:** Started a 5-minute timer, walked away for 10 minutes, refreshed page.
- **Behavior:** Timer expired gracefully without alarmist red banners or guilt language. Today card displayed "Nice. That is a win" upon marking the step done. Active session remained preserved in `stay:active_session:v1`.
- **Verdict:** **PASS.** High resilience to typical ADHD task abandonment.

#### 4. Multilingual & Hinglish Switching
- **Experience:** Said: "Mujhe taxes file karna hai lekin samajh nahi aa raha kahan se shuru karun."
- **Behavior:** Detected Hindi, Stay answered with simple concrete step. In translate mode, both Hindi and English lines displayed aligned in chat feed.
- **Verdict:** **PASS.**

#### 5. Mobile Ergonomics (375 px)
- **Experience:** Tested at 375 px viewport.
- **Behavior:** No horizontal overflow (`document.documentElement.scrollWidth === document.documentElement.clientWidth`). Dock text input shrinks neatly without pushing Send button off screen.
- **Verdict:** **PASS.**
