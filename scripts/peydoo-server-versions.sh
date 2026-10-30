#!/bin/sh
# Writes the versions of the servers the worker can't ask itself (Meilisearch, imgproxy, Coolify)
# to Valkey, for the software update check (src/modules/admin/software.ts; docs/setup.md,
# "Software updates"). Installed on each server as /usr/local/bin/peydoo-server-versions, run
# nightly from /etc/cron.d/peydoo-server-versions. Expires after 3 days, so a stopped script shows
# as "version unknown" on the admin page. Never prints the Valkey password.
set -eu
tag() { docker ps --format '{{.Image}}' | grep -E "^$1:" | head -1 | sed 's/.*://; s/^v//; s/-.*//'; }
JSON=$(printf '{"meilisearch":"%s","imgproxy":"%s","coolify":"%s"}' "$(tag '(docker\.io/)?getmeili/meilisearch')" "$(tag 'ghcr\.io/imgproxy/imgproxy')" "$(tag '(ghcr\.io/)?coollabsio/coolify')")
VALKEY=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^valkey\/valkey:/ {print $1; exit}')
VALKEY_PASSWORD=$(sed -n 's/^VALKEY_PASSWORD=//p' /root/.secrets/valkey.env)
docker exec -e REDISCLI_AUTH="$VALKEY_PASSWORD" "$VALKEY" valkey-cli -n 0 SET peydoo:server-versions "$JSON" EX 259200 > /dev/null
echo "$(date -u +%FT%TZ) $JSON"
