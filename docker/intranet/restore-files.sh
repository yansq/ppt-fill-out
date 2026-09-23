#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f report-data.tar.gz ]] || { echo 'Missing report-data.tar.gz' >&2; exit 1; }
docker volume create report-data >/dev/null
docker run --rm --user 0:0 \
  --mount type=volume,src=report-data,dst=/data \
  --mount "type=bind,src=$PWD/report-data.tar.gz,dst=/tmp/report-data.tar.gz,readonly" \
  --entrypoint sh report-platform/report-web:2026-09-23 -c \
  'if [ -n "$(find /data -mindepth 1 -print -quit)" ]; then echo "report-data volume is not empty" >&2; exit 1; fi; tar -xzf /tmp/report-data.tar.gz -C /data; chown -R 1001:1001 /data'
echo 'Restored template, preview and generated files to report-data.'
