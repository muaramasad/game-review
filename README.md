# Game Review

A small web application for browsing games and their reviews, and submitting new reviews. Built as a take-home exercise: separate frontend/backend communicating over a REST API, automated tests, and a single-command Docker startup.

## What it does

- View a list of games.
- View a game's details and all of its reviews.
- Submit a new review for a game.
- Newly submitted reviews appear immediately, with no restart required.
- The app starts with example games and reviews already seeded.

## Architecture

```
Browser
   |
   v
localhost:3000
   |
   +---- /        ----> React static build (served by Nginx)
   |
   +---- /api/*   ----> NestJS API (proxied by Nginx)
                              |
                              v
                          TypeORM
                              |
                              v
                        SQLite (Docker volume)
```

Two containers, one public port:

- **frontend** — an Nginx container serving the built React app and proxying `/api/*` requests to the backend. This is the only port the browser needs (`3000`).
- **backend** — a NestJS API on port `3001` (also published to the host for direct debugging), backed by SQLite through TypeORM. Its database file lives on a named Docker volume (`sqlite-data`) so data survives container restarts.

There's also a small Docker-based Node tooling setup (`backend-tools` / `frontend-tools` services, under the `tools` Compose profile) used during development to run `npm install`, builds, and tests without needing Node.js installed on the host at all — not even for scaffolding. They're excluded from a plain `docker compose up` and only run on demand via `docker compose run`.

## Tech Stack

**Backend**
- NestJS + TypeScript
- TypeORM with the `better-sqlite3` driver
- class-validator / class-transformer for request validation
- Jest (unit + e2e tests)

**Frontend**
- React + TypeScript
- Vite
- React Router
- Vitest + React Testing Library

**Infrastructure**
- Docker + Docker Compose
- Nginx (serves the frontend, proxies `/api`)

**Database**
- SQLite, stored as a file on a Docker named volume (no external database)

## Requirements

Just:

- Docker
- Docker Compose

No Node.js, npm, or any other tooling needs to be installed on the host.

## Run

```bash
git clone git@github.com:muaramasad/game-review.git
cd game-review
docker compose up --build
```

Then open:

```
http://localhost:3000
```

The database seeds itself with 5 example games and 2–3 reviews each on first startup. The seed is idempotent — restarting the stack won't create duplicates.

## Tests

Backend (unit tests, then e2e tests):

```bash
docker compose run --rm backend-tools npm test
docker compose run --rm backend-tools npm run test:e2e
```

Frontend:

```bash
docker compose run --rm frontend-tools npm test
```

## API

| Method | Path                       | Description                          |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/games`                | List all games                        |
| GET    | `/api/games/:id`             | Get a single game                     |
| GET    | `/api/games/:id/reviews`     | Get all reviews for a game            |
| POST   | `/api/games/:id/reviews`     | Create a new review for a game        |

`POST /api/games/:id/reviews` request body:

```json
{
  "reviewerName": "John",
  "rating": 5,
  "text": "Amazing game."
}
```

- `reviewerName` and `text` are required, non-empty strings.
- `rating` must be an integer from 1 to 5.
- Requesting a game that doesn't exist returns `404`.
- Invalid input returns `400` with a description of what failed.

## Design Decisions

**Why NestJS?** Its module/controller/service structure keeps HTTP routing, business logic, and persistence cleanly separated without much ceremony, which suits a small project that still needs to demonstrate clean architecture.

**Why React?** A standard, well-understood choice for a frontend that talks to a REST API — no special requirements pushed toward anything heavier.

**Why SQLite (via `better-sqlite3`)?** The exercise explicitly doesn't expect an external database and says database design isn't being evaluated. SQLite gives real persistence with zero infrastructure. TypeORM's `better-sqlite3` driver was used instead of the older `sqlite` driver, which has been removed from TypeORM's current release.

**Why TypeORM?** Keeps entities and query logic out of controllers, and made the Game↔Review relationship (and cascading deletes) straightforward to express and verify.

**Why Docker Compose?** Lets the whole app — frontend, backend, and the SQLite volume — start with one command and no Node.js on the host, exactly as the exercise asks.

**Why Nginx?** Serves the production React build and proxies `/api/*` to the backend, so the browser only ever talks to one port and there's no CORS configuration to maintain.

## What Could Be Improved

This is intentionally a small project, so some things were left out on purpose rather than by oversight:

- **Pagination** on `GET /api/games` and `GET /api/games/:id/reviews` — not needed at this data size, but would matter at scale.
- **Rate limiting** on review submission — nothing currently stops one client from spamming reviews.
- **Slugs instead of numeric ids** in game URLs (e.g. `/games/stardew-valley` instead of `/games/1`) — more readable and stable if games are ever reordered or reseeded.
