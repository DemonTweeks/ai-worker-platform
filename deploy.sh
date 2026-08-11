#!/usr/bin/env bash

set -euo pipefail

profile="${1:-local}"
install_dependencies="${2:-}"

if [[ "$profile" != "local" && "$profile" != "production" ]]; then
  echo "Usage: ./deploy.sh [local|production] [--install]" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$repo_root/config/env/$profile.env"
template_file="$repo_root/config/env/$profile.env.example"

if [[ ! -f "$env_file" ]]; then
  echo "Runtime profile is missing: $env_file" >&2
  echo "Copy $template_file and provide the required values." >&2
  exit 1
fi

export AI_WORKER_PROFILE="$profile"
cd "$repo_root"

git submodule sync --recursive
git submodule update --init --recursive
node -e "require('./backend/src/config/env')"

if [[ "$install_dependencies" == "--install" ]]; then
  npm --prefix backend ci
  npm --prefix frontend ci

  python_executable="python3"
  if [[ -x "$repo_root/.venv/bin/python" ]]; then
    python_executable="$repo_root/.venv/bin/python"
  fi

  "$python_executable" -m pip install -r requirements-worker.txt
  for requirements_file in skills/*/requirements.txt; do
    if [[ -f "$requirements_file" ]]; then
      "$python_executable" -m pip install -r "$requirements_file"
    fi
  done
fi

screen -S backend-server -X quit 2>/dev/null || true
screen -S frontend-server -X quit 2>/dev/null || true

if [[ "$profile" == "production" ]]; then
  npm --prefix frontend run build
  screen -dmS backend-server bash -lc "cd '$repo_root' && export AI_WORKER_PROFILE=production && npm --prefix backend start"
  screen -dmS frontend-server bash -lc "cd '$repo_root' && export AI_WORKER_PROFILE=production && npm --prefix frontend run preview"
  echo "Production services started. Configure Nginx with frontend/nginx.conf and open /fe/."
else
  screen -dmS backend-server bash -lc "cd '$repo_root' && export AI_WORKER_PROFILE=local && npm --prefix backend run dev"
  screen -dmS frontend-server bash -lc "cd '$repo_root' && export AI_WORKER_PROFILE=local && npm --prefix frontend run dev"
  echo "Local services started at http://localhost:3000."
fi

echo "Attach with: screen -r backend-server or screen -r frontend-server"
