"""
Checks for the phone agent's own logic (no call, no network to AssemblyAI or Groq). Run:

    uv run --no-project --with-requirements agent/requirements.txt --with pytest pytest agent/test_agent.py -q
"""

import asyncio
import inspect
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import agent as stay  # noqa: E402
from livekit.agents import JobContext, StopResponse  # noqa: E402


def test_region_from_the_callers_number():
    assert stay.region_from_number("+44 7700 900123") == "GB"
    assert stay.region_from_number("+1 (415) 555-0100") == "US"
    assert stay.region_from_number("+91 98765 43210") == "OTHER"
    assert stay.region_from_number(None) is None
    assert stay.region_from_number("07700900123") is None  # no country code: every region's numbers are given


@pytest.mark.parametrize("text", ["I want to kill myself", "i keep thinking about suicide", "I want to end my life", "I might overdose"])
def test_local_list_stops_crisis_words(text):
    assert stay.local_verdict(text)[0] == "crisis"


@pytest.mark.parametrize("text", ["should I double my adderall", "how much ritalin can I take", "can I skip my meds today"])
def test_local_list_stops_dosing_questions(text):
    assert stay.local_verdict(text)[0] == "medication"


@pytest.mark.parametrize("text", ["I keep avoiding my taxes", "my landlord email is due", "how do I start cleaning"])
def test_local_list_lets_ordinary_talk_through(text):
    assert stay.local_verdict(text) == ("ok", None)


def test_unreachable_web_check_falls_back_to_the_local_lists(monkeypatch):
    monkeypatch.setattr(stay, "STAY_URL", "http://127.0.0.1:9")  # nothing listens there
    assert asyncio.run(stay.check_safety("I want to kill myself", "GB"))[0] == "crisis"
    assert asyncio.run(stay.check_safety("I keep avoiding my taxes", "GB")) == ("ok", None)


class FakeSession:
    def __init__(self):
        self.said = []

    def say(self, text, **_):
        self.said.append(text)


def make_agent(monkeypatch, verdict):
    async def fake_check(text, region, http=None):
        return verdict

    monkeypatch.setattr(stay, "check_safety", fake_check)
    agent = stay.StayPhone(region="GB")
    session = FakeSession()
    monkeypatch.setattr(stay.StayPhone, "session", property(lambda self: session))
    return agent, session


class Msg:
    def __init__(self, text):
        self.text_content = text


def test_crisis_words_are_answered_by_the_fixed_message_and_the_model_is_never_asked(monkeypatch):
    agent, session = make_agent(monkeypatch, ("crisis", "call Samaritans on 116 123"))
    with pytest.raises(StopResponse):
        asyncio.run(agent.on_user_turn_completed(None, Msg("I want to end my life")))
    assert session.said == ["call Samaritans on 116 123"]


def test_ordinary_words_go_on_to_the_model(monkeypatch):
    agent, session = make_agent(monkeypatch, ("ok", None))
    asyncio.run(agent.on_user_turn_completed(None, Msg("I keep avoiding my taxes")))
    assert session.said == []


def test_greeting_says_it_is_an_ai_first():
    assert "I'm an AI, not a person" in stay.GREETING


def test_the_livekit_calls_used_exist_in_this_version():
    assert inspect.iscoroutinefunction(stay.entrypoint)
    assert hasattr(JobContext, "shutdown") and hasattr(JobContext, "add_shutdown_callback")
