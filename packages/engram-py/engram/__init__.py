"""
Engram: Universal, Portable AI Memory Layer
"""
from typing import Optional, List, Dict, Any
from .client import Engram, EngramError, EngramAuthError
from .models import MemoryRecord, HandoffRecord, ContinuitySnapshot

__version__ = "2.0.0"
__all__ = [
    "Engram",
    "EngramError",
    "EngramAuthError",
    "MemoryRecord",
    "HandoffRecord",
    "ContinuitySnapshot",
    "remember",
    "recall",
    "handoff",
    "snapshot",
]

_default_client: Optional[Engram] = None

def get_client() -> Engram:
    global _default_client
    if _default_client is None:
        _default_client = Engram()
    return _default_client

def remember(
    text: str,
    type: str = "decision",
    scope: Optional[str] = None,
    team_code: Optional[str] = None,
    source_agent: Optional[str] = None,
    model: Optional[str] = None,
    confidence: float = 1.0,
) -> MemoryRecord:
    """
    Store a durable fact in Engram memory.
    
    Example:
        from engram import remember
        remember("User prefers Dark Mode and Rose-Gold accents", type="preference")
    """
    return get_client().remember(
        text=text,
        type=type,
        scope=scope,
        team_code=team_code,
        source_agent=source_agent,
        model=model,
        confidence=confidence,
    )

def recall(
    query: str,
    scope: Optional[str] = None,
    team_code: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 8,
) -> List[MemoryRecord]:
    """
    Recall memories most relevant to a query.
    
    Example:
        from engram import recall
        facts = recall("What UI theme does the user like?")
    """
    return get_client().recall(
        query=query,
        scope=scope,
        team_code=team_code,
        category=category,
        limit=limit,
    )

def handoff(
    project_id: Optional[str] = None,
    from_agent: str = "Python Agent",
    to_agent: str = "Next Agent",
    task_state: str = "in_progress",
    notes: str = "",
    next_actions: Optional[List[str]] = None,
    unresolved_questions: Optional[List[str]] = None,
) -> HandoffRecord:
    """
    Record an agent-to-agent handoff for continuous context across sessions.
    """
    return get_client().handoff(
        project_id=project_id,
        from_agent=from_agent,
        to_agent=to_agent,
        task_state=task_state,
        notes=notes,
        next_actions=next_actions,
        unresolved_questions=unresolved_questions,
    )

def snapshot(
    project_id: Optional[str] = None,
    action: str = "brief",
) -> ContinuitySnapshot:
    """
    Export or view a verifiable project continuity snapshot.
    """
    return get_client().snapshot(
        project_id=project_id,
        action=action,
    )
