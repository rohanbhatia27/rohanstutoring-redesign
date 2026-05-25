const TABLE_URL = `${process.env.SUPABASE_URL}/rest/v1/meeting_notes`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertSupabaseEnv() {
  if (!process.env.SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
}

function supabaseHeaders(extra = {}) {
  assertSupabaseEnv();

  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

function appendQuery(url, params) {
  const next = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      next.searchParams.set(key, value);
    }
  });

  return next.toString();
}

async function requestSupabase(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: supabaseHeaders(options.headers),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.hint || text || response.statusText;
    throw new Error(`Supabase REST error (${response.status}): ${message}`);
  }

  return data;
}

function normalizeText(value) {
  if (Array.isArray(value)) return value.join(" ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value == null ? "" : String(value);
}

function noteMatchesQuery(note, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    note.title,
    note.summary,
    note.transcript,
    note.tags,
    note.person_names,
  ]
    .map(normalizeText)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function noteMatchesFilters(note, filters = {}) {
  return Object.entries(filters).every(([key, value]) => {
    if (value === undefined || value === null || value === "") return true;
    if (key === "limit") return true;
    if (key === "q" || key === "query" || key === "search") {
      return noteMatchesQuery(note, value);
    }

    const current = note[key];
    if (Array.isArray(current)) return current.includes(value);
    return String(current) === String(value);
  });
}

async function fetchRecentRows(limit = 100) {
  const url = appendQuery(TABLE_URL, {
    select: "*",
    order: "created_at.desc",
    limit,
  });

  return requestSupabase(url, { method: "GET" });
}

async function storeMeetingNote(note) {
  const rows = await requestSupabase(TABLE_URL, {
    method: "POST",
    body: JSON.stringify(note),
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

async function listMeetingNotes(filters = {}) {
  const limit = Number(filters.limit || 100);

  const restParams = {
    select: "*",
    order: "created_at.desc",
    limit,
  };

  ["id", "external_id", "source", "lead_id", "contact_id"].forEach((key) => {
    if (filters[key]) restParams[key] = `eq.${filters[key]}`;
  });

  const rows = await requestSupabase(appendQuery(TABLE_URL, restParams), {
    method: "GET",
  });

  return rows.filter((note) => noteMatchesFilters(note, filters));
}

async function getMeetingNoteById(id) {
  if (!id) return null;

  const byExternalIdUrl = appendQuery(TABLE_URL, {
    select: "*",
    external_id: `eq.${id}`,
    limit: 1,
  });

  const byExternalId = await requestSupabase(byExternalIdUrl, { method: "GET" });
  if (byExternalId[0]) return byExternalId[0];

  const byIdUrl = appendQuery(TABLE_URL, {
    select: "*",
    id: `eq.${id}`,
    limit: 1,
  });

  try {
    const byId = await requestSupabase(byIdUrl, { method: "GET" });
    return byId[0] || null;
  } catch {
    return null;
  }
}

async function searchMeetingNotes(q) {
  const rows = await fetchRecentRows(200);
  return rows.filter((note) => noteMatchesQuery(note, q));
}

async function getLeadContext(name) {
  const query = String(name || "").trim();
  if (!query) {
    return {
      name: "",
      meetingNotes: [],
      recentNotes: [],
      summaries: [],
    };
  }

  const meetingNotes = await searchMeetingNotes(query);

  return {
    name: query,
    meetingNotes,
    recentNotes: meetingNotes.slice(0, 5),
    summaries: meetingNotes
      .map((note) => note.summary)
      .filter(Boolean)
      .slice(0, 5),
  };
}

module.exports = {
  storeMeetingNote,
  listMeetingNotes,
  getMeetingNoteById,
  searchMeetingNotes,
  getLeadContext,
};
