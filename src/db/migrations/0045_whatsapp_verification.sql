-- WhatsApp phone verification (Nov 3, 2026): the user sends us a code on WhatsApp and the sender's
-- number is verified (src/modules/users/whatsapp.ts). Only the code's hash is stored, like the bot's token.
ALTER TABLE "phone_verifications" DROP CONSTRAINT "phone_verifications_method_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_verification_method_check";--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_whatsapp_check" CHECK ("phone_verifications"."method" <> 'whatsapp' OR "phone_verifications"."link_token_hash" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_method_check" CHECK ("phone_verifications"."method" IN ('telegram', 'telegram_oidc', 'sms', 'whatsapp'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_verification_method_check" CHECK ("users"."phone_verification_method" IN ('telegram', 'telegram_oidc', 'sms', 'whatsapp'));