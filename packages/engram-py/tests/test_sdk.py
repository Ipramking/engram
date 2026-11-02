"""
Automated Test Suite for Engram 2.0 Python SDK
"""
import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add package to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engram import Engram, remember, recall, handoff, snapshot
import engram
from engram.models import MemoryRecord, HandoffRecord, ContinuitySnapshot

# Configure default client for offline unit test mode
engram._default_client = Engram(host="http://localhost:59999", offline_fallback=True)

def test_models():
    print("  [1/5] Testing data models...")
    rec = MemoryRecord(
        type="decision",
        text="Use Walrus for blob storage",
        category="project",
        confidence=0.95,
        importance="high"
    )
    assert rec.type == "decision"
    assert rec.text == "Use Walrus for blob storage"
    assert rec.category == "project"

    handoff = HandoffRecord(
        id="handoff_123",
        project_id="proj_01",
        from_agent="Claude",
        to_agent="Cursor",
        task_state="in_progress",
        handoff_notes="Notes",
        next_actions=["Step 1", "Step 2"]
    )
    assert handoff.next_actions == ["Step 1", "Step 2"]
    print("  ✓ PASS: Models validated")

def test_offline_fallback():
    print("  [2/5] Testing offline fallback and local cache...")
    client = Engram(host="http://localhost:59999", offline_fallback=True) # Unreachable port
    
    # Remember should not crash, but save to local cache
    rec = client.remember("Offline preference test", type="preference")
    assert rec.text == "Offline preference test"
    assert rec.type == "preference"

    # Recall should find cached memory
    results = client.recall("preference")
    assert len(results) >= 1
    assert "preference" in results[0].text.lower()
    print("  ✓ PASS: Offline fallback validated")

def test_client_configuration():
    print("  [3/5] Testing client configuration and headers...")
    client = Engram(
        api_key="eng_live_testkey123",
        host="https://custom-engram.internal",
        default_scope="team",
        default_team="team_devs"
    )
    headers = client._headers()
    assert headers["Authorization"] == "Bearer eng_live_testkey123"
    assert client.default_scope == "team"
    assert client.default_team == "team_devs"
    assert client.host == "https://custom-engram.internal"
    print("  ✓ PASS: Configuration and headers validated")

def test_module_convenience_functions():
    print("  [4/5] Testing module-level exports (remember, recall, handoff, snapshot)...")
    rec = remember("Module level memory", type="config")
    assert rec.text == "Module level memory"
    assert rec.type == "config"

    results = recall("Module")
    assert len(results) >= 1

    h = handoff(
        project_id="proj_mod",
        from_agent="Agent A",
        to_agent="Agent B",
        task_state="testing",
        notes="Module handoff test",
        next_actions=["Deploy"]
    )
    assert h.project_id == "proj_mod"
    assert h.to_agent == "Agent B"
    print("  ✓ PASS: Module functions validated")

def test_provenance_tracking():
    print("  [5/5] Testing agent provenance and confidence attributes...")
    client = Engram(host="http://localhost:59999", offline_fallback=True)
    rec = client.remember(
        "Provenance test fact",
        type="gotcha",
        source_agent="Antigravity Agent",
        model="gemini-2.0-flash",
        confidence=0.99
    )
    assert rec.source_agent == "Antigravity Agent"
    assert rec.model == "gemini-2.0-flash"
    assert rec.confidence == 0.99
    print("  ✓ PASS: Provenance tracking validated")

if __name__ == "__main__":
    print("\n🐍 RUNNING ENGRAM 2.0 PYTHON SDK TEST SUITE")
    print("===========================================")
    test_models()
    test_offline_fallback()
    test_client_configuration()
    test_module_convenience_functions()
    test_provenance_tracking()
    print("===========================================")
    print("🎉 ALL PYTHON SDK TESTS PASSED!\n")
