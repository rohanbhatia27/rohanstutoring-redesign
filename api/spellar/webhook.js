const meetingNormaliseModule = require("../_lib/_meeting-normalise");
const meetingStoreModule = require("../_lib/_meeting-store");

const normaliseSpellarPayload =
  meetingNormaliseModule.normaliseSpellarPayload ||
  (meetingNormaliseModule.default && meetingNormaliseModule.default.normaliseSpellarPayload);

const storeMeetingNote =
  meetingStoreModule.storeMeetingNote ||
  (meetingStoreModule.default && meetingStoreModule.default.storeMeetingNote);

function getSecretFromRequest(req) {
  const headerSecret = req.headers && req.headers["x-spellar-secret"];
  const querySecret = req.query && req.query.secret;

  if (typeof headerSecret === "string" && headerSecret) {
    return headerSecret;
  }

  if (Array.isArray(headerSecret) && headerSecret[0]) {
    return headerSecret[0];
  }

  if (typeof querySecret === "string" && querySecret) {
    return querySecret;
  }

  if (Array.isArray(querySecret) && querySecret[0]) {
    return querySecret[0];
  }

  return "";
}

function parseJsonBody(body) {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8"));
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  if (body == null || body === "") {
    return {};
  }

  return JSON.parse(String(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredSecret = process.env.SPELLAR_WEBHOOK_SECRET;
  const requestSecret = getSecretFromRequest(req);

  if (!configuredSecret || !requestSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let payload;

  try {
    if (typeof normaliseSpellarPayload !== "function" || typeof storeMeetingNote !== "function") {
      throw new Error("Meeting helper exports are unavailable");
    }

    payload = parseJsonBody(req.body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Spellar webhook configuration error:", message);

    return res.status(500).json({ error: "Webhook configuration error" });
  }

  try {
    const normalisedMeetingNote = await normaliseSpellarPayload(payload);
    const storedMeetingNote = await storeMeetingNote(normalisedMeetingNote);

    return res.status(200).json({
      ok: true,
      stored: true,
      meetingId:
        (storedMeetingNote && storedMeetingNote.meetingId) ||
        (normalisedMeetingNote && normalisedMeetingNote.meetingId) ||
        null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Spellar webhook failed:", message);

    return res.status(500).json({
      error: "Failed to process Spellar webhook"
    });
  }
};
