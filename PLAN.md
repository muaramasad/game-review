# PLAN.md — Game Review Take-Home Exercise

## 1. Goal

Build a small Game Review web application based on the take-home exercise requirements.

The application must allow users to:

- View a list of games.
- View game details and all reviews for a game.
- Submit a new review.
- See newly submitted reviews immediately without restarting the application.
- Start with example games and reviews.

The exercise specifically asks for a separate frontend and backend communicating through a REST API, clean backend separation, automated tests, Dockerized builds, and a single-command startup. It also says that an external database is not expected. The reviewer will build and run the project themselves. 

Source: Take-Home Exercise: Game Review.

---

## 2. Technology Stack

### Backend

- NestJS
- TypeScript
- TypeORM
- SQLite
- class-validator
- Jest

### Frontend

- React
- TypeScript
- Vite
- React Testing Library / Jest or Vitest as appropriate

### Infrastructure

- Docker
- Docker Compose
- Nginx for serving the React production build and proxying `/api` requests to NestJS

### Database

SQLite stored as a local file.

Use a Docker volume so the SQLite database can persist across container restarts.

---

## 3. High-Level Architecture

```text
                         Docker Compose
                              |
                +-------------+-------------+
                |                           |
                v                           v
        React + Nginx                  NestJS API
          :3000                          :3001
                |                           |
                | /api/*                    |
                +-------------------------->|
                                            |
                                            v
                                         TypeORM
                                            |
                                            v
                                         SQLite
```

The browser only needs to access:

```text
http://localhost:3000
```

Nginx serves the React application and proxies:

```text
/api/*
```

to the NestJS backend.

This allows the user to run the entire application with Docker without installing Node.js on the host machine.

---

## 4. Repository Structure

```text
game-review/
│
├── backend/
│   ├── src/
│   │   ├── games/
│   │   │   ├── entities/
│   │   │   │   └── game.entity.ts
│   │   │   ├── games.controller.ts
│   │   │   ├── games.service.ts
│   │   │   ├── games.module.ts
│   │   │   └── dto/
│   │   │
│   │   ├── reviews/
│   │   │   ├── entities/
│   │   │   │   └── review.entity.ts
│   │   │   ├── reviews.controller.ts
│   │   │   ├── reviews.service.ts
│   │   │   ├── reviews.module.ts
│   │   │   └── dto/
│   │   │
│   │   ├── database/
│   │   │   └── seed.ts
│   │   │
│   │   ├── app.module.ts
│   │   └── main.ts
│   │
│   ├── test/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameCard.tsx
│   │   │   ├── ReviewList.tsx
│   │   │   └── ReviewForm.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── GameListPage.tsx
│   │   │   └── GameDetailsPage.tsx
│   │   │
│   │   ├── services/
│   │   │   └── api.ts
│   │   │
│   │   ├── types/
│   │   │   └── game.ts
│   │   │
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── README.md
├── PLAN.md
└── .gitignore
```

---

# 5. Phase 1 — Define the Domain Model

## 5.1 Game

Fields:

```text
id
title
genre
platform
description
```

Only `id` and `title` are required by the exercise. Genre, platform, and description can improve the UI without adding unnecessary complexity.

## 5.2 Review

Fields:

```text
id
gameId
reviewerName
rating
text
createdAt
```

Rating scale:

```text
1–5
```

Relationship:

```text
Game 1 ──────── * Review
```

---

# 6. Phase 2 — Backend API Design

Keep the REST API intentionally small.

## Games

```http
GET /api/games
GET /api/games/:id
GET /api/games/:id/reviews
```

## Reviews

```http
POST /api/games/:id/reviews
```

### GET /api/games

Returns a list of games.

Example:

```json
[
  {
    "id": 1,
    "title": "Elden Ring",
    "genre": "Action RPG",
    "platform": "PC"
  }
]
```

### GET /api/games/:id

Returns the selected game and its reviews.

