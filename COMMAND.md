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
