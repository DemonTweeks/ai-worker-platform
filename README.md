# AI Worker Platform

Internal AI Worker Platform foundation for the PR Worker MVP.

## Structure

```text
ai-worker-platform/
|-- frontend/              # Vue2 web app
|-- backend/               # Express.js API
|-- skills/create-pr-cd/   # Existing PR/ECC generation skill
|-- storage/               # Local runtime storage placeholders
|-- docker/                # Deployment artifacts
`-- docs/                  # Product, technical, and ADR references
```

## Local Development

1. Copy `.env.example` to `.env` and adjust local values.
2. Install backend dependencies:

```bash
cd backend
npm install
npm run dev
```

3. Install frontend dependencies:

```bash
cd frontend
npm install
npm run dev
```

Backend health is available at `http://localhost:8000/health`.
Frontend runs at `http://localhost:3000`.

## Docker Deployment

Windows 11 Pro deployment with Docker Desktop is documented in:

```text
docs/deployment-windows.md
```

The MVP stack is started with:

```bash
docker compose up -d --build
```
