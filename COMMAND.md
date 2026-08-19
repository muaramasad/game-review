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
