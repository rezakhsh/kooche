ALTER TABLE "phone_verifications" DROP CONSTRAINT "phone_verifications_method_check";--> statement-breakpoint
ALTER TABLE "phone_verifications" DROP CONSTRAINT "phone_verifications_telegram_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_verification_method_check";--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_method_check" CHECK ("phone_verifications"."method" IN ('telegram', 'telegram_oidc', 'sms'));--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_telegram_check" CHECK ("phone_verifications"."method" NOT IN ('telegram', 'telegram_oidc') OR "phone_verifications"."link_token_hash" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_verification_method_check" CHECK ("users"."phone_verification_method" IN ('telegram', 'telegram_oidc', 'sms'));