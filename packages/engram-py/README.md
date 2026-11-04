# engram-memory (Python SDK)

The universal, portable memory layer for AI agents.

Engram gives autonomous agents (Claude, Cursor, AutoGen, CrewAI, LangChain, Gemini) persistent, verified, decentralized memory across models, sessions, and devices.

## Installation

```bash
pip install "git+https://github.com/Ipramking/engram#subdirectory=packages/engram-py"
```

## Quick Start

### 1. Convenience Functions

```python
from engram import remember, recall, handoff

# Remember a durable architectural choice
remember("We use Supabase PostgreSQL for metadata and Walrus for decentralized blob storage", type="decision")

# Recall before answering questions that depend on past context
memories = recall("What database do we use?")
for m in memories:
    print(f"[{m.type}] {m.text}")

# Zero-cold-start agent handoff
handoff(
    project_id="proj_alpha",
    from_agent="Claude Code",
    to_agent="Cursor IDE",
    task_state="Milestone 3 complete",
    notes="Finished continuity engine and verified 13/13 tests.",
    next_actions=["Build Python SDK", "Run production build"]
)
```

### 2. Client Instance (Multi-tenant or Custom Config)

```python
from engram import Engram

client = Engram(
    api_key="eng_live_...",
    host="https://engram-pearl.vercel.app",
    default_scope="personal" # or "team"
)

# Remember with full provenance
client.remember(
    "User prefers Aubergine & Rose-Gold dashboard theme",
    type="preference",
    source_agent="Antigravity",
    model="gemini-2.0-flash",
    confidence=0.99
)
```

## Memory Types

* `decision`: An architectural or process choice + rationale.
* `config`: A concrete configuration value or resource location.
* `gotcha`: A non-obvious pitfall, bug, or workaround.
* `person`: A stable fact or preference regarding a teammate or collaborator.
* `preference`: A lasting user preference, constraint, or style guide.
* `plan`: A multi-step spec, roadmap, or task list.

## License

MIT
