"""
Engram 2.0 Client Library for Python
Universal, Portable Memory Layer for AI Agents
"""
import os
import json
import urllib.request
import urllib.error
import urllib.parse
from typing import List, Optional, Dict, Any
from .models import MemoryRecord, HandoffRecord, ContinuitySnapshot

DEFAULT_HOST = "https://engram-pearl.vercel.app"

class EngramError(Exception):
    """Base exception for Engram API errors."""
    pass

class EngramAuthError(EngramError):
    """Authentication or authorization failure."""
    pass

class Engram:
    """
    Client for interacting with the Engram Decentralized AI Memory Vault.
    
    Example:
        client = Engram(api_key="eng_live_...")
        client.remember("We moved backend to TypeScript", type="decision")
        memories = client.recall("What language is the backend?")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        host: Optional[str] = None,
        default_scope: str = "personal",
        default_team: Optional[str] = None,
        offline_fallback: bool = False,
    ):
        self.api_key = api_key or os.getenv("ENGRAM_API_KEY") or os.getenv("ENGRAM_TOKEN") or ""
        self.host = (host or os.getenv("ENGRAM_HOST") or DEFAULT_HOST).rstrip("/")
        self.default_scope = default_scope
        self.default_team = default_team or os.getenv("ENGRAM_TEAM_CODE")
        self.offline_fallback = offline_fallback
        self._local_cache: List[MemoryRecord] = []

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "engram-python-sdk/2.0.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.host}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("error", err_json.get("message", str(e)))
            except Exception:
                msg = err_body or str(e)

            if e.code in (401, 403):
                raise EngramAuthError(f"Engram [{e.code}]: {msg}")
            raise EngramError(f"Engram [{e.code}]: {msg}")
        except TimeoutError as e:
            raise EngramError(f"Engram request timed out: {e}")
        except urllib.error.URLError as e:
            if self.offline_fallback:
                return {"_offline": True, "error": str(e.reason)}
            raise EngramError(f"Engram connection error: {e.reason}")

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        query_string = f"?{urllib.parse.urlencode(params)}" if params else ""
        url = f"{self.host}{path}{query_string}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                body = response.read().decode("utf-8")
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    return json.loads(body)
                return body
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            if e.code in (401, 403):
                raise EngramAuthError(f"Engram [{e.code}]: {err_body}")
            raise EngramError(f"Engram [{e.code}]: {err_body}")
        except TimeoutError as e:
            raise EngramError(f"Engram request timed out: {e}")
        except urllib.error.URLError as e:
            if self.offline_fallback:
                return {"_offline": True, "error": str(e.reason)}
            raise EngramError(f"Engram connection error: {e.reason}")

    def remember(
        self,
        text: str,
        type: str = "decision",
        scope: Optional[str] = None,
        team_code: Optional[str] = None,
        source_agent: Optional[str] = None,
        model: Optional[str] = None,
        confidence: float = 1.0,
    ) -> MemoryRecord:
        """
        Store a durable, self-contained fact in personal or team memory.
        """
        resolved_scope = scope or self.default_scope
        resolved_team = team_code or self.default_team

        payload = {
            "text": text.strip(),
            "type": type,
            "scope": resolved_scope,
            "teamCode": resolved_team,
            "source_agent": source_agent,
            "model": model,
            "confidence": confidence,
        }

        resp = self._post("/api/remember", payload)
        if resp.get("_offline"):
            rec = MemoryRecord(
                type=type,
                text=text,
                category=type,
                confidence=confidence,
                source_agent=source_agent,
                model=model,
            )
            self._local_cache.append(rec)
            return rec

        mem = resp.get("memory", {})
        return MemoryRecord(
            type=mem.get("type", type),
            text=mem.get("text", text),
            blob_id=resp.get("blobId") or mem.get("blob_id"),
            category=resp.get("category"),
            confidence=resp.get("confidence", confidence),
            importance=resp.get("importance", "normal"),
            sensitivity=resp.get("sensitivity", "public"),
            source_agent=source_agent,
            model=model,
            created_at=mem.get("createdAt") or mem.get("created_at"),
        )

    def recall(
        self,
        query: str,
        scope: Optional[str] = None,
        team_code: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 8,
    ) -> List[MemoryRecord]:
        """
        Retrieve relevant memories by semantic meaning and hybrid ranking.
        """
        resolved_scope = scope or self.default_scope
        resolved_team = team_code or self.default_team

        payload = {
            "query": query.strip(),
            "scope": resolved_scope,
            "teamCode": resolved_team,
            "category": category,
            "topK": limit,
        }

        resp = self._post("/api/recall", payload)
        if resp.get("_offline"):
            # Search local cache
            q = query.lower()
            return [m for m in self._local_cache if q in m.text.lower()][:limit]

        raw_memories = resp.get("memories") or resp.get("results") or []
        records = []
        for m in raw_memories:
            records.append(
                MemoryRecord(
                    type=m.get("type", "decision"),
                    text=m.get("text", ""),
                    blob_id=m.get("blobId"),
                    category=m.get("category"),
                    confidence=m.get("confidence", 1.0),
                    importance=m.get("importance", "normal"),
                    sensitivity=m.get("sensitivity", "public"),
                    created_at=m.get("createdAt") or m.get("created_at"),
                )
            )
        return records

    def handoff(
        self,
        project_id: Optional[str] = None,
        from_agent: str = "Python Agent",
        to_agent: str = "Next Agent",
        task_state: str = "in_progress",
        notes: str = "",
        next_actions: Optional[List[str]] = None,
        unresolved_questions: Optional[List[str]] = None,
    ) -> HandoffRecord:
        """
        Record a structured cross-agent handoff to guarantee context continuity.
        """
        payload = {
            "action": "handoff",
            "projectId": project_id or "default_project",
            "fromAgent": from_agent,
            "toAgent": to_agent,
            "taskState": task_state,
            "handoffNotes": notes or "Agent finished task.",
            "nextActions": next_actions or [],
            "unresolvedQuestions": unresolved_questions or [],
        }

        resp = self._post("/api/continuity", payload)
        handoff_data = resp.get("handoff", {})
        return HandoffRecord(
            id=handoff_data.get("id", "handoff_local"),
            project_id=handoff_data.get("projectId", project_id or "default_project"),
            from_agent=handoff_data.get("fromAgent", from_agent),
            to_agent=handoff_data.get("toAgent", to_agent),
            task_state=handoff_data.get("taskState", task_state),
            handoff_notes=handoff_data.get("handoffNotes", notes),
            next_actions=handoff_data.get("nextActions", next_actions or []),
            unresolved_questions=handoff_data.get("unresolvedQuestions", unresolved_questions or []),
            created_at=handoff_data.get("createdAt"),
        )

    def snapshot(
        self,
        project_id: Optional[str] = None,
        action: str = "brief",
    ) -> ContinuitySnapshot:
        """
        Export or inspect a verifiable project continuity snapshot.
        """
        p_id = project_id or "default_project"
        if action == "brief":
            resp = self._get("/api/continuity", {"projectId": p_id, "action": "resume"})
            if isinstance(resp, dict):
                return ContinuitySnapshot(
                    snapshot_id=resp.get("snapshotId", "snap_current"),
                    project_id=p_id,
                    project_name="Current Project",
                    checksum=resp.get("checksum", ""),
                    created_at="",
                    quick_resume_brief=resp.get("brief", ""),
                )
            return ContinuitySnapshot(
                snapshot_id="snap_current",
                project_id=p_id,
                project_name="Current Project",
                checksum="",
                created_at="",
                quick_resume_brief=str(resp),
            )

        payload = {"action": "snapshot", "projectId": p_id}
        resp = self._post("/api/continuity", payload)
        snap = resp.get("snapshot", {})
        return ContinuitySnapshot(
            snapshot_id=snap.get("snapshotId", ""),
            project_id=snap.get("projectId", p_id),
            project_name=snap.get("projectName", ""),
            checksum=resp.get("checksum", ""),
            created_at=snap.get("createdAt", ""),
            quick_resume_brief=resp.get("brief", ""),
            context=snap.get("context", {}),
        )
