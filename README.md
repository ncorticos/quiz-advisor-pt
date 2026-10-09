# Quizzes Machine

Randomised anti-copy classroom quizzes for architecture students —
**Conforto Ambiental & Eficiência Energética / Environmental Comfort & Energy Efficiency**
(Lisbon School of Architecture, ULisboa).

Live: https://ncorticos.github.io/quiz-machine/

Single self-contained file (`index.html`, no build, no server, works offline).
Same visual language as [Architecture Advisor](https://ncorticos.github.io/architecture-advisor-pt/).

- **01 Questionário / Quiz** — each student gets a different random subset of
  questions with shuffled A–D options, optional timer, score + review,
  replay with new questions, CSV export.
- **02 Projetor / Projector** — one random question at a time for use
  alongside the lesson PPTX, no repeats until the bank is exhausted.
- **03 Banco / Bank** — searchable teacher view of all questions + answers.
- **04 Resultados / Results** — local history with full CSV export.

Question bank v1.0.0: 348 questions extracted from lessons L.01–L.03 —
Aula 1–3 (46/54/74, PT) + Lecture 1–3 (46/54/74, EN).

## Results storage (teacher)

Attempts are sent to the private
[quiz-results](https://github.com/ncorticos/quiz-results) repo (one JSON file
per attempt — reading it requires your GitHub login) through `worker.js`, a
free Cloudflare Worker that checks the class code announced in the room, so
the GitHub token never appears in the student-facing page. Teacher setup is in
the header comment of `worker.js`; students open the class link with
`?submit=<worker-url>` (or paste it once in 04 Resultados > Ligação de envio).

## Language

2026/27 runs in English only (US spelling): `ONLY_LANG = "en"` in `index.html`
hides the PT/EN switch; set it to `""` to bring the switch back.

## Portuguese bank with Gemma (teacher)

The same Worker can translate the English bank into European Portuguese with
Gemma 4 on Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it`). Setup is in
steps 5–7 of the `worker.js` header: add a Workers AI binding named `AI` and a
secret `TEACHER_CODE` (your own code, not 3016 and not a class code).

1. 03 Bank > unlock > pick a lecture > enter the Worker teacher code > Translate.
2. Review the Portuguese column next to the English one and correct it in place.
3. Download `bank-pt.json` and upload it to the root of this repository.

On start-up the page loads `bank-pt.json` as the PT bank for each lecture it
contains. The answer key is copied from the English bank, and a lecture whose
size or answer key no longer matches the English bank is ignored.
