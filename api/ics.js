// Função do Vercel: busca a agenda do Google (endereço secreto no formato iCal)
// para o painel, já que o Google bloqueia o download direto pelo navegador (CORS).
// Faz o mesmo que o /api/ics do server.py quando o painel roda no computador.
// Nada é gravado: o endereço vem do navegador a cada atualização.

const ALLOWED_HOSTS = new Set(["calendar.google.com", "www.google.com"]);
const CACHE_MS = 2 * 60 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;
const cache = new Map(); // url -> { at, body } (memória da instância, some sozinho)

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("too_big");
  }
  return JSON.parse(raw);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });

  // Só aceita chamadas feitas pela própria página do painel.
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const origin = req.headers.origin || "";
  if (origin) {
    let originHost = "";
    try { originHost = new URL(origin).host; } catch (_) {}
    if (originHost !== host) return send(res, 403, { error: "forbidden" });
  }
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
    return send(res, 415, { error: "bad_request" });
  }

  let url;
  try {
    const body = await readBody(req);
    url = String((body && body.url) || "").trim();
  } catch (_) {
    return send(res, 400, { error: "bad_request" });
  }
  if (url.toLowerCase().startsWith("webcal://")) url = "https://" + url.slice(9);

  let parsed;
  try { parsed = new URL(url); } catch (_) { return send(res, 400, { error: "invalid_url" }); }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return send(res, 400, { error: "invalid_url" });
  }

  const hit = cache.get(url);
  let body;
  if (hit && Date.now() - hit.at < CACHE_MS) {
    body = hit.body;
  } else {
    let r;
    try {
      r = await fetch(url, {
        headers: { "User-Agent": "MyPanel/1.0 (agenda)" },
        signal: AbortSignal.timeout(15000)
      });
    } catch (_) {
      return send(res, 504, { error: "offline" });
    }
    if (!r.ok) return send(res, 502, { error: "upstream", status: r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return send(res, 502, { error: "too_large" });
    body = buf.toString("utf8");
    if (!body.replace(/^﻿/, "").trimStart().startsWith("BEGIN:VCALENDAR")) {
      return send(res, 502, { error: "not_ical" });
    }
    cache.set(url, { at: Date.now(), body });
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
};
