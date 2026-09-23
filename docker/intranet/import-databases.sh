#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

[[ -f db-client.env && -f mysql-test-data.sql.gz ]] || { echo 'Missing db-client.env or mysql-test-data.sql.gz' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source ./db-client.env
set +a
: "${MYSQL_HOST:?}" "${MYSQL_PORT:?}" "${MYSQL_USER:?}" "${MYSQL_PASSWORD:?}"
export MYSQL_PWD="$MYSQL_PASSWORD"
mysql_cmd=(docker run --rm -i --env MYSQL_PWD mysql:8.0.27 mysql --protocol=TCP --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" --default-character-set=utf8mb4)
existing=$("${mysql_cmd[@]}" --batch --skip-column-names -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('report_platform','report_metrics_demo')")
if [[ -n "$existing" ]]; then
  echo "Target database already contains: $existing. Import requires both names to be unused." >&2
  exit 1
fi
gzip -cd mysql-test-data.sql.gz | "${mysql_cmd[@]}"
"${mysql_cmd[@]}" --batch --skip-column-names -e "SELECT 'report_platform',COUNT(*) FROM report_platform._prisma_migrations UNION ALL SELECT 'report_metrics_demo',COUNT(*) FROM report_metrics_demo.metric_record"
