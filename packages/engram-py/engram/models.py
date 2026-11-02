"""
Engram 2.0 Data Models for Python SDK
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class MemoryRecord:
    type: str
    text: str
    blob_id: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = 1.0
    importance: Optional[str] = "normal"
    sensitivity: Optional[str] = "public"
    source_agent: Optional[str] = None
    model: Optional[str] = None
    created_at: Optional[str] = None

@dataclass
class HandoffRecord:
    id: str
    project_id: str
    from_agent: str
    to_agent: str
    task_state: str
    handoff_notes: str
    next_actions: List[str] = field(default_factory=list)
    unresolved_questions: List[str] = field(default_factory=list)
    created_at: Optional[str] = None

@dataclass
class ContinuitySnapshot:
    snapshot_id: str
    project_id: str
    project_name: str
    checksum: str
    created_at: str
    quick_resume_brief: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
