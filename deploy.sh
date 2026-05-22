#!/bin/bash

set -e

echo "========================================"
echo "AI Worker Platform Launcher"
echo "========================================"
echo

# Git session
git checkout main
git branch -D repack/ai-worker-platform || true
git pull --recurse-submodules
git submodule sync --recursive
git submodule update --init --recursive
git checkout -b repack/ai-worker-platform origin/repack/ai-worker-platform
git submodule sync --recursive
git submodule update --init --recursive

# Some repositories are declared in .gitmodules but do not have a gitlink in
# the current branch. Git ignores those entries during `submodule update`, so
# clone them explicitly to ensure every configured repository is available.
git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | while read -r key path; do
 module_name="${key#submodule.}"
 module_name="${module_name%.path}"
 module_url="$(git config -f .gitmodules --get "submodule.${module_name}.url")"

 if [ -e "$path/.git" ] && git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Submodule already available: $path"
 elif [ -n "$module_url" ]; then
  echo "Fetching submodule $path"
  git clone "$module_url" "$path"
 else
  echo "[ERROR] No URL configured for submodule: $path"
  exit 1
 fi
done

# Backend installation
if [ ! -d "backend" ]; then
 echo "[ERROR] backend folder missing."
 read -p "Press enter to exit..."
 exit 1
fi

cd backend

echo "[1/5] Installing backend dependencies..."
npm install

cd ..

# Install additional Python dependencies for skills
if [ ! -d "skills/create-pr-cd" ]; then
 echo "[ERROR] skills/create-pr-cd folder missing."
 read -p "Press enter to exit..."
 exit 1
fi

cd skills/create-pr-cd

echo "[2/5] Installing Python skills dependencies..."
pip install -r requirements.txt --break-system-packages

cd ../..

# Frontend installation
if [ ! -d "frontend" ]; then
 echo "[ERROR] frontend folder missing."
 read -p "Press enter to exit..."
 exit 1
fi

cd frontend

echo "[3/5] Installing frontend dependencies..."
npm install

cd ..

# Kill old screen sessions if exist
screen -S backend-server -X quit 2>/dev/null || true
screen -S frontend-preview -X quit 2>/dev/null || true

# Start backend server
echo "[4/5] Starting backend server..."

screen -dmS backend-server bash -c "
cd backend
node src/server.js
exec bash
"

# Start frontend
echo "[5/5] Starting frontend (build + preview)..."

screen -dmS frontend-preview bash -c "
cd frontend
npm run build && npm run preview
exec bash
"

echo
echo "========================================"
echo "Launch complete!"
echo "========================================"
echo
echo "Backend screen session : backend-server"
echo "Frontend screen session: frontend-preview"
echo
echo "Useful commands:"
echo
echo "Attach backend:"
echo "screen -r backend-server"
echo
echo "Attach frontend:"
echo "screen -r frontend-preview"
echo
echo "List screens:"
echo "screen -ls"
echo
echo "Kill backend:"
echo "screen -S backend-server -X quit"
echo
echo "Kill frontend:"
echo "screen -S frontend-preview -X quit"
echo
