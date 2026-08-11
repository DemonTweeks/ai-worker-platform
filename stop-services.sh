#!/usr/bin/env bash

set -euo pipefail

screen -S backend-server -X quit 2>/dev/null || true
screen -S frontend-server -X quit 2>/dev/null || true
echo "AI Worker Platform screen sessions stopped."
