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
- **02 Projetor / Projector** — students choose the lecture on the start
  screen (a `?lesson=aula0…3` link fixes it); after Proceed, each student
  answers N random questions (20 by default, `?n=30|40|50`), one at a time: choosing an answer
  moves to the next question; after the last one (or when time is up) the
  student sees the score, without the correct answers, and the result is
  sent to the teacher. A new attempt needs the teacher code (Request restart).
  Opened directly, the tab shows one random question at a time for the room,
  alongside the lesson PPTX, with no repeats until the bank is exhausted.
- **03 Banco / Bank** — searchable teacher view of all questions + answers.
- **04 Resultados / Results** — local history of this device. Export, clear and
  the submit link are unlocked with the teacher code (3016). Once unlocked,
  typing the Worker's `TEACHER_CODE` and pressing Enter lists every attempt the
  students sent to the Worker (without names), with the average by lecture and
  by group; **Download CSV** exports them with names and a class-code column.

Question bank v1.0.0: 348 questions extracted from lessons L.01–L.03 —
Aula 1–3 (46/54/74, PT) + Lecture 1–3 (46/54/74, EN).

## Theoretical / LAB

The header switch (same style as EN | PT) sets the session type on each device;
a `?type=lab` or `?type=theory` link sets it too.

- **Theoretical** — the quiz tabs (Quiz, Projector, Bank, Results): name +
  group (Architects / Engineers), as before.
- **LAB** — only **Submissions** and **Results**; no lectures or quizzes.
  Students choose their lab group (`Group X - house type`, Architects A–G, J;
  Engineers A–F); its members' names and its **5 submissions** appear (no name
  to type: a submission belongs to the group); each open one takes a PDF (up to 10 MB) or a
  https link (Drive / OneDrive). While a submission is open, a new one replaces
  the previous one (the git history of quiz-results keeps every version).

Teacher, LAB > Results > unlock (3016) > Worker teacher code (in LAB the Results
tab shows only the lab part; quiz results, averages and points stay under
Theoretical):

- **Lab submissions** — one row per lab group, one column per submission:
  open/close buttons (for every group at once), ✓ date, PDF download or link,
  and a field for the group's **points (0–5)** in each submission, saved when
  you leave it (private, in `lab/index.json`; students do not see them). The
  last column is the group's average; **Download points (CSV)** gives one row
  per group with its members, the five points and the average.
- **Lab groups** — every lab group with its members.

Lab professor (`LAB_PROF` in `index.html`): Maja Sutkowska for the Architects
groups, Nuno Dinis Cortiços for the Engineers groups; the Submissions page shows
the one of the chosen group.

The members (first name and surname only) are in `LAB_GROUPS` in `index.html`,
so they show as soon as a group is chosen, even without the Worker. They are
**public**: anyone who opens the page or this repository can read them (the
page asks search engines not to index it). Edit that list to move or add a
student. `roster.json` in quiz-results is no longer used.

Storage (private quiz-results repo): `lab/index.json` (open submissions and
what each group handed in) and `lab/files/<track>-<letter>-s<n>.pdf`. The
upload is streamed through the Worker to GitHub (Workers free plan: 10 ms CPU
per request), hence the 10 MB limit; larger work goes as a link.

## Points (0–5)

Every attempt also gets a grade on a 0–5 scale: correct answers ÷ questions × 5
(14/20 → 3.5; two decimals at most). It is shown on the student's end screen,
in 04 Results (this device, class list, averages by lecture and by group) and as
the `points` column of both CSV files, written with a decimal comma like the
`;`-separated CSV expects.

## Results storage (teacher)

Attempts are sent to the private
[quiz-results](https://github.com/ncorticos/quiz-results) repo (one JSON file
per attempt — reading it requires your GitHub login) through `worker.js`, a
free Cloudflare Worker that checks the class code announced in the room, so
the GitHub token never appears in the student-facing page. Teacher setup is in
the header comment of `worker.js`. The Worker address
(`https://quiz-results.ncorticos.workers.dev`) is built into the page
(`BAKED_SUBMIT`). Results are sent automatically when the quiz ends, with the
lecture as class code (`Lecture00` … `Lecture11`, which `CLASS_CODE` must list);
a `?code=` link overrides it. Nothing to type for students.

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
