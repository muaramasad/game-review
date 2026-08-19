# PHASE.md — Implementation Progress Tracker

Tracks progress against the Recommended Implementation Order in [PLAN.md](PLAN.md#24-recommended-implementation-order), reordered to stand up the full Docker/Nginx/SQLite-volume infra early (against skeleton apps) so every later phase can be verified live via `docker compose up`.
Check off each phase as it is completed.

---

- [ ] **1. Create repository structure**
  Set up the top-level folders/files as defined in PLAN.md §4: `backend/`, `frontend/`, `docker-compose.yml`, `README.md`, `PLAN.md`, `.gitignore`.

- [ ] **2. Set up Docker-based Node tooling**
  Set up a way to run Node (scaffolding, `npm install`, builds, tests) entirely through Docker, so no Node.js install is required on the host at any point. `docker-compose.yml` has `backend-tools`/`frontend-tools` services (`node:20`, bind-mounted) used via `docker compose run --rm <service> <cmd>` for every scaffolding/build/test step below.

- [ ] **3. Initialize NestJS backend (skeleton)**
  Scaffold the NestJS app in `backend/` with TypeScript (via the Docker Node tooling from Phase 2). Set up `src/app.module.ts`, `src/main.ts`, and base folder structure (`games/`, `reviews/`, `database/`), with one simple health-check route (e.g. `GET /api/health`).

- [ ] **4. Initialize React + Vite (skeleton)**
  Scaffold `frontend/` with React + TypeScript + Vite (via the Docker Node tooling from Phase 2). Base folder structure (`components/`, `pages/`, `services/`, `types/`) with a placeholder page.

- [ ] **5. Dockerize backend**
  Multi-stage `backend/Dockerfile`: build image installs deps and compiles NestJS, production image runs the compiled app (not the dev server) — PLAN.md §14.

- [ ] **6. Dockerize frontend**
  Multi-stage `frontend/Dockerfile`: build stage runs `npm install` + `npm run build`, final stage serves static files via Nginx (not the Vite dev server) — PLAN.md §15.

- [ ] **7. Configure Nginx**
  `frontend/nginx.conf`: serve `/` from React static build, proxy `/api/*` to the NestJS backend (PLAN.md §16). Keeps everything on one public port, avoids CORS.

- [ ] **8. Configure Docker Compose (backend + frontend + volume)**
  Add `backend` and `frontend` runtime services to `docker-compose.yml`, plus a persistent `sqlite-data` volume mounted on the backend (`/app/data`). Frontend reachable at `http://localhost:3000` (PLAN.md §17).

- [ ] **9. Verify one-command startup**
  Confirm `docker compose up --build` starts everything with no Node.js needed on the host, Nginx correctly proxies `/api/*`, and the SQLite volume persists data across a container restart — all against the skeleton apps, before real feature code exists. Add a backend healthcheck so the frontend doesn't fail if the backend takes a few extra seconds to start (PLAN.md §18).

- [ ] **10. Configure TypeORM + SQLite**
  Wire up TypeORM in the NestJS app with a SQLite connection. Database file at `/app/data/game-review.sqlite` (PLAN.md §8). No external DB (no Postgres/MySQL/Redis/Mongo).

- [ ] **11. Create Game entity**
  `game.entity.ts` with fields: `id`, `title`, `genre`, `platform`, `description` (PLAN.md §5.1). Only `id`/`title` are strictly required.

- [ ] **12. Create Review entity**
  `review.entity.ts` with fields: `id`, `gameId`, `reviewerName`, `rating` (1–5), `text`, `createdAt` (PLAN.md §5.2). Relationship: one Game → many Reviews.

- [ ] **13. Create seed data**
  `database/seed.ts`. Seed ~4–5 games (Elden Ring, Hades, The Witcher 3, Cyberpunk 2077, Stardew Valley) with 2–3 reviews each (PLAN.md §9). Seed must be idempotent — no duplicates on subsequent startups.

- [ ] **14. Implement Games API**
  `GamesController` → `GamesService` → `GameRepository`. Endpoints: `GET /api/games`, `GET /api/games/:id`, `GET /api/games/:id/reviews` (PLAN.md §6, §7). Keep business logic in the service, not the controller.

- [ ] **15. Implement Reviews API**
  `ReviewsController` → `ReviewsService` → `ReviewRepository`. Endpoint: `POST /api/games/:id/reviews` (PLAN.md §6, §7). New review must be persisted and immediately queryable.

- [ ] **16. Add validation**
  Use `class-validator` on review creation (PLAN.md §10): `reviewerName` required, `rating` integer 1–5, `text` required. Return an appropriate error (e.g. 404) when the game does not exist.

- [ ] **17. Write backend tests**
  ~8–12 meaningful Jest tests (PLAN.md §11): list games, get game (found/not found), create valid review, reject invalid rating/missing name/missing text, reject review for nonexistent game, retrieve reviews for a game, and the integration flow POST review → GET reviews → new review present.

- [ ] **18. Build Game List**
  `GameListPage` + `GameCard` components. Display title, genre, platform per game; clicking a game navigates to its details (PLAN.md §12).

- [ ] **19. Build Game Details**
  `GameDetailsPage`. Display title, genre, platform, description, review list, and review form (PLAN.md §12).

- [ ] **20. Build Review List**
  `ReviewList` component. Display reviewer name, rating, review text, created date for each review (PLAN.md §12).

- [ ] **21. Build Review Form**
  `ReviewForm` component with fields for reviewer name, rating, review text, and a "Submit Review" button. On success, re-fetch/update reviews so the new one appears immediately without a restart (PLAN.md §12).

- [ ] **22. Add frontend tests**
  Prioritize `ReviewForm` (renders, required validation, rating validation, submit sends correct payload) and `GameDetails` (game info renders, existing reviews render, newly submitted review appears) — PLAN.md §13. Skip excessive visual testing.

- [ ] **23. Write README**
  Cover: project overview, architecture diagram, tech stack, requirements (Docker/Compose only), how to run, how to open, how to test, API documentation, design decisions (why NestJS/React/SQLite/TypeORM/Compose/Nginx), and what could be improved (PLAN.md §19, §20).

- [ ] **24. Clean code/repository**
  Review against the anti-overengineering list in PLAN.md §21 (no auth, no Redux, no external DBs, no GraphQL, no k8s, etc.). Ensure `.gitignore` is correct, no secrets or unnecessary generated files are committed.

- [ ] **25. Final end-to-end test**
  Simulate a clean clone: `git clone` → `cd game-review` → `docker compose up --build` → open `http://localhost:3000` → walk the full journey (list → select game → view reviews → submit review → new review appears) → run backend and frontend tests (PLAN.md §23, §25).
