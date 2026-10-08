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
//     text CLASS_CODE (e.g. AULA1-OUT — announce it in class, change anytime),
//     text REPO (e.g. ncorticos/quiz-results).
//  4. Share with students: https://ncorticos.github.io/quiz-machine/?submit=<worker-url>
//     (or they paste <worker-url> once in 04 Resultados > Ligação de envio).

const GH = "https://api.github.com";

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
    if (!env.CLASS_CODE || b.code !== env.CLASS_CODE) {
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
