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
