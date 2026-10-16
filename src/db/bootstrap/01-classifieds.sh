#!/bin/bash
# One-time cluster setup, run as the PostgreSQL superuser. Locally the postgres image runs it
# on first start (compose.yaml). On a server, run it once by hand after initdb:
#
#   CLASSIFIEDS_OWNER_PASSWORD=... ./01-classifieds.sh
#
# It creates what migrations can't create for themselves:
# - classifieds_owner, which runs migrations and owns every object. Not a superuser. CREATEROLE
#   lets the roles migration create classifieds_app, classifieds_worker and classifieds_readonly.
# - classifieds_template with postgis, which is not a trusted extension, so only a superuser can
#   install it. Every application database is created from this template.
set -euo pipefail

: "${CLASSIFIEDS_OWNER_PASSWORD:?CLASSIFIEDS_OWNER_PASSWORD must be set}"
db="${CLASSIFIEDS_DB:-classifieds}"
createdb_opt="NOCREATEDB"
if [ "${CLASSIFIEDS_OWNER_CREATEDB:-false}" = "true" ]; then createdb_opt="CREATEDB"; fi

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres \
  -v owner_password="$CLASSIFIEDS_OWNER_PASSWORD" -v db="$db" -v createdb_opt="$createdb_opt" <<'EOSQL'
CREATE ROLE classifieds_owner LOGIN CREATEROLE :createdb_opt PASSWORD :'owner_password';
CREATE DATABASE classifieds_template IS_TEMPLATE true;
\c classifieds_template
CREATE EXTENSION postgis;
\c postgres
CREATE DATABASE :"db" OWNER classifieds_owner TEMPLATE classifieds_template;
EOSQL
