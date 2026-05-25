#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BASE_ORIGIN = 'https://www.rohanstutoring.com';
const DEFAULT_MAX_HOPS = 5;
const DEFAULT_TIMEOUT_MS = 8000;

function normalizeUrl(value, baseOrigin = DEFAULT_BASE_ORIGIN) {
  const trimmed = String(value || '').trim();

  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed).toString();
  }

  return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, baseOrigin).toString();
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseAuditList(text, options = {}) {
  const baseOrigin = options.baseOrigin || DEFAULT_BASE_ORIGIN;
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const isCsv = first.includes(',') && first.includes('source');

  if (!isCsv) {
    return lines.map((line) => ({
      source: normalizeUrl(line, baseOrigin),
      expected: '',
      label: '',
    }));
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const sourceIndex = headers.indexOf('source');
  const expectedIndex = headers.indexOf('expected');
  const labelIndex = headers.indexOf('label');

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      source: normalizeUrl(cells[sourceIndex], baseOrigin),
      expected: expectedIndex >= 0 ? normalizeUrl(cells[expectedIndex], baseOrigin) : '',
      label: labelIndex >= 0 ? cells[labelIndex] || '' : '',
    };
  }).filter((entry) => entry.source);
}

function analyzeRedirectResult({ source, expected = '', label = '', hops = [], error = '' }) {
  const finalHop = hops[hops.length - 1] || null;
  const finalUrl = finalHop ? finalHop.url : '';
  const finalStatus = finalHop ? finalHop.status : 0;
  const hopCount = Math.max(hops.length - 1, 0);
  const notes = [];

  if (error) notes.push(error);
  if (hopCount > 1) notes.push('redirect_chain');
  if (finalStatus !== 200) notes.push(`final_status_${finalStatus || 'unknown'}`);
  if (!finalUrl) notes.push('missing_final_url');
  if (expected && finalUrl !== expected) notes.push('expected_mismatch');

  return {
    source,
    expected,
    finalUrl,
    finalStatus,
    hopCount,
    ok: notes.length === 0 ? 'yes' : 'no',
    label,
    notes: notes.join(';'),
  };
}

function toCsvCell(value) {
  return `"${String(value == null ? '' : value).replaceAll('"', '""')}"`;
}

function toCsvRow(row) {
  return [
    row.source,
    row.expected,
    row.finalUrl,
    row.finalStatus,
    row.hopCount,
    row.ok,
    row.label,
    row.notes,
  ].map(toCsvCell).join(',');
}

function formatRequestError(error) {
  if (!error) return 'request_failed';

  const causeCode = error.cause && error.cause.code ? String(error.cause.code).trim() : '';
  if (causeCode) {
    return `fetch_failed:${causeCode}`;
  }

  const message = error.message ? String(error.message).trim() : '';
  if (!message) return 'request_failed';

  return message.toLowerCase().replaceAll(/\s+/g, '_');
}

async function traceRedirects(source, options = {}) {
  const maxHops = Number.isInteger(options.maxHops) ? options.maxHops : DEFAULT_MAX_HOPS;
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl || fetch;
  const hops = [];
  let currentUrl = source;

  for (let index = 0; index <= maxHops; index += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      response = await fetchImpl(currentUrl, {
        redirect: 'manual',
        headers: {
          'user-agent': 'redirect-audit/1.0',
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error(`timeout_${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const location = response.headers.get('location') || '';
    hops.push({
      url: currentUrl,
      status: response.status,
      location: location ? new URL(location, currentUrl).toString() : '',
    });

    if (!location || response.status < 300 || response.status > 399) {
      return hops;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`max_hops_exceeded_${maxHops}`);
}

function parseArgs(argv) {
  const args = {
    inputFile: '',
    outputFile: '',
    baseOrigin: DEFAULT_BASE_ORIGIN,
    maxHops: DEFAULT_MAX_HOPS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    quiet: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--output=')) {
      args.outputFile = arg.slice('--output='.length);
      continue;
    }

    if (arg.startsWith('--origin=')) {
      args.baseOrigin = arg.slice('--origin='.length);
      continue;
    }

    if (arg.startsWith('--max-hops=')) {
      args.maxHops = Number.parseInt(arg.slice('--max-hops='.length), 10);
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      args.timeoutMs = Number.parseInt(arg.slice('--timeout-ms='.length), 10);
      continue;
    }

    if (arg === '--quiet') {
      args.quiet = true;
      continue;
    }

    if (!args.inputFile) {
      args.inputFile = arg;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.inputFile) {
    console.error('Usage: node scripts/redirect-audit.js <input-file> [--output=tmp/audit/report.csv] [--origin=https://www.rohanstutoring.com] [--max-hops=5]');
    process.exitCode = 1;
    return;
  }

  const absoluteInputFile = path.resolve(process.cwd(), args.inputFile);
  const text = fs.readFileSync(absoluteInputFile, 'utf8');
  const entries = parseAuditList(text, { baseOrigin: args.baseOrigin });
  const rows = [];

  if (!args.quiet) {
    console.error(`[redirect-audit] Auditing ${entries.length} URLs with ${args.timeoutMs}ms timeout per request`);
  }

  for (const [index, entry] of entries.entries()) {
    if (!args.quiet) {
      console.error(`[redirect-audit] ${index + 1}/${entries.length} ${entry.source}`);
    }

    try {
      const hops = await traceRedirects(entry.source, {
        maxHops: args.maxHops,
        timeoutMs: args.timeoutMs,
      });
      rows.push(analyzeRedirectResult({ ...entry, hops }));
    } catch (error) {
      rows.push(analyzeRedirectResult({
        ...entry,
        hops: [],
        error: formatRequestError(error),
      }));
    }
  }

  const output = [
    'source,expected,final_url,final_status,hop_count,ok,label,notes',
    ...rows.map(toCsvRow),
  ].join('\n');

  if (args.outputFile) {
    fs.writeFileSync(path.resolve(process.cwd(), args.outputFile), `${output}\n`);
    console.log(`Wrote ${rows.length} rows to ${args.outputFile}`);
    return;
  }

  console.log(output);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeRedirectResult,
  formatRequestError,
  normalizeUrl,
  parseArgs,
  parseAuditList,
  toCsvRow,
  traceRedirects,
};
