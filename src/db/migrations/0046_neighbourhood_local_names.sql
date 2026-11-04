-- Neighbourhood names as written locally everywhere (owner, Nov 3, 2026): «Wedding», the same as on
-- the map. The Persian names go; other cities' districts come from OpenStreetMap.
ALTER TABLE "neighbourhoods" DROP CONSTRAINT "neighbourhoods_name_fa_check";--> statement-breakpoint
ALTER TABLE "neighbourhoods" DROP COLUMN "name_fa";