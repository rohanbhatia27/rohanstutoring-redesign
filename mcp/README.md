# Meeting Notes MCP Server (Future)

This directory is reserved for a Model Context Protocol (MCP) server that will
expose the meeting notes warehouse to Claude and other MCP-compatible clients.

Once built, this server will read from the same Supabase `meeting_notes` table
via the same `_meeting-store.js` helper, but exposed as named MCP tools instead
of HTTP endpoints.

---

## Planned Tools

### `search_meeting_notes`
Search across all stored meeting notes.

**Input:** `{ q: string, limit?: number }`
**Returns:** List of matching meetings (without transcript).

---

### `get_meeting`
Retrieve a single meeting note in full, including transcript.

**Input:** `{ id: string }` — accepts internal UUID or external_id.
**Returns:** Complete meeting note record.

---

### `get_lead_context`
Build a context profile for a named person across all recorded calls.

**Input:** `{ name: string }`
**Returns:** Meeting count, most recent summary, pain points, objections,
open action items, and suggested next step.

---

### `summarise_student_history`
Summarise the full history of interactions with a named student.

**Input:** `{ student_name: string }`
**Returns:** Session count, topics covered, progress notes, upcoming
follow-ups, and any course or product mentions.

---

### `find_unresolved_followups`
Find action items from past meetings that have not been marked complete.

**Input:** `{ limit?: number }`
**Returns:** List of unresolved action items with the meeting title,
date, and the action item text.

---

### `extract_sales_objections`
Collect all recorded price/cost/hesitancy signals across sales calls.

**Input:** `{ person?: string, since?: string }` (ISO date)
**Returns:** Objection sentences, meeting source, and date.

---

### `extract_course_feedback`
Gather feedback and sentiment from student calls.

**Input:** `{ course?: string, since?: string }`
**Returns:** Feedback sentences grouped by course (if discernible from
meeting type or title).

---

## Implementation Notes

- The MCP server will be a Node.js process using the official
  `@modelcontextprotocol/sdk` package.
- It should share `_meeting-store.js` with the existing HTTP API — no
  duplicated storage logic.
- Authentication will use a dedicated MCP API key (separate from
  `MEETING_NOTES_API_KEY`).
- Start here: https://modelcontextprotocol.io/docs/concepts/tools
