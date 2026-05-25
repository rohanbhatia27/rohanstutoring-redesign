'use strict';

/**
 * Meeting notes storage abstraction.
 *
 * Routes to Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise falls back to a local append-only JSONL file.
 *
 * IMPORTANT: The JSONL fallback writes to the local filesystem and is
 * suitable for development only. Vercel's serverless runtime has an
 * ephemeral read-only filesystem — writes will be silently lost in
 * production unless Supabase is configured.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const TABLE = 'meeting_notes';
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'meeting-notes');
const JSONL_FILE = path.join(DATA_DIR, 'notes.jsonl');

// ---- Routing helper ----

function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---- Supabase implementation ----

async function supabaseStore(note) {
  const client = getSupabaseClient();

  if (note.external_id) {
    const { data: existing } = await client
      .from(TABLE)
      .select('id')
      .eq('external_id', note.external_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await client
        .from(TABLE)
        .update({ ...note, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Supabase update failed: ${error.message}`);
      return data;
    }
  }

  const { data, error } = await client
    .from(TABLE)
    .insert(note)
    .select()
    .single();
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return data;
}

async function supabaseList({ q, type, tag, person, limit = 20 } = {}) {
  const client = getSupabaseClient();
  const cap = Math.min(Number(limit) || 20, 100);

  let query = client
    .from(TABLE)
    .select(
      'id, external_id, source, title, meeting_type, person_names, attendee_emails, ' +
      'started_at, ended_at, duration_minutes, summary, action_items, decisions, tags, ' +
      'created_at, updated_at'
    )
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(cap);

  if (type) {
    query = query.eq('meeting_type', type);
  }
  if (tag) {
    query = query.contains('tags', [tag]);
  }
  if (person) {
    const safe = sanitiseLikeParam(person);
    query = query.or(
      `title.ilike.%${safe}%,summary.ilike.%${safe}%`
    );
  }
  if (q) {
    const safe = sanitiseLikeParam(q);
    query = query.or(
      `title.ilike.%${safe}%,summary.ilike.%${safe}%,transcript.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return data || [];
}

async function supabaseGetById(id) {
  const client = getSupabaseClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data, error } = isUuid
    ? await client.from(TABLE).select('*').eq('id', id).maybeSingle()
    : await client.from(TABLE).select('*').eq('external_id', id).maybeSingle();

  if (error) throw new Error(`Supabase get failed: ${error.message}`);
  return data || null;
}

async function supabaseSearch(q) {
  const client = getSupabaseClient();
  const safe = sanitiseLikeParam(q);

  const { data, error } = await client
    .from(TABLE)
    .select(
      'id, external_id, source, title, meeting_type, person_names, attendee_emails, ' +
      'started_at, ended_at, duration_minutes, summary, action_items, decisions, tags, ' +
      'created_at, updated_at'
    )
    .or(
      `title.ilike.%${safe}%,summary.ilike.%${safe}%,transcript.ilike.%${safe}%`
    )
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Supabase search failed: ${error.message}`);
  return data || [];
}

// Prevent PostgREST injection via ilike values
function sanitiseLikeParam(s) {
  return String(s).replace(/[%_']/g, c => (c === "'" ? "''" : `\\${c}`));
}

// ---- JSONL fallback (local development only) ----

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllNotes() {
  if (!fs.existsSync(JSONL_FILE)) return [];
  return fs
    .readFileSync(JSONL_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function jsonlStore(note) {
  ensureDataDir();
  const all = readAllNotes();

  if (note.external_id) {
    const idx = all.findIndex(n => n.external_id === note.external_id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...note, updated_at: new Date().toISOString() };
      fs.writeFileSync(JSONL_FILE, all.map(n => JSON.stringify(n)).join('\n') + '\n');
      return all[idx];
    }
  }

  const record = {
    id: randomUUID(),
    ...note,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  fs.appendFileSync(JSONL_FILE, JSON.stringify(record) + '\n');
  return record;
}

function jsonlList({ q, type, tag, person, limit = 20 } = {}) {
  let notes = readAllNotes();

  if (type) notes = notes.filter(n => n.meeting_type === type);
  if (tag) notes = notes.filter(n => Array.isArray(n.tags) && n.tags.includes(tag));
  if (person) {
    const p = person.toLowerCase();
    notes = notes.filter(n =>
      (n.title && n.title.toLowerCase().includes(p)) ||
      (n.summary && n.summary.toLowerCase().includes(p)) ||
      (Array.isArray(n.person_names) && n.person_names.some(name => name.toLowerCase().includes(p)))
    );
  }
  if (q) {
    const lq = q.toLowerCase();
    notes = notes.filter(n =>
      (n.title && n.title.toLowerCase().includes(lq)) ||
      (n.summary && n.summary.toLowerCase().includes(lq)) ||
      (n.transcript && n.transcript.toLowerCase().includes(lq))
    );
  }

  return notes
    .sort((a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at))
    .slice(0, Math.min(Number(limit) || 20, 100))
    .map(({ transcript: _t, raw_payload: _r, ...rest }) => rest);
}

function jsonlGetById(id) {
  return readAllNotes().find(n => n.id === id || n.external_id === id) || null;
}

function jsonlSearch(q) {
  const lq = q.toLowerCase();
  return readAllNotes()
    .filter(n =>
      (n.title && n.title.toLowerCase().includes(lq)) ||
      (n.summary && n.summary.toLowerCase().includes(lq)) ||
      (n.transcript && n.transcript.toLowerCase().includes(lq)) ||
      (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(lq)))
    )
    .slice(0, 50)
    .map(({ transcript: _t, raw_payload: _r, ...rest }) => rest);
}

// ---- Lead context helper ----

function extractSentences(note, keywords) {
  if (!note) return [];
  const text = [note.summary, note.transcript].filter(Boolean).join(' ').toLowerCase();
  return text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && keywords.some(k => s.includes(k)))
    .slice(0, 5);
}

function suggestNextStep(note, name) {
  if (!note) return null;
  const items = Array.isArray(note.action_items) ? note.action_items : [];
  if (items.length) return `Follow up: ${items[0]}`;
  const fallbackName =
    (Array.isArray(note.person_names) && note.person_names[0]) || name;
  return `Review most recent call summary and follow up with ${fallbackName}.`;
}

// ---- Public API ----

async function storeMeetingNote(note) {
  return isSupabaseConfigured() ? supabaseStore(note) : jsonlStore(note);
}

async function listMeetingNotes(filters) {
  return isSupabaseConfigured() ? supabaseList(filters) : jsonlList(filters);
}

async function getMeetingNoteById(id) {
  return isSupabaseConfigured() ? supabaseGetById(id) : jsonlGetById(id);
}

async function searchMeetingNotes(q) {
  return isSupabaseConfigured() ? supabaseSearch(q) : jsonlSearch(q);
}

async function getLeadContext(name) {
  const meetings = await listMeetingNotes({ person: name, limit: 10 });
  if (!meetings.length) return null;

  const sorted = [...meetings].sort(
    (a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at)
  );

  const mostRecent = sorted[0];
  const fullRecord = await getMeetingNoteById(mostRecent.id);

  const painPoints = extractSentences(fullRecord, [
    'concern', 'worried', 'struggling', 'pain', 'problem', 'challenge', 'difficult', 'issue',
  ]);
  const objections = extractSentences(fullRecord, [
    'price', 'cost', 'expensive', 'too much', 'not sure', 'unsure', 'hesitant', 'but ', 'however',
  ]);

  const allActionItems = meetings
    .flatMap(m => (Array.isArray(m.action_items) ? m.action_items : []))
    .filter(Boolean);

  return {
    name,
    meeting_count: meetings.length,
    most_recent_call: {
      id: mostRecent.id,
      title: mostRecent.title,
      date: mostRecent.started_at || mostRecent.created_at,
      summary: mostRecent.summary || null,
    },
    pain_points: painPoints,
    objections: objections,
    open_action_items: allActionItems,
    suggested_next_step: suggestNextStep(fullRecord, name),
    meetings: sorted,
  };
}

module.exports = {
  storeMeetingNote,
  listMeetingNotes,
  getMeetingNoteById,
  searchMeetingNotes,
  getLeadContext,
};
