-- Extensions (docs/schema.md, section 2). Nothing else: uuidv7() is built into PostgreSQL 18.
-- postgis is not a trusted extension. It is installed by the superuser bootstrap
-- (src/db/bootstrap/01-classifieds.sh) through the database template, so this line is a no-op there
-- and only documents the dependency. ltree is trusted, so the owner role can create it.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS ltree;
