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
