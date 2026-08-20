# COMMAND.md — Command Log

Every shell command run while implementing this project, in order, with an explanation of what it does and why. All Node-related commands are run through Docker (`backend-tools`/`frontend-tools` services in [docker-compose.yml](docker-compose.yml)) so no Node.js install is required on the host.

---

## Phase 2 — Docker-based Node tooling

```bash
docker compose config
```
Validates `docker-compose.yml` syntax/structure without starting anything. Used to confirm the `backend-tools`/`frontend-tools` service definitions are well-formed after creating the file.

---

## Phase 3 — Initialize NestJS backend (skeleton)

```bash
docker compose run --rm backend-tools npx @nestjs/cli new . --package-manager npm --skip-git
```
Scaffolds a new NestJS project directly into `backend/` (the container's working dir is bind-mounted to `./backend`). `--package-manager npm` avoids an interactive prompt; `--skip-git` because git isn't initialized yet at the repo root. This generates `package.json`, `tsconfig*.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, and test files, and runs `npm install` inside the container.

```bash
docker compose run --rm backend-tools npm test
```
Runs the Jest unit tests (`*.spec.ts`) inside the container, using the `test` script from `package.json`. Used to confirm the health-check controller/service edits didn't break anything.

```bash
docker compose run --rm -d -p 3011:3001 --name backend-smoketest backend-tools npm run start
sleep 8
curl -s -o /tmp/health.json -w "%{http_code}\n" http://localhost:3011/api/health
cat /tmp/health.json
docker rm -f backend-smoketest
```
Boots the actual Nest dev server (`npm run start`) in a detached, named container, publishing container port `3001` to host port `3011` (`3001` was already taken by an unrelated local process). After a short wait for startup, `curl`s the `/api/health` route to confirm it responds `200 {"status":"ok"}`, then tears the container down. This is a one-off manual smoke test, not part of the permanent tooling.

---

## Phase 4 — Initialize React + Vite (skeleton)

```bash
docker compose run --rm frontend-tools npm create vite@latest . -- --template react-ts
```
First attempt: scaffolding directly into `frontend/` (already non-empty from Phase 1's `components/pages/services/types` folders) triggered create-vite's interactive "directory not empty" prompt, which can't be answered non-interactively — the command aborted with "Operation cancelled".

```bash
docker compose run --rm frontend-tools npm create vite@latest tmp-scaffold -- --template react-ts
```
Worked around the prompt by scaffolding into a fresh subfolder (`frontend/tmp-scaffold/`) instead, then the generated files were moved up into `frontend/` (merging with, not overwriting, the existing `src/components|pages|services|types` folders) via plain `mv`/`rmdir`, not a Docker command.

```bash
rm -rf node_modules package-lock.json
docker compose run --rm frontend-tools npm install
```
Installed dependencies as scaffolded. The generated `package.json` used Vite 8 (built on the new Rolldown bundler); its optional native binding package `@rolldown/binding-linux-arm64-gnu` doesn't currently have a published version matching what Vite 8 expects for the container's platform, so `npm run build` failed with `Cannot find module`. Rewrote `package.json` to pin the stable, non-Rolldown Vite 5 line (`vite@^5.4.11`, `@vitejs/plugin-react@^4.3.4`, `react@^18.3.1`) and removed the also-native `oxlint` devDependency/config, then reinstalled.

```bash
docker compose run --rm frontend-tools npm run build
```
Confirms the production build works: `tsc -b && vite build` succeeds and emits `dist/`.

```bash
docker compose run --rm frontend-tools npm audit
```
Checked for known vulnerabilities. One moderate finding remains: `esbuild`'s dev server accepting requests from any origin (dev-only exposure, doesn't affect the production build). The suggested fix (`npm audit fix --force`) would reintroduce the broken Vite 8/Rolldown line, so it was left as-is.

```bash
docker compose run --rm -d -p 5174:5173 --name frontend-smoketest frontend-tools npm run dev -- --host 0.0.0.0
sleep 5
curl -s -o /tmp/frontend2.html -w "%{http_code}\n" http://127.0.0.1:5174/
docker rm -f frontend-smoketest
```
Boots the Vite dev server in a detached container (`--host 0.0.0.0` so it accepts connections from outside the container), published to host port `5174` (an unrelated host process already held `5173`, including on `[::1]`, which caused a false-negative on the first attempt via `localhost`). Confirms `200` with the expected HTML, then tears the container down. One-off manual smoke test, not part of the permanent tooling.

---

## Phase 5 — Dockerize backend

```bash
docker build -t game-review-backend:phase5 ./backend
```
Builds the multi-stage `backend/Dockerfile` image directly (not through `docker compose run`, since this builds the production image itself rather than using it as a Node tool). Stage 1 (`build`) installs all deps and runs `npm run build` (`nest build`); stage 2 (`production`) installs only production deps and copies in the compiled `dist/` output. Tagged `:phase5` as a temporary, throwaway tag for this manual verification — the real image gets built/tagged by Docker Compose in Phase 8.

```bash
docker run --rm -d -p 3012:3001 --name backend-image-smoketest game-review-backend:phase5
sleep 4
curl -s -o /tmp/health2.json -w "%{http_code}\n" http://127.0.0.1:3012/api/health
docker logs backend-image-smoketest
docker rm -f backend-image-smoketest
```
Runs the built production image standalone (`CMD ["node", "dist/main.js"]`, no dev server, no TypeScript/nest-cli present in the image), publishing to host port `3012`. Confirms `/api/health` returns `200 {"status":"ok"}`, then tears the container down.

```bash
docker images game-review-backend:phase5
docker rmi game-review-backend:phase5
```
Checked the built image size (226MB) and removed the temporary `:phase5` tag/image after the smoke test — it isn't needed once Compose builds its own image from the Dockerfile in Phase 8.

---

## Phase 6 — Dockerize frontend

```bash
docker build -t game-review-frontend:phase6 ./frontend
```
Builds the multi-stage `frontend/Dockerfile`. Stage 1 (`build`) installs deps and runs `npm run build` (`tsc -b && vite build`) to produce `dist/`; stage 2 (`production`) is `nginx:alpine`, copying the built static files into `/usr/share/nginx/html` and a minimal `nginx.conf` (serves `/`, falls back to `index.html` for client-side routes — the `/api/*` proxy block gets added in Phase 7). Tagged `:phase6` as a temporary tag for this manual verification.

```bash
docker run --rm -d -p 8081:80 --name frontend-image-smoketest game-review-frontend:phase6
sleep 3
curl -s -o /tmp/frontend3.html -w "%{http_code}\n" http://127.0.0.1:8081/
curl -s -o /tmp/frontend4.html -w "%{http_code}\n" http://127.0.0.1:8081/some/deep/route
docker rm -f frontend-image-smoketest
```
Runs the built Nginx image standalone. Confirms the root page serves `200` with the expected `<title>`, and that an arbitrary deep route also returns `200` (SPA fallback to `index.html` works, not a 404).

```bash
docker images game-review-frontend:phase6
docker rmi game-review-frontend:phase6
```
Checked image size (92MB) and removed the temporary `:phase6` tag/image — Compose builds its own image from the Dockerfile in Phase 8.

---

## Phase 7 — Configure Nginx

```bash
docker build -t game-review-frontend:phase7 ./frontend
docker run --rm game-review-frontend:phase7 nginx -t
docker rmi game-review-frontend:phase7
```
First attempt: added `location /api/ { proxy_pass http://backend:3001/api/; ... }` to `nginx.conf` and rebuilt. `nginx -t` failed with `host not found in upstream "backend"` — with a static hostname, Nginx resolves it at config-load/startup time, so the frontend container would fail to boot whenever the backend isn't already up (a classic Compose startup-race issue, and directly relevant to the "frontend shouldn't fail if backend is slower to start" requirement). Fixed by switching to a variable-based `proxy_pass` with Docker's embedded DNS resolver (`resolver 127.0.0.11 valid=10s; set $backend_upstream http://backend:3001; proxy_pass $backend_upstream/api/;`), which defers hostname resolution to request time instead of startup time. Rebuilt and reran `nginx -t` — now passes even with no `backend` host reachable, since resolution isn't attempted until an actual `/api/*` request comes in. Full proxying behavior (an actual `backend` container to reach) gets verified in Phase 9 once both services run together under Compose.

---

## Phase 8 — Configure Docker Compose (backend + frontend + volume)

```bash
docker run --rm node:20-alpine which wget
```
Confirmed `wget` (via BusyBox) is present in the `node:20-alpine` base image, needed for the backend service's Compose healthcheck (`wget -qO- http://localhost:3001/api/health`).

```bash
docker compose config
```
Validated the updated `docker-compose.yml` after adding the `backend`/`frontend` runtime services and the `sqlite-data` named volume (mounted at `/app/data` on `backend`). Confirms Compose parses the healthcheck, `depends_on: condition: service_healthy`, port mappings (`3001:3001`, `3000:80`), and volume correctly. Actually starting the stack (`docker compose up --build`) is deferred to Phase 9, where startup ordering, healthcheck timing, and the live Nginx→backend proxy get verified together.

---

## Phase 9 — Verify one-command startup

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
```
Checked host ports 3000/3001 were free before starting the stack. Port 3001 was initially held by an unrelated process from another project; user freed it.

```bash
docker compose up --build -d
docker compose ps -a
```
First full-stack run. `backend` became healthy and `frontend` correctly waited for it (`depends_on: condition: service_healthy`) before starting — confirms the startup-ordering requirement. However, `docker compose ps -a` showed `backend-tools`/`frontend-tools` also started and immediately exited (they have no `command`, so they default to Node's REPL with no stdin and exit 0) — noisy for a plain `up`, since those services are meant only for `docker compose run`.

Fixed by adding `profiles: ["tools"]` to both `backend-tools` and `frontend-tools` in `docker-compose.yml`, so they're excluded from the default `docker compose up`/`ps` but still explicitly runnable via `docker compose run`.

```bash
docker compose down
docker compose run --rm backend-tools node -e "console.log('tools still work')"
```
Confirmed the profile change doesn't break the Phase 2–7 workflow — `docker compose run` still starts a profiled service on demand even though it's excluded from `up`.

```bash
docker compose up -d
docker compose ps
```
Restarted cleanly — only `backend`/`frontend` came up this time, both healthy/running.

```bash
curl -s -o /tmp/e2e-index.html -w "%{http_code}\n" http://localhost:3000/
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/health
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/health
```
End-to-end checks: frontend page serves `200` with the right title; backend responds `200` directly on `3001`; **but** the same request through the Nginx proxy (`localhost:3000/api/health`) returned `404 Cannot GET /api/` — the `health` segment of the path was being dropped.

Root cause: Nginx's usual location-prefix rewriting (replacing the matched `/api/` prefix with the URI part of `proxy_pass`) doesn't apply when `proxy_pass`'s target is built from a variable (needed here for the request-time DNS resolution from Phase 7) — so `proxy_pass $backend_upstream/api/;` was literally sending `/api/` with nothing appended. Fixed in `nginx.conf` by dropping the URI suffix and instead appending `$request_uri` explicitly (`proxy_pass $backend_upstream$request_uri;`), which forwards the exact original path since the backend already uses the same `/api` prefix.

```bash
docker compose up -d --build frontend
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/health
```
Rebuilt just the frontend with the fix and reconfirmed: `/api/health` through the proxy now returns `200 {"status":"ok"}`.

```bash
docker compose exec backend sh -c "echo 'persistence-test' > /app/data/marker.txt && cat /app/data/marker.txt"
docker compose restart backend
docker compose exec backend cat /app/data/marker.txt
```
SQLite volume persistence check #1: wrote a marker file into `/app/data` (the `sqlite-data` volume mount), restarted just the backend container, confirmed the file survived.

```bash
docker compose down
docker compose up -d
docker compose exec backend cat /app/data/marker.txt
docker compose exec backend rm /app/data/marker.txt
```
SQLite volume persistence check #2 (stronger): full `down` (removes containers) then `up` (recreates them) — confirms the volume itself, not just the container, is what's persisting the data. Marker file still present; removed it afterward as cleanup.

```bash
docker compose down
```
Stopped the stack after verification completed.

---

## Phase 10 — Configure TypeORM + SQLite

```bash
docker compose run --rm backend-tools npm install @nestjs/typeorm typeorm sqlite3
```
Installed `@nestjs/typeorm` (NestJS integration), `typeorm` (ORM), and initially `sqlite3` (driver). Wired up `TypeOrmModule.forRoot({ type: 'sqlite', ... })` in `app.module.ts` and a `getDatabasePath()` helper (`src/database/database-path.ts`) that reads `DATABASE_PATH` env var, falling back to a local `backend/data/game-review.sqlite`, creating the parent directory if missing.

```bash
docker compose build backend
```
First build attempt failed at `nest build` (TypeScript compile) — the installed `typeorm` resolved to version `1.1.0` (confirmed legitimate via `npm view typeorm version/description/repository.url`; TypeORM has since reached a 1.x stable release), which **removed the old `sqlite` driver type** (based on the long-unmaintained `sqlite3` package) in favor of `better-sqlite3`. TypeScript rejected `type: 'sqlite'` as not assignable.

```bash
docker compose run --rm backend-tools npm uninstall sqlite3
docker compose run --rm backend-tools npm install better-sqlite3
```
Swapped the driver package. Updated `app.module.ts` to `type: 'better-sqlite3'`.

```bash
docker compose build backend
```
Second attempt failed differently — `npm ci --omit=dev` in the production stage errored compiling `better-sqlite3` from source (`node-gyp`: `Could not find any Python installation`). `better-sqlite3` has no prebuilt binary for this platform, so it falls back to a native build, which needs Python/make/g++ that the `node:20-alpine` base image doesn't include by default.

Fixed by adding `RUN apk add --no-cache python3 make g++` to both stages of `backend/Dockerfile` (the `build` stage installs it as a regular dependency too, not just `production`'s `--omit=dev` step).

```bash
docker compose build backend
docker compose up -d
docker compose ps
docker compose logs backend
```
Build succeeded. Full stack started; backend logs show `TypeOrmCoreModule dependencies initialized` — connection opens cleanly (no entities registered yet, so nothing to synchronize).

```bash
docker compose exec backend sh -c "ls -la /app/data/"
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/health
docker compose down
```
Confirmed the actual `.sqlite` file was created inside the `sqlite-data` volume at the expected path, and `/api/health` still responds. Stack torn down after.

```bash
docker compose run --rm backend-tools npm test
```
Confirmed the existing unit test still passes unaffected (it tests `AppController` directly, not the full `AppModule`, so it doesn't touch TypeORM).

```bash
docker compose run --rm -d -p 3013:3001 --name backend-fallback-smoketest backend-tools npm run start
sleep 6
curl -s -w "\n%{http_code}\n" http://localhost:3013/api/health
docker rm -f backend-fallback-smoketest
```
Verified the local fallback path too: booting the full app via `backend-tools` (no `sqlite-data` volume mounted there) still connects successfully, creating `backend/data/game-review.sqlite` on the bind-mounted host folder via `getDatabasePath()`'s `mkdirSync`.

```bash
rm -rf backend/data
```
Removed the leftover local sqlite file/dir created by the fallback-path smoke test (already covered by `.gitignore`, just tidying up).

---

## Phase 11 — Create Game entity

```bash
docker compose run --rm backend-tools npm run build
```
Confirmed `backend/src/games/entities/game.entity.ts` (fields: `id`, `title`, `genre`, `platform`, `description`) compiles cleanly with no TypeScript errors.

```bash
docker compose run --rm backend-tools npx ts-node verify-game-entity.ts
```
Ran a throwaway script (`backend/verify-game-entity.ts`, deleted after) that opened an in-memory `better-sqlite3` DataSource with just the `Game` entity, ran `synchronize`, and inspected `PRAGMA table_info(game)` plus a round-trip save. Confirmed the generated schema matches expectations: `id` (INTEGER PK), `title` (`NOT NULL`), `genre`/`platform`/`description` (nullable), and a save/read round-trip works correctly.

```bash
rm backend/verify-game-entity.ts
```
Removed the throwaway verification script — not part of the permanent codebase.

---

## Phase 12 — Create Review entity

```bash
docker compose run --rm backend-tools npm run build
```
Created `backend/src/reviews/entities/review.entity.ts` (`id`, `gameId`, `reviewerName`, `rating`, `text`, `createdAt`, plus a `@ManyToOne` back to `Game`) and added the `@OneToMany(() => Review, ...) reviews?: Review[]` relation to `game.entity.ts`. Initial compile flagged `reviews: Review[]` under `strictPropertyInitialization` (no initializer) — fixed by making it optional (`reviews?: Review[]`), which is also more accurate since it's only populated when eagerly joined. Rebuild passed cleanly after.

```bash
docker compose run --rm backend-tools npx ts-node verify-review-entity.ts
```
Same throwaway-script approach as Phase 11 (`backend/verify-review-entity.ts`, deleted after), this time with both entities: checked `PRAGMA table_info(review)` and `PRAGMA foreign_key_list(review)`, then saved a `Game` + a `Review` referencing it and queried the game back with its reviews joined.

First run failed to compile: `relations: ['reviews']` — TypeORM 1.x changed `FindOptionsRelations` from a string array to an object form (`relations: { reviews: true }`). Fixed the script and reran (noting this for the real `GamesService` query in Phase 14, which will need the same object-form `relations`).

Confirmed: `review` table has the expected columns (`gameId` NOT NULL INTEGER, `rating` INTEGER, `text`/`createdAt` etc.), the foreign key is correctly wired with `ON DELETE CASCADE` to `game.id`, and the join query returns the game with its nested `reviews` array populated correctly.

```bash
rm backend/verify-review-entity.ts
```
Removed the throwaway verification script.

---

## Phase 13 — Create seed data

```bash
docker compose run --rm backend-tools npm run build
```
Created `backend/src/database/seed.ts` — `seedDatabase(dataSource)` seeds 5 games (Elden Ring, Hades, The Witcher 3, Cyberpunk 2077, Stardew Valley) with 2–3 reviews each, skipping entirely if any games already exist (idempotency check via `gameRepo.count() > 0`). Wired into `main.ts`: called with `app.get(DataSource)` after `NestFactory.create`, before `app.listen()`. Compile passed cleanly.

```bash
docker compose run --rm backend-tools npx ts-node verify-seed.ts
```
Throwaway script (`backend/verify-seed.ts`, deleted after): ran `seedDatabase()` twice against the same in-memory DB, compared row counts before/after the second call. Confirmed idempotent — both runs left exactly 5 games / 12 reviews, with correct per-game review counts.

```bash
docker compose up -d --build
docker compose exec backend sh -c "node -e \"... require('better-sqlite3')('/app/data/game-review.sqlite') ...\""
```
First real end-to-end attempt: `backend` container exited with `EntityMetadataNotFoundError: No metadata for "Game" was found` at `seedDatabase()`. Root cause: `TypeOrmModule.forRoot`'s `autoLoadEntities: true` only registers entities that get referenced via `TypeOrmModule.forFeature([...])` in some imported module — and `GamesModule`/`ReviewsModule` don't exist yet (that's Phase 14–15), so TypeORM had no metadata for `Game`/`Review` registered at all when `seedDatabase()` tried to use their repositories.

Fixed by adding `entities: [Game, Review]` explicitly to `TypeOrmModule.forRoot()` in `app.module.ts`, alongside the existing `autoLoadEntities: true` (which will take over once the feature modules exist and register the same entities via `forFeature`).

```bash
docker compose down
docker volume rm game-review_sqlite-data
docker compose up -d --build
```
Removed the stale volume from the failed attempt (tables never got created before the crash) and restarted clean.

```bash
docker compose exec backend sh -c "node -e \"const db=require('better-sqlite3')('/app/data/game-review.sqlite'); console.log(db.prepare('SELECT COUNT(*) as c FROM game').get()); console.log(db.prepare('SELECT COUNT(*) as c FROM review').get()); console.log(db.prepare('SELECT title FROM game').all());\""
```
Queried the real volume-backed sqlite file directly (bypassing the API, since no Games API exists yet). Confirmed 5 games / 12 reviews, with the expected titles.

```bash
docker compose restart backend
docker compose exec backend sh -c "node -e \"... SELECT COUNT(*) ...\""
docker compose down
```
Restarted the backend container and re-queried — counts unchanged (still 5 games / 12 reviews), confirming the seed is idempotent against the real Docker volume, not just in the in-memory test. Stack torn down after.

---

## Phase 14 — Implement Games API

```bash
docker compose run --rm backend-tools npm run build
```
Created `GamesController` → `GamesService` → TypeORM repositories, registered via `GamesModule` (`TypeOrmModule.forFeature([Game, Review])`) and imported into `AppModule`. Routes: `GET /api/games`, `GET /api/games/:id` (404 via `NotFoundException` if missing), `GET /api/games/:id/reviews` (reuses `findOne` to validate the game exists first, then queries reviews ordered newest-first). Compiled cleanly.

```bash
docker compose down -v
docker compose up -d --build
```
Fresh start with the volume removed (`-v`), so the seed runs again and the API can be tested against real seeded data end to end.

```bash
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games/1
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games/1/reviews
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games/999
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games/999/reviews
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/games
curl -s -w "\n%{http_code}\n" http://localhost:3001/api/games/abc
```
Verified all three endpoints against the real seeded data (5 games, correct nested reviews for game 1), confirmed `404` for a nonexistent game on both `/games/:id` and `/games/:id/reviews`, confirmed the same data is reachable through the Nginx proxy on port `3000`, and confirmed `ParseIntPipe` rejects a non-numeric id with `400`.

```bash
docker compose down
```
Stopped the stack after verification.

---

## Phase 15 — Implement Reviews API

```bash
docker compose run --rm backend-tools npm run build
```
Created `ReviewsController` (`POST /api/games/:gameId/reviews`) → `ReviewsService` → TypeORM repositories, registered via `ReviewsModule`. `CreateReviewDto` is plain fields for now (no `class-validator` decorators yet — that's Phase 16). Following PLAN.md's diagram, `ReviewsService` injects the `Game` repository directly (not `GamesService`) to check the game exists before creating a review, keeping `ReviewsModule` decoupled from `GamesModule`. Compiled cleanly.

```bash
docker compose down -v
docker compose up -d --build
```
Fresh start (volume removed) so the seed reruns and the new endpoint can be tested against real data.

```bash
curl -s http://localhost:3001/api/games/1/reviews   # baseline: 2 reviews
curl -s -X POST http://localhost:3001/api/games/1/reviews -H "Content-Type: application/json" -d '{"reviewerName":"John","rating":5,"text":"Amazing game."}'
curl -s http://localhost:3001/api/games/1/reviews   # confirm new review present
curl -s -X POST http://localhost:3001/api/games/999/reviews -H "Content-Type: application/json" -d '{...}'
```
Directly tested the PLAN.md-required integration flow: `POST /api/games/:id/reviews` → `GET /api/games/:id/reviews` → new review present, with **no server restart** in between. Confirmed `201` on create, the new review appears first (newest-first ordering) in the very next GET, and `404` when posting to a nonexistent game.

```bash
curl -s -X POST http://localhost:3000/api/games/2/reviews -H "Content-Type: application/json" -d '{...}'
docker compose down
```
Confirmed the same POST flow works through the Nginx proxy on port `3000`, not just hitting the backend directly. Stack torn down after.

---

## Phase 16 — Add validation

```bash
docker compose run --rm backend-tools npm install class-validator class-transformer
```
Installed the two packages needed for DTO validation.

```bash
docker compose run --rm backend-tools npm run build
```
Added decorators to `CreateReviewDto` (`@IsString @IsNotEmpty reviewerName`, `@IsInt @Min(1) @Max(5) rating`, `@IsString @IsNotEmpty text`) and registered a global `ValidationPipe` in `main.ts` (`whitelist: true, forbidNonWhitelisted: true, transform: true`). Compiled cleanly.

```bash
docker compose down -v
docker compose up -d --build
```
Fresh start to test validation against the real running API.

```bash
curl ... POST /api/games/1/reviews  # valid payload
curl ... POST /api/games/1/reviews  # rating=0
curl ... POST /api/games/1/reviews  # rating=6
curl ... POST /api/games/1/reviews  # rating="abc"
curl ... POST /api/games/1/reviews  # reviewerName=""
curl ... POST /api/games/1/reviews  # text=""
curl ... POST /api/games/1/reviews  # missing reviewerName
curl ... POST /api/games/1/reviews  # extra unknown field "hacked":true
```
Ran every invalid example named in PLAN.md §10 plus two extra edge cases (missing field, unexpected field). All rejected with `400` and a clear message; the valid payload still returns `201`; `forbidNonWhitelisted` correctly rejects the unexpected `hacked` field too.

```bash
curl ... POST /api/games/999/reviews  # valid payload, nonexistent game
docker compose down
```
Confirmed ordering: a validation-passing payload against a nonexistent game still correctly returns `404` (not `400`) — the existence check in `ReviewsService` runs after DTO validation, so the right error type surfaces for each failure mode. Stack torn down after.

---

## Phase 17 — Write backend tests

Wrote `test/games.e2e-spec.ts` (3 tests: list games, get existing game, 404 for nonexistent) and `test/reviews.e2e-spec.ts` (7 tests: create valid review, reject invalid rating, reject missing reviewer name, reject missing text, reject review for nonexistent game, retrieve reviews for a game, and the PLAN.md-required integration flow — POST review → GET reviews → new review present, no restart).

Chose e2e (real HTTP requests via `supertest` against a `Test.createTestingModule` app) over isolated unit tests with mocked repositories, because the validation-rejection tests PLAN.md asks for are only meaningful at the HTTP layer — `ValidationPipe` runs on incoming requests, not inside `ReviewsService`, so calling the service directly would never exercise `class-validator` at all. Each spec builds a minimal test module (`TypeOrmModule.forRoot` pointed at an in-memory `better-sqlite3` DB + `GamesModule` + `ReviewsModule`, not the full `AppModule`) so tests run isolated from the real dev/production database, with the same `ValidationPipe` config as `main.ts`. Tables are cleared between tests (`Review` before `Game`, respecting the foreign key) rather than recreating the DataSource each time, for speed.

```bash
docker compose run --rm backend-tools npm run test:e2e
```
All 11 e2e tests pass (3 games + 7 reviews + the pre-existing 1 health-check e2e test), within PLAN.md's 8–12 target for the games/reviews tests specifically (10).

```bash
docker compose run --rm backend-tools npm test
```
Confirmed the existing unit test suite (health check) still passes unaffected.

Confirmed `test/` is excluded from the production build (`tsconfig.build.json`'s `exclude`), so these new spec files don't affect the Docker image.

---

## Phase 18 — Build Game List

```bash
docker compose run --rm frontend-tools npm install react-router-dom
```
Installed routing (needed for `/` → list, `/games/:id` → details navigation). Same pre-existing moderate/high `esbuild` dev-only audit finding, no new issue introduced.

```bash
docker compose run --rm frontend-tools npm run build
```
Built `types/game.ts`, `services/api.ts` (`fetchGames()`), `components/GameCard.tsx`, `pages/GameListPage.tsx` (fetch-on-mount with loading/error states), a minimal placeholder `pages/GameDetailsPage.tsx` (fully built out in Phase 19), and wired `BrowserRouter`/`Routes` into `App.tsx`. Also added a Vite dev-server proxy (`/api` → `http://localhost:3001`) so `npm run dev` works standalone too, not just the Nginx-fronted production container. Build succeeded.

```bash
docker compose down -v
docker compose up -d --build
curl -s -w "\n%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/api/games
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/games/1
BUNDLE=$(curl -s http://localhost:3000/ | grep -o '/assets/index-[^"]*\.js')
curl -s "http://localhost:3000$BUNDLE" | grep -o "fetch(\"/api/games\")"
docker compose down
```
Fresh full-stack verification: index page serves, `/api/games` returns real seeded data through the Nginx proxy, the deep route `/games/1` correctly falls back to the SPA (`200`, not `404`), and the built JS bundle contains the exact `fetch("/api/games")` call. **Not verified**: actual rendered output / click-through in a browser — no browser automation tool is available in this session, so only the network/bundle-level plumbing was confirmed, not the visual render.

---

## Phase 19 — Build Game Details

```bash
docker compose run --rm frontend-tools npm run build
```
Added `fetchGame(id)` to `services/api.ts`, replaced the Phase 18 placeholder `GameDetailsPage` with the real thing: fetches on mount via `useParams`, loading/error states, renders `title`/`genre`/`platform`/`description`. Left "Reviews" and "Leave a review" as placeholder sections — those are Phase 20/21's dedicated components, building them now would mean redoing the work. Build succeeded.

```bash
docker compose down -v
docker compose up -d --build
curl -s http://localhost:3000/api/games/1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/games/1
BUNDLE=$(curl -s http://localhost:3000/ | grep -o '/assets/index-[^"]*\.js')
curl -s "http://localhost:3000$BUNDLE" | grep -o 'fetch(`/api/games/\${[a-zA-Z]*}`)'
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/games/999
docker compose down
```
Verified the data the page will render (`/api/games/1` through Nginx), the deep route `/games/1` serves the SPA shell correctly, the bundle contains the expected templated fetch call, and a nonexistent game returns `404` with a message the page's `catch` block will surface (not crash). Same caveat as Phase 18: no browser tool available this session, so the actual rendered/click-through experience wasn't visually confirmed.

---

## Phase 20 — Build Review List

```bash
docker compose run --rm frontend-tools npm run build
```
Added `types/review.ts` (`Review` interface matching the backend entity), `fetchReviews(gameId)` to `services/api.ts`, and `components/ReviewList.tsx` (renders reviewer name, rating, text, formatted created date per review, with an empty-state message). Wired into `GameDetailsPage`: fetches game + reviews together via `Promise.all`, replaces the "Reviews coming soon" placeholder with `<ReviewList reviews={reviews} />`. Build succeeded.

```bash
docker compose down -v
docker compose up -d --build
curl -s http://localhost:3000/api/games/1/reviews
BUNDLE=$(curl -s http://localhost:3000/ | grep -o '/assets/index-[^"]*\.js')
curl -s "http://localhost:3000$BUNDLE" | grep -o '/reviews`)'
curl -s "http://localhost:3000$BUNDLE" | grep -o "reviewerName"
docker compose down
```
Verified the real reviews data through Nginx, and that the built bundle contains both the reviews-fetching call and the `reviewerName` field reference (confirms `ReviewList`'s rendering logic made it into the production build). Same caveat as prior frontend phases: no browser tool available, so only network/bundle-level plumbing was confirmed, not the visual render.

---

## Phase 21 — Build Review Form

```bash
docker compose run --rm frontend-tools npm run build
```
Added `createReview(gameId, payload)` to `services/api.ts` (POSTs, and on a non-OK response parses the backend's error body — `message` can be a string or, for `class-validator` failures, an array of strings, so it joins arrays into one message). Built `components/ReviewForm.tsx`: controlled inputs for reviewer name (text, required), rating (`<select>` 1–5, inherently valid client-side), review text (textarea, required), a "Submit Review" button with a submitting/disabled state and inline error display. Wired into `GameDetailsPage`: on success, the returned review is **prepended** to local `reviews` state directly (not re-fetched), so it appears immediately — matching the backend's newest-first ordering and satisfying PLAN.md's "no restart needed" requirement. Build succeeded.

```bash
docker compose down -v
docker compose up -d --build
curl -s http://localhost:3000/api/games/1/reviews   # baseline: 2 reviews
curl -s -X POST http://localhost:3000/api/games/1/reviews -H "Content-Type: application/json" -d '{"reviewerName":"FormTester","rating":4,"text":"Testing the review form flow."}'
curl -s http://localhost:3000/api/games/1/reviews   # new review present, newest-first
curl -s -X POST http://localhost:3000/api/games/1/reviews -H "Content-Type: application/json" -d '{"reviewerName":"","rating":5,"text":"x"}'
BUNDLE=$(curl -s http://localhost:3000/ | grep -o '/assets/index-[^"]*\.js')
curl -s "http://localhost:3000$BUNDLE" | grep -o 'method:"POST"'
curl -s "http://localhost:3000$BUNDLE" | grep -o "Submit Review"
docker compose down
```
Verified the exact request path `ReviewForm` uses: `POST` through Nginx succeeds (`201`) and the new review immediately appears first in the next `GET`; an invalid payload returns `{"message":["reviewerName should not be empty"], ...}` — the array-shaped error `createReview`'s parsing logic was built to handle. Confirmed the bundle contains the `POST` request and the "Submit Review" button text. Same caveat as prior frontend phases: no browser tool available, so the visual render/click-through wasn't confirmed directly.

---

## Phase 22 — Add frontend tests

```bash
docker compose run --rm frontend-tools npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
Installed Vitest + React Testing Library (the standard pairing for a Vite project — reuses the same Vite config/transform pipeline as the dev server and production build, unlike pulling in a separate Jest+Babel setup).

Configured `test` in `vite.config.ts` (`environment: 'jsdom'`, `globals: true`, `setupFiles: './src/test/setup.ts'`), switching its `defineConfig` import from `'vite'` to `'vitest/config'` so TypeScript recognizes the `test` key. Added `src/test/setup.ts` (imports `@testing-library/jest-dom/vitest` for the extended matchers) and a `test` script (`vitest run`) to `package.json`.

Wrote `src/components/ReviewForm.test.tsx` (4 tests — matching PLAN.md §13's priorities: renders all fields; rating `<select>` only offers 1–5; required fields block submission (native HTML5 `required`, no `createReview` call); submit sends the correct payload and reports the created review) and `src/pages/GameDetailsPage.test.tsx` (2 tests — game info + existing reviews render; a newly submitted review appears immediately via local state update, confirmed by asserting `fetchReviews` was called only once, i.e. no re-fetch/reload happened). `services/api` is mocked with `vi.mock` in both files so tests don't hit a real network/backend.

```bash
docker compose run --rm frontend-tools npm test
```
All 6 tests pass. Some harmless Vitest 4 internal deprecation warnings (esbuild vs. oxc) appeared but don't affect results — Vitest bundles its own Vite instance separate from the pinned Vite 5 used for `npm run build`.

```bash
docker compose run --rm frontend-tools npm run build
```
Confirmed the production build still works and produces an identically-hashed bundle to before the test additions, confirming the new `*.test.tsx` files aren't pulled into the shipped bundle (they're unreachable from `main.tsx`'s import graph).

---

## Phase 23 — Write README

Checked actual installed dependencies (`backend/package.json`, `frontend/package.json`) before writing, so the README's tech stack section reflects what's really in the project rather than PLAN.md's original aspirational list (e.g. `better-sqlite3` not `sqlite3`, `class-validator`/`class-transformer`, Vitest not Jest on the frontend).

Wrote `README.md` at the repo root covering: what the app does, architecture diagram, tech stack, requirements (Docker/Compose only), run instructions, test instructions, API reference with the validation rules, design decisions (why NestJS/React/SQLite via `better-sqlite3`/TypeORM/Compose/Nginx), and honest "what could be improved" notes (migrations vs. `synchronize: true`, pagination, auth, rate limiting, CI).

```bash
docker compose down -v
docker compose up --build -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
docker compose down
```
Verified the README's exact documented run command works from a clean state.

```bash
docker compose run --rm backend-tools npm test
docker compose run --rm backend-tools npm run test:e2e
docker compose run --rm frontend-tools npm test
```
Verified the README's exact documented test commands all run successfully as written (1 backend unit test, 11 backend e2e tests, 6 frontend tests).

---

## Phase 24 — Clean code/repository

```bash
rm -rf backend/data
git status
git ls-files | sort
```
Removed a stray leftover `backend/data/game-review.sqlite` from earlier manual testing (already correctly excluded by `.gitignore`/never tracked, just working-directory clutter). Reviewed `git status` (confirmed git was already initialized and phase-by-phase commits exist, matching the commit messages given throughout) and the full list of tracked files — clean, no `node_modules`/`dist`/`coverage`/build artifacts, no leftover throwaway `verify-*.ts` scripts.

```bash
git ls-files -z | xargs -0 grep -lIE "(AKIA[0-9A-Z]{16}|api[_-]?key|secret|password|token)" -i
```
Scanned all tracked files for potential secrets/credentials. Three matches, all false positives: `PHASE.md`/`PLAN.md` mentioning "no secrets" as a checklist item, and `backend/README.md`'s placeholder CircleCI badge URL (`?token=abc123def456`) from the unmodified NestJS scaffold template — not a real credential.

Reviewed PLAN.md §21's anti-overengineering list (auth, Redux, Postgres/MySQL/Redis, Kafka, microservices, WebSockets, Kubernetes, GraphQL, CI/CD, cloud deployment, external APIs, complex design systems) — confirmed none of it crept into the project.

Flagged that `backend/README.md` and `frontend/README.md` are still unmodified NestJS/Vite scaffold boilerplate (marketing badges/generic template text), not project docs — asked the user whether to delete, replace with a pointer to the root README, or leave as-is. **User chose to leave them as-is.**

```bash
git clone /Users/user/Documents/Developments/game-review <scratchpad>/clean-clone-test
cd <scratchpad>/clean-clone-test
docker compose up --build -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/api/games
curl -s http://localhost:3000/api/games/1/reviews
curl -s -X POST http://localhost:3000/api/games/1/reviews -H "Content-Type: application/json" -d '{"reviewerName":"CleanCloneTest","rating":5,"text":"Works from a clean clone."}'
curl -s http://localhost:3000/api/games/1/reviews
```
The most important check: cloned the actual git repo (not the working directory) into a scratch location to simulate exactly what a reviewer would do, and ran the full user journey against only what's actually committed. Confirmed `docker compose up --build` works from a truly clean checkout, seed data is present (5 games, 2 reviews on game 1), and submitting a review makes it immediately visible (3 reviews after POST) — matching the Phase 25 "final verification" checklist in PLAN.md, done early here as part of the cleanliness pass.

```bash
docker compose down -v
rm -rf <scratchpad>/clean-clone-test
```
Tore down and removed the scratch clone.

---

## Phase 25 — Final end-to-end test

```bash
docker compose down -v
docker compose up --build -d
```
Fresh full-stack start for the final comprehensive pass (against the current working directory, including not-yet-committed README/COMMAND.md updates — Phase 24 already specifically verified the committed-only clean-clone path).

```bash
curl -s http://localhost:3000/api/games                                    # 1. game list
curl -s http://localhost:3000/api/games/3                                  # 2. select a game
curl -s http://localhost:3000/api/games/3/reviews                          # 3. view its reviews
curl -s -X POST http://localhost:3000/api/games/3/reviews -H "Content-Type: application/json" -d '{"reviewerName":"FinalCheck","rating":5,"text":"Verifying the complete user journey end to end."}'   # 4. submit a review
curl -s http://localhost:3000/api/games/3/reviews                          # 5. new review appears immediately
```
Walked the exact user journey from PLAN.md §25's Definition of Done, step by step, against the running stack.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
docker compose restart backend
curl -s http://localhost:3000/api/games/3/reviews
```
Confirmed the frontend page serves, and that restarting just the backend container doesn't lose the review submitted moments earlier (SQLite volume persistence, re-confirmed at the end of the full build).

```bash
docker compose run --rm backend-tools npm test
docker compose run --rm backend-tools npm run test:e2e
docker compose run --rm frontend-tools npm test
docker compose down
```
Ran every test suite one final time: 1 backend unit test, 11 backend e2e tests, 6 frontend tests — all 18 pass. Stack torn down after.

**Final Quality Checklist review (PLAN.md §22):** Functionality (game list/details/reviews/submit/immediate-appearance/seed data) — all confirmed working end-to-end above. Backend (thin controllers, logic in services, separate entities, TypeORM, SQLite, validation, error handling, idempotent seed) — built and verified phase-by-phase (Phases 10–17). Tests (backend unit + e2e + frontend, covering creation/validation/nonexistent-game/retrieval) — all passing, confirmed again here. Docker (both images build, Compose starts everything with one command, no host Node.js needed, SQLite persists via volume, frontend on port 3000, API correctly proxied) — confirmed here and in Phase 24's clean-clone test. Documentation (README covers architecture/run/test/API/design decisions/limitations) — written in Phase 23. Repository (.gitignore correct, no secrets, no unnecessary generated files, clean-clone build verified) — audited in Phase 24.

---

## Post-plan cleanup — ReviewForm markup

User flagged `ReviewForm.tsx`'s JSX as visually cluttered (each field wrapped in a nested `<label>` with inconsistent multi-line formatting). Refactored to `htmlFor`/`id` pairing instead of label nesting, tightened formatting (single-line `<option>`, consistent prop layout), no behavior change.

```bash
docker compose run --rm frontend-tools npm run build
docker compose run --rm frontend-tools npm test
```
Confirmed the build still succeeds and all 6 frontend tests still pass — `getByLabelText` correctly resolves inputs via `htmlFor`/`id` association just as it did with implicit label nesting.

---

## Post-plan cleanup — ReviewForm styling

User pointed out the form still rendered "inline" — unstyled, default browser layout with no visual grouping between labels and their fields. Wrapped each label+input pair in a `.field` div and added a `.review-form` CSS block to `index.css` (vertical flex layout, consistent input/select/textarea styling, a styled submit button, error text in red), reusing the existing `--text-h`/`--border`/`--bg`/`--accent` theme variables so it respects the scaffold's existing light/dark mode support rather than hardcoding colors.

```bash
docker compose run --rm frontend-tools npm run build
docker compose run --rm frontend-tools npm test
```
Build succeeded — CSS bundle grew from 1.80kB to 2.53kB, confirming the new rules were included. All 6 frontend tests still pass unaffected (structural `.field` wrapper divs don't change what `getByLabelText`/`getByRole` resolve).

---

## Post-plan cleanup — Game List grid layout

User asked for the game list to render as a grid, 3 games per row. Wrapped `GameCard`s in a `.game-grid` div in `GameListPage`, added `display: grid; grid-template-columns: repeat(3, 1fr)` with responsive breakpoints (2 columns ≤1024px, 1 column ≤640px) to `index.css`, and gave `GameCard`'s `Link` a `.game-card` class (bordered card styling, hover state using the existing `--accent-border` variable).

```bash
docker compose run --rm frontend-tools npm run build
docker compose run --rm frontend-tools npm test
```
Build succeeded (CSS bundle grew to 3.04kB), all 6 frontend tests still pass.

---

## Post-plan cleanup — center the review form

User noted the review form sat left-aligned on the page. Added `margin: 0 auto` to `.review-form` in `index.css` (it already had `max-width: 480px`, just no auto margins to center within its container).

```bash
docker compose run --rm frontend-tools npm run build
docker compose run --rm frontend-tools npm test
```
Build succeeded, all 6 frontend tests still pass.

---

## Post-plan cleanup — ReviewList styling

User asked to fix `ReviewList`'s uncluttered/unstyled bullet list and center it, matching the treatment already given to `ReviewForm` and the game grid. Added `.review-list`/`.review-item`/`.review-item-header`/`.review-rating` classes: reviewer name and rating on one line (space-between), review text and date below, each review in a bordered card, list itself centered via `margin: 0 auto` with the same `max-width: 480px` as the review form so both sit aligned on the page. Wrapped reviewer name + rating in a `.review-item-header` div in `ReviewList.tsx` for the flex layout.

```bash
docker compose run --rm frontend-tools npm run build
docker compose run --rm frontend-tools npm test
```
Build succeeded (CSS bundle grew to 3.51kB), all 6 frontend tests still pass — the added wrapper div doesn't change any text content the tests assert on.

---

## Post-plan cleanup — replace seed games

User requested replacing the seed data with a different 5 games: Stardew Valley (kept), Cities: Skylines, BeamNG.drive, Euro Truck Simulator 2, Stranded Deep. Rewrote `seedGames` in `backend/src/database/seed.ts` with genre/platform/description and 2–3 reviews each for the new titles. Checked `README.md` and the e2e/frontend test fixtures for stale references to the old titles (Elden Ring, Hades, Witcher, Cyberpunk) — README never named specific games, and the test fixtures use those titles as arbitrary self-contained test data unrelated to the real seed list, so neither needed changes.

```bash
docker compose run --rm backend-tools npm run build
```
Confirmed the updated seed file compiles cleanly.

```bash
docker compose down -v
docker compose up -d --build
curl -s http://localhost:3000/api/games
curl -s http://localhost:3000/api/games/1/reviews
curl -s http://localhost:3000/api/games/3/reviews
docker compose down
```
Fresh start (volume removed) to force reseeding. Confirmed all 5 new games appear in the requested order with correct genre/platform/description, and review counts are right (3 for Stardew Valley, 3 for BeamNG.drive).

```bash
docker compose run --rm backend-tools npm run test:e2e
```
Confirmed all 11 backend e2e tests still pass — they use their own isolated in-memory test data, unaffected by the real seed list changing.
