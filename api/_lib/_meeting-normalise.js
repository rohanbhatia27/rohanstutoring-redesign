'use strict';

/**
 * Safely reads a dot-notation path from an object.
 * e.g. getPath(obj, 'calendar_event.title')
 */
function getPath(obj, path) {
  return path.split('.').reduce(
    (o, k) => (o !== null && o !== undefined ? o[k] : undefined),
    obj
  );
}

/**
 * Returns the first non-empty value found at any of the given dot-paths.
 */
function pick(obj, ...paths) {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/**
 * Normalises an incoming Spellar (or Spellar-compatible) webhook payload into
 * the shape expected by storeMeetingNote(). Never throws — stores what is
 * available and returns null for missing fields.
 *
 * @param {object} raw  The raw parsed JSON body from the webhook request.
 * @returns {object}    Normalised meeting note ready for storage.
 */
function normaliseSpellarPayload(raw) {
  const r = raw || {};

  // ---- Attendees ----
  let attendees = pick(r, 'attendees', 'participants', 'calendar_event.attendees') || [];
  if (!Array.isArray(attendees)) attendees = [attendees].filter(Boolean);

  const personNames = attendees
    .map(a =>
      typeof a === 'string'
        ? a
        : String(a.name || a.display_name || a.full_name || '').trim() || null
    )
    .filter(Boolean);

  const attendeeEmails = attendees
    .map(a =>
      typeof a === 'object' && a !== null
        ? String(a.email || '').trim().toLowerCase() || null
        : null
    )
    .filter(Boolean);

  // ---- Duration ----
  let durationMinutes = pick(r, 'duration_minutes', 'duration');
  if (durationMinutes !== null) {
    durationMinutes = Math.round(Number(durationMinutes));
    if (isNaN(durationMinutes)) durationMinutes = null;
  }

  // ---- Action items ----
  let actionItems = pick(r, 'action_items', 'tasks', 'follow_ups', 'notes.action_items');
  if (actionItems !== null && !Array.isArray(actionItems)) actionItems = [actionItems];

  // ---- Decisions ----
  let decisions = pick(r, 'decisions', 'notes.decisions');
  if (decisions !== null && !Array.isArray(decisions)) decisions = [decisions];

  // ---- Tags ----
  let tags = pick(r, 'tags', 'labels', 'categories');
  if (tags !== null && !Array.isArray(tags)) tags = [tags];

  return {
    external_id:
      String(pick(r, 'id', 'meeting_id', 'note_id', 'event_id') || '').trim() || null,
    source: 'spellar',
    title: String(
      pick(r, 'title', 'name', 'meeting_title', 'calendar_event.title') || 'Untitled Meeting'
    ).trim(),
    meeting_type: String(pick(r, 'meeting_type', 'type', 'call_type') || '').trim() || null,
    person_names: personNames.length ? personNames : null,
    attendee_emails: attendeeEmails.length ? attendeeEmails : null,
    started_at: pick(r, 'started_at', 'start_time', 'date', 'created_at') || null,
    ended_at: pick(r, 'ended_at', 'end_time') || null,
    duration_minutes: durationMinutes,
    summary: String(
      pick(r, 'summary', 'ai_summary', 'notes.summary', 'markdown_summary') || ''
    ).trim() || null,
    transcript: String(
      pick(r, 'transcript', 'text', 'notes.transcript', 'full_transcript') || ''
    ).trim() || null,
    action_items: actionItems,
    decisions: decisions,
    tags: tags,
    raw_payload: r,
  };
}

module.exports = { normaliseSpellarPayload };
