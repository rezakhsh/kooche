-- The owner role (Nov 3, 2026): the site's owner, one person, set only with scripts/make-staff.ts;
-- an admin who may also decide on their own listings (src/modules/moderation/decide.ts).
ALTER TABLE "users" DROP CONSTRAINT "users_staff_role_check";--> statement-breakpoint
CREATE UNIQUE INDEX "users_owner_key" ON "users" USING btree ("staff_role") WHERE "users"."staff_role" = 'owner';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_role_check" CHECK ("users"."staff_role" IN ('moderator', 'admin', 'owner'));