#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env && -f db-client.env ]] || { echo 'Missing .env or db-client.env' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source ./db-client.env
set +a
: "${MYSQL_HOST:?}" "${MYSQL_PORT:?}" "${MYSQL_USER:?}" "${MYSQL_PASSWORD:?}" "${METRIC_DB_HOST:?}" "${METRIC_DB_PORT:?}" "${METRIC_DB_USER:?}" "${METRIC_DB_PASSWORD:?}"
export MYSQL_PWD="$MYSQL_PASSWORD"
docker run --rm --env-file .env \
  --env METRIC_DB_HOST --env METRIC_DB_PORT --env METRIC_DB_USER --env METRIC_DB_PASSWORD \
  --mount "type=bind,src=$PWD/configure-demo-source.mjs,dst=/tmp/configure-demo-source.mjs,readonly" \
  --entrypoint node report-platform/report-web:2026-09-23 /tmp/configure-demo-source.mjs \
  | docker run --rm -i --env MYSQL_PWD mysql:8.0.27 mysql --protocol=TCP --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" --default-character-set=utf8mb4
docker run --rm -i --env MYSQL_PWD mysql:8.0.27 mysql --protocol=TCP --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" --batch --skip-column-names -e "SELECT COUNT(*),host,port,username FROM report_platform.DataSource WHERE databaseName='report_metrics_demo' GROUP BY host,port,username"
