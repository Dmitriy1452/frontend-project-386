# AGENTS.md

## Project

Full-stack JavaScript application.

* Backend: Fastify
* Frontend: React + Vite
* UI: Mantine
* Tests: Vitest
* Linter: ESLint
* CI: GitHub Actions
* Releases: release-please

## Structure

* `backend/` — Fastify backend
* `frontend/` — React/Vite frontend
* `tests/` — automated tests
* `.github/workflows/` — GitHub Actions workflows

## Commands

Install dependencies:

```bash
npm install
```

Regenerate the whole Design First chain (TypeSpec → OpenAPI → frontend SDK → backend artifacts):

```bash
npm run generate
```

The chain reads `spec/main.tsp` and writes:

* `spec/dist/openapi.json` — emitted OpenAPI 3.1 contract
* `frontend/src/api/generated/` — frontend SDK (`@hey-api/openapi-ts`)
* `backend/src/gen/` — route scaffolds + validation schemas (see `scripts/generate-backend.js`) and backend types (`backend/src/gen/types/`)

Start backend and frontend:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run linter:

```bash
npm run lint
```

Fix lint errors automatically:

```bash
npm run lint:fix
```

Build frontend:

```bash
npm run build
```

## Development Rules

* Keep backend and frontend code separated by their respective directories.
* Add automated tests to `tests/`.
* Run tests and lint before committing changes.
* Do not modify tests just to make them pass; fix the application code instead.
* Generated files are never edited by hand. The generator outputs live in `spec/dist/`, `frontend/src/api/generated/` and `backend/src/gen/` and carry a DO NOT EDIT header; the source of truth is `spec/main.tsp` plus `scripts/generate-backend.js`. Regenerate with `npm run generate` instead of hand-editing.
* Hand-written backend code (handlers, domain logic, storage) lives outside `backend/src/gen/`.

## Commit Messages

Use Conventional Commits for all commits.

Allowed prefixes include:

* `feat:` — new functionality
* `fix:` — bug fix
* `docs:` — documentation
* `test:` — tests
* `refactor:` — refactoring
* `chore:` — maintenance
* `ci:` — CI/CD
* `build:` — build and dependency changes

Examples:

```text
feat: add user authentication
fix: handle invalid login
test: add authentication tests
refactor: simplify message service
chore: update dependencies
ci: update github actions
```

Do not use arbitrary commit messages without Conventional Commits.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (uses `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` at repo root + `docs/adr/`. See `docs/agents/domain.md`.
