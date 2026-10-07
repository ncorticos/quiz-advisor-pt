# Quizzes Machine

Randomised anti-copy classroom quizzes for architecture students —
**Conforto Ambiental & Eficiência Energética / Environmental Comfort & Energy Efficiency**
(Lisbon School of Architecture, ULisboa).

Live: https://ncorticos.github.io/quiz-advisor-pt/

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