### GET /api/games/:id/reviews

Returns all reviews for the selected game.

### POST /api/games/:id/reviews

Request:

```json
{
  "reviewerName": "John",
  "rating": 5,
  "text": "Amazing game."
}
```

The newly created review must be persisted and immediately available through subsequent API requests.

---

# 7. Phase 3 — Backend Architecture

Use the following flow:

```text
HTTP Request
     |
     v
Controller
     |
     v
Service
     |
     v
TypeORM Repository
     |
     v
SQLite
```

## Games

```text
GamesController
      |
      v
GamesService
      |
      v
GameRepository
```

## Reviews

```text
ReviewsController
      |
      v
ReviewsService
      |
      v
ReviewRepository
```

Business logic must remain in services rather than being placed directly inside controllers.

This directly addresses the exercise requirement to keep models and business logic separated from HTTP routes.

---

# 8. Phase 4 — Database

Use SQLite through TypeORM.

Database file:

```text
/app/data/game-review.sqlite
```

Docker volume:

```text
sqlite-data:/app/data
```

The database should be simple because the exercise explicitly says database design is not being tested and an external database is not expected.

Do not add:

- PostgreSQL
- MySQL
- Redis
- MongoDB
- External database services

---

# 9. Phase 5 — Seed Data

The application must not start empty.

Seed approximately:

```text
4–5 games
2–3 reviews per game
```

Example games:

```text
Elden Ring
Hades
The Witcher 3
Cyberpunk 2077
Stardew Valley
```

The seed operation should be idempotent.

Expected behavior:

```text
First startup:
  seed games and reviews

Subsequent startup:
  do not create duplicate seed data
```

---

# 10. Phase 6 — Validation

Validate review creation.

Required fields:

```text
reviewerName
rating
text
```

Rules:

```text
reviewerName → required
rating       → integer between 1 and 5
text         → required
```

Invalid examples:

```text
rating = 0       → reject
rating = 6       → reject
rating = "abc"   → reject
reviewerName=""  → reject
text=""          → reject
```

Also return an appropriate error when the specified game does not exist.

---

# 11. Phase 7 — Backend Tests

Backend automated tests are a high priority because the exercise explicitly states that tests matter a lot and that a submission without tests will stand out negatively.

Target approximately:

```text
8–12 meaningful tests
```

## Games tests

Test:

- List games successfully.
- Get an existing game.
- Return an appropriate error for a nonexistent game.

## Reviews tests

Test:

- Create a valid review.
- Reject invalid rating.
- Reject missing reviewer name.
- Reject missing review text.
- Reject review for a nonexistent game.
- Retrieve reviews for a game.

## Important integration flow

Test:

```text
POST /api/games/:id/reviews
            |
            v
GET /api/games/:id/reviews
            |
            v
new review exists
```

This directly verifies that a newly submitted review becomes available without restarting the application.

---

# 12. Phase 8 — Frontend

Use React + TypeScript + Vite.

Keep the frontend simple.

Suggested components:

```text
App
 ├── GameListPage
 │    └── GameCard
 │
 └── GameDetailsPage
      ├── ReviewList
      └── ReviewForm
```

## Game List

Display:

```text
Game title
Genre
Platform
```

Clicking a game opens its details.

## Game Details

Display:

```text
Game title
Genre
Platform
Description
Reviews
Review form
```

## Review List

Display:

```text
Reviewer name
Rating
Review text
Created date
```

## Review Form

Fields:

```text
Reviewer name
Rating
Review text
```

Button:

```text
Submit Review
```

After successful submission:

```text
POST review
    |
    v
update/re-fetch reviews
    |
    v
new review appears immediately
```

No application restart should be required.

---

# 13. Phase 9 — Frontend Tests

Frontend tests are desirable but lower priority than backend tests.

Prioritize:

## ReviewForm

Test:

- Form renders.
- Required validation works.
- Rating validation works.
- Submit calls the API with the correct payload.

