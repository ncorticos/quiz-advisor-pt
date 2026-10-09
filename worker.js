// Quizzes Machine results gatekeeper — Cloudflare Worker (free tier is enough).
//
// Why this exists: the quiz page is static (GitHub Pages) and cannot keep a
// secret, so it cannot write to GitHub directly. This worker holds the GitHub
// token server-side, checks the per-class code the teacher announces in the
// room, validates the payload, and stores one JSON file per attempt in the
// PRIVATE quiz-results repo. The teacher reads results on github.com (login).
//
// Setup (5 min, teacher's accounts):
//  1. GitHub: Settings > Developer settings > Personal access tokens >
//     Fine-grained > Generate new token. Repository access: "Only select
//     repositories" > quiz-results. Permissions > Contents: Read and write.
//     Copy the token (ghp_/github_pat_...).
//  2. Cloudflare: Workers & Pages > Create Worker > paste this file > Deploy.
//  3. Worker > Settings > Variables: add secret GITHUB_TOKEN (the token),
//     text CLASS_CODE (one code per class, comma-separated, e.g.
//     AULA0,TURMAC,TURMAD — announce each class its own code),
//     text REPO (e.g. ncorticos/quiz-results).
//  4. Share with students: https://ncorticos.github.io/quiz-machine/?submit=<worker-url>
//     (or they paste <worker-url> once in 04 Resultados > Ligação de envio).
//
// Optional — Portuguese translation of the bank with Gemma (teacher only):
//  5. Worker > Settings > Bindings > Add > Workers AI, variable name AI.
//  6. Worker > Settings > Variables: add secret TEACHER_CODE (your own code,
//     NOT 3016 — that one is readable in the page source; not a class code).
//  7. In the quiz page: 03 Bank > unlock > "Portuguese translation (Gemma)".
//     Review/correct the text, download bank-pt.json and upload it to the
//     quiz-machine repo root (GitHub > Add file > Upload files).

const GH = "https://api.github.com";
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const TR_SYSTEM = `You translate multiple-choice questions for a university course in architecture (Environmental Comfort & Energy Efficiency, Lisbon School of Architecture, ULisboa) from English into European Portuguese (pt-PT, Acordo Ortográfico de 1990). Never use Brazilian Portuguese spelling, vocabulary or grammar (use "projeto", "equipa", "registo", "facto", "ecrã", "utilizador", enclitic pronouns, "está a aumentar" not "está aumentando").
Use the technical vocabulary of Portuguese building regulations and practice (REH, RECS, SCE, LNEC, ADENE): envolvente, vão envidraçado, ponte térmica, coeficiente de transmissão térmica, fator solar, sombreamento, inércia térmica, ganhos solares, conforto térmico, ventilação natural, desempenho energético, certificado energético, zona climática.
Keep proper names, acronyms, codes and references unchanged (IPCC, UNEP, EN 12831, ISO 7730, L.01, Köppen Csb). Keep every number and unit; write decimals with a comma (0.35 -> 0,35).
Translate the meaning exactly. Do not add, remove, merge or reorder questions or options, and do not make the correct option easier to spot (keep options parallel in length and style).
Reply with JSON only, no comments: {"items":[{"q":"...","opts":["...","...","...","..."]}]} with the same number of items, in the same order, each with exactly 4 options.`;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

const ID_RE = /^[A-Za-z0-9-]{1,40}$/;

const isItem = (it, qMax, oMax) =>
  it && typeof it.q === "string" && it.q.trim() && it.q.length <= qMax &&
  Array.isArray(it.opts) && it.opts.length === 4 &&
  it.opts.every((o) => typeof o === "string" && o.trim() && o.length <= oMax);

// First {"items": ...} object in the model text that parses (tolerates prose or code fences around it).
function pickItems(text) {
  if (text && typeof text === "object") return text;
  const s = String(text || "");
  try { return JSON.parse(s); } catch { /* search below */ }
  for (const m of s.matchAll(/\{\s*"items"\s*:/g)) {
    for (let e = s.lastIndexOf("}"); e > m.index; e = s.lastIndexOf("}", e - 1)) {
      try { return JSON.parse(s.slice(m.index, e + 1)); } catch { /* shorter */ }
    }
  }
  return null;
}

async function translate(b, env) {
  if (!env.TEACHER_CODE || b.code !== env.TEACHER_CODE) return json({ ok: false, error: "code" }, 403);
  if (!env.AI) return json({ ok: false, error: "no AI binding" }, 500);
  const items = b.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20 || !items.every((it) => isItem(it, 1500, 600))) {
    return json({ ok: false, error: "shape" }, 400);
  }
  let out;
  try {
    out = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: TR_SYSTEM },
        { role: "user", content: JSON.stringify({ items: items.map(({ q, opts }) => ({ q, opts })) }) },
      ],
      max_tokens: 6000,
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
    });
  } catch (e) {
    return json({ ok: false, error: "ai", detail: String(e).slice(0, 200) }, 502);
  }
  const got = pickItems(out?.choices?.[0]?.message?.content ?? out?.response ?? out);
  const tr = got && Array.isArray(got.items) ? got.items : null;
  if (!tr || tr.length !== items.length || !tr.every((it) => isItem(it, 3000, 1200))) {
    return json({ ok: false, error: "model output" }, 502);
  }
  return json({ ok: true, model: MODEL, items: tr.map((it) => ({ q: it.q.trim(), opts: it.opts.map((o) => o.trim()) })) });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return json(null, 204);
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

    let b;
    try {
      b = await req.json();
    } catch {
      return json({ ok: false, error: "bad json" }, 400);
    }
    if (b && b.action === "translate") return translate(b, env);
    const CODES = String(env.CLASS_CODE || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!CODES.length || !CODES.includes(b.code)) {
      return json({ ok: false, error: "code" }, 403);
    }
    const { id, name, klass, lesson, n, score, pct, secs, detail, date } = b;
    if (
      typeof id !== "string" || !ID_RE.test(id) ||
      !Number.isInteger(n) || n < 1 || n > 200 ||
      !Number.isInteger(score) || score < 0 || score > n ||
      typeof pct !== "number" || pct < 0 || pct > 100 ||
      (secs !== undefined && (!Number.isInteger(secs) || secs < 0))
    ) {
      return json({ ok: false, error: "shape" }, 400);
    }

    const record = {
      id,
      date: typeof date === "string" ? date.slice(0, 32) : new Date().toISOString(),
      class: b.code,
      name: String(name || "").slice(0, 60),
      group: String(klass || "").slice(0, 60),
      bank: String(lesson || "").slice(0, 80),
      n, score, pct, secs: secs || 0,
      detail: String(detail || "").slice(0, 2000),
    };
    const path = `results/${id}.json`;
    const headers = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "quizzes-machine-worker",
    };
    // Fetch existing sha so re-sends of the same attempt update instead of failing.
    let sha;
    try {
      const get = await fetch(`${GH}/repos/${env.REPO}/contents/${path}`, { headers });
      if (get.status === 200) sha = (await get.json()).sha;
    } catch { /* create path */ }

    const put = await fetch(`${GH}/repos/${env.REPO}/contents/${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `result ${id} — ${record.name} ${record.score}/${record.n}`,
        content: b64encode(JSON.stringify(record, null, 2)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) return json({ ok: false, error: "github" }, 502);
    return json({ ok: true, id });
  },
};