## GameDetails

Test:

- Game information renders.
- Existing reviews render.
- Newly submitted review appears.

Do not spend excessive time testing purely visual details.

---

# 14. Phase 10 — Docker Backend

Backend Dockerfile should use a multi-stage build where appropriate.

Conceptually:

```text
Node build image
      |
      v
install dependencies
      |
      v
build NestJS
      |
      v
production image
      |
      v
run NestJS
```

The final backend image should run the compiled NestJS application rather than the development server.

---

# 15. Phase 11 — Docker Frontend

Use a multi-stage Docker build:

```text
Node build stage
      |
      v
npm install
      |
      v
npm run build
      |
      v
Nginx production image
      |
      v
serve React static files
```

Do not use the Vite development server as the production container.

---

# 16. Phase 12 — Nginx Proxy

Nginx should:

```text
/       → React static files

/api/*  → NestJS backend
```

Architecture:

```text
Browser
   |
   v
localhost:3000
   |
   +---- / ----------> React
   |
   +---- /api/* -----> NestJS:3001
```

This keeps the application accessible through one public port and avoids unnecessary browser-side CORS configuration.

---

# 17. Phase 13 — Docker Compose

The goal is for the reviewer to run:

```bash
docker compose up --build
```

No Node.js installation should be required on the reviewer's machine.

Expected services:

```text
frontend
backend
```

And a persistent volume:

```text
sqlite-data
```

Example conceptual structure:

```text
services:
  backend:
    build: ./backend
    ...

  frontend:
    build: ./frontend
    ...

volumes:
  sqlite-data:
```

The frontend should be accessible at:

```text
http://localhost:3000
```

---

# 18. Phase 14 — Startup Reliability

Make sure the frontend does not fail simply because the backend takes a few seconds longer to start.

Use a backend healthcheck where useful.

Expected startup:

```text
docker compose up
       |
       +--> backend starts
       |
       +--> frontend starts
       |
       v
application available
```

The exact Compose dependency mechanism should not be used as a substitute for application-level retry/error handling.

---

# 19. Phase 15 — README

README.md must explain:

## Project

What the application does.

## Architecture

Short explanation of:

```text
React
   ↓
Nginx
   ↓
NestJS
   ↓
TypeORM
   ↓
SQLite
```

## Tech Stack

List the selected technologies.

## Requirements

The host should only need:

```text
Docker
Docker Compose
```

No Node.js installation should be required.

## Run

```bash
docker compose up --build
```

## Open

```text
http://localhost:3000
```

## Tests

Document how to run backend and frontend tests.

## API

Document:

```text
GET    /api/games
GET    /api/games/:id
GET    /api/games/:id/reviews
POST   /api/games/:id/reviews
```

## Design Decisions

Explain briefly why:

- NestJS
- React
- SQLite
- TypeORM
- Docker Compose
- Nginx

were selected.

## What Could Be Improved

Mention realistic future improvements rather than pretending the exercise is production-ready.

---

# 20. Phase 16 — Design Decisions to Document

Recommended explanation:

### Why SQLite?

The exercise explicitly requests a simple local persistence approach and says database design is not being tested. SQLite provides persistence without requiring an external database.

### Why NestJS?

NestJS provides clear separation between controllers, services, modules, and persistence while keeping the backend relatively small.

### Why React?

React provides a separate frontend that communicates with the backend through REST, matching the exercise requirements.

### Why Docker Compose?

Docker Compose allows the complete application to be built and started consistently with a single command without requiring Node.js on the host.

### Why Nginx?

Nginx serves the production React build and proxies `/api` requests to the backend, allowing the application to expose a single public port.

---

# 21. Phase 17 — Avoid Overengineering

Do NOT add the following unless there is a strong reason:

```text
Authentication
User accounts
Redux
PostgreSQL
MySQL
Redis
Kafka
Microservices
WebSockets
Kubernetes
GraphQL
CI/CD
Cloud deployment
External APIs
Complex design systems
```

The exercise explicitly says login/user accounts and an external database are not expected.

The goal is a small, maintainable project.

---

# 22. Phase 18 — Final Quality Checklist

## Functionality

- [ ] Game list works.
- [ ] Game details work.
- [ ] All reviews are displayed.
- [ ] New review can be submitted.
- [ ] New review appears immediately.
- [ ] Example games exist on startup.
- [ ] Example reviews exist on startup.

## Backend

- [ ] Controllers are thin.
- [ ] Business logic is in services.
- [ ] Game and Review are separate entities.
- [ ] TypeORM is used correctly.
- [ ] SQLite works.
- [ ] Validation works.
- [ ] Appropriate errors are returned.
- [ ] Seed data is idempotent.

## Tests

- [ ] Backend tests pass.
- [ ] Review creation is tested.
- [ ] Validation is tested.
- [ ] Nonexistent game is tested.
- [ ] Review retrieval is tested.
- [ ] Frontend tests pass.
- [ ] Review form is tested.

## Docker

- [ ] Backend builds.
- [ ] Frontend builds.
- [ ] Docker Compose works.
- [ ] `docker compose up --build` starts everything.
- [ ] No Node.js is required on the host.
- [ ] SQLite data is persisted through a Docker volume.
- [ ] Frontend is accessible on port 3000.
- [ ] API requests are proxied correctly.

## Documentation

- [ ] README explains the architecture.
- [ ] README explains how to run.
- [ ] README explains how to test.
- [ ] README documents API endpoints.
- [ ] README explains important design decisions.
- [ ] README mentions limitations/future improvements.

## Repository

- [ ] `.gitignore` is configured.
- [ ] No secrets are committed.
- [ ] No unnecessary generated files are committed.
- [ ] Docker build works from a clean clone.
- [ ] Project can be explained during the follow-up call.

---

# 23. Final Verification From a Clean Environment

Before submission, perform exactly what the reviewer is likely to do:

```bash
git clone <repository>
cd game-review
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

Verify the complete user journey:

```text
Game list
   ↓
Select game
   ↓
View reviews
   ↓
Fill review form
   ↓
Submit
   ↓
New review appears
```

Then verify tests.

The final project should work without installing Node.js, npm, NestJS, React, SQLite, or any other development dependency on the host machine.

---

# 24. Recommended Implementation Order

Implement in this exact order:

```text
1. Create repository structure
        ↓
2. Initialize NestJS backend
        ↓
3. Configure TypeORM + SQLite
        ↓
4. Create Game entity
        ↓
5. Create Review entity
        ↓
6. Create seed data
        ↓
7. Implement Games API
        ↓
8. Implement Reviews API
        ↓
9. Add validation
        ↓
10. Write backend tests
        ↓
11. Initialize React + Vite
        ↓
12. Build Game List
        ↓
13. Build Game Details
        ↓
14. Build Review List
        ↓
15. Build Review Form
        ↓
16. Add frontend tests
        ↓
17. Dockerize backend
        ↓
18. Dockerize frontend
        ↓
19. Configure Nginx
        ↓
20. Configure Docker Compose
        ↓
21. Verify one-command startup
        ↓
22. Write README
        ↓
23. Clean code/repository
        ↓
24. Final end-to-end test
```

---

# 25. Definition of Done

The project is considered complete when:

```text
docker compose up --build
```

is sufficient to start the entire application.

A reviewer can then:

```text
1. Open the application
2. See example games
3. Open a game
4. See its reviews
5. Submit a review
6. Immediately see the new review
```

And the reviewer can inspect the repository and find:

```text
Clean React frontend
        +
Clean NestJS backend
        +
REST API
        +
TypeORM + SQLite
        +
Automated tests
        +
Docker
        +
Clear README
```

The implementation should remain intentionally small because the exercise states that it is a small project intended to take only a few focused hours, not the entire 24-hour window.
