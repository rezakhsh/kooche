CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_id" uuid,
	"path" "ltree" NOT NULL,
	"slug" text NOT NULL,
	"name_fa" text NOT NULL,
	"name_fa_normalized" text NOT NULL,
	"description_fa" text,
	"icon" text,
	"allows_listings" boolean DEFAULT false NOT NULL,
	"price_mode" text DEFAULT 'required' NOT NULL,
	"listing_duration_days" smallint DEFAULT 30 NOT NULL,
	"max_images" smallint DEFAULT 12 NOT NULL,
	"requires_review" boolean DEFAULT true NOT NULL,
	"business_only" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_path_key" UNIQUE("path"),
	CONSTRAINT "categories_slug_key" UNIQUE("slug"),
	CONSTRAINT "categories_slug_check" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "categories_price_mode_check" CHECK ("categories"."price_mode" IN ('required', 'optional', 'none')),
	CONSTRAINT "categories_listing_duration_days_check" CHECK ("categories"."listing_duration_days" BETWEEN 1 AND 365),
	CONSTRAINT "categories_max_images_check" CHECK ("categories"."max_images" BETWEEN 0 AND 30),
	CONSTRAINT "categories_root_check" CHECK (("categories"."parent_id" IS NULL) = (nlevel("categories"."path") = 1))
);
--> statement-breakpoint
CREATE TABLE "category_attribute_options" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" text NOT NULL,
	"label_fa" text NOT NULL,
	"parent_option_id" uuid,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_attribute_options_value_check" CHECK ("category_attribute_options"."value" ~ '^[a-z][a-z0-9_-]{0,39}$')
);
--> statement-breakpoint
CREATE TABLE "category_attributes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" uuid NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"label_fa" text NOT NULL,
	"unit_fa" text,
	"help_fa" text,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"depends_on_attribute_id" uuid,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"is_searchable" boolean DEFAULT false NOT NULL,
	"show_on_card" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_attributes_category_id_key_key" UNIQUE("category_id","key"),
	CONSTRAINT "category_attributes_key_check" CHECK ("category_attributes"."key" ~ '^[a-z][a-z0-9_]{0,39}$'),
	CONSTRAINT "category_attributes_type_check" CHECK ("category_attributes"."type" IN ('number', 'select', 'multi_select', 'boolean', 'text')),
	CONSTRAINT "category_attributes_validation_check" CHECK (jsonb_typeof("category_attributes"."validation") = 'object')
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name_fa" text NOT NULL,
	"name_local" text NOT NULL,
	"default_currency" text NOT NULL,
	"phone_prefix" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "countries_code_check" CHECK ("countries"."code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"minor_unit" smallint NOT NULL,
	"name_fa" text NOT NULL,
	"symbol" text NOT NULL,
	CONSTRAINT "currencies_code_check" CHECK ("currencies"."code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "currencies_minor_unit_check" CHECK ("currencies"."minor_unit" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"listing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_pkey" PRIMARY KEY("listing_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "listing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"listing_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"from_status" text,
	"to_status" text,
	"revision" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moderation_decision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_events_event_type_check" CHECK ("listing_events"."event_type" IN ('created', 'submitted', 'published', 'edited', 'paused', 'resumed', 'sold', 'expired', 'renewed', 'bumped', 'rejected', 'restored', 'deleted')),
	CONSTRAINT "listing_events_actor_type_check" CHECK ("listing_events"."actor_type" IN ('user', 'staff', 'system', 'ai', 'payment')),
	CONSTRAINT "listing_events_from_status_check" CHECK ("listing_events"."from_status" IN ('draft', 'pending_review', 'active', 'paused', 'sold', 'expired', 'rejected', 'deleted')),
	CONSTRAINT "listing_events_to_status_check" CHECK ("listing_events"."to_status" IN ('draft', 'pending_review', 'active', 'paused', 'sold', 'expired', 'rejected', 'deleted')),
	CONSTRAINT "listing_events_data_check" CHECK (jsonb_typeof("listing_events"."data") = 'object')
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"public_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"category_id" uuid,
	"kind" text DEFAULT 'offer' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"title_normalized" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"description_normalized" text DEFAULT '' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_type" text DEFAULT 'fixed' NOT NULL,
	"price_minor" bigint,
	"currency" text,
	"country_code" text,
	"location_id" uuid,
	"point" geography(Point,4326),
	"location_precision" text,
	"shipping_offered" boolean DEFAULT false NOT NULL,
	"allow_phone_contact" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"ranked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listings_public_token_key" UNIQUE("public_token"),
	CONSTRAINT "listings_public_token_check" CHECK ("listings"."public_token" ~ '^[0-9a-hjkmnp-tv-z]{10}$'),
	CONSTRAINT "listings_kind_check" CHECK ("listings"."kind" IN ('offer', 'wanted')),
	CONSTRAINT "listings_title_check" CHECK (char_length("listings"."title") <= 90),
	CONSTRAINT "listings_description_check" CHECK (char_length("listings"."description") <= 5000),
	CONSTRAINT "listings_attributes_check" CHECK (jsonb_typeof("listings"."attributes") = 'object'),
	CONSTRAINT "listings_price_type_check" CHECK ("listings"."price_type" IN ('fixed', 'negotiable', 'free', 'exchange', 'on_request')),
	CONSTRAINT "listings_price_minor_check" CHECK ("listings"."price_minor" >= 0),
	CONSTRAINT "listings_location_precision_check" CHECK ("listings"."location_precision" IN ('city', 'area')),
	CONSTRAINT "listings_status_check" CHECK ("listings"."status" IN ('draft', 'pending_review', 'active', 'paused', 'sold', 'expired', 'rejected', 'deleted')),
	CONSTRAINT "listings_publishable_check" CHECK ("listings"."status" = 'draft' OR (
        "listings"."category_id" IS NOT NULL AND "listings"."country_code" IS NOT NULL AND "listings"."location_id" IS NOT NULL
        AND "listings"."point" IS NOT NULL AND "listings"."location_precision" IS NOT NULL
        AND char_length("listings"."title") >= 3)),
	CONSTRAINT "listings_price_currency_check" CHECK (("listings"."price_minor" IS NULL) = ("listings"."currency" IS NULL)),
	CONSTRAINT "listings_price_required_check" CHECK ("listings"."status" = 'draft' OR ("listings"."price_type" IN ('fixed', 'negotiable')) = ("listings"."price_minor" IS NOT NULL)),
	CONSTRAINT "listings_active_dates_check" CHECK ("listings"."status" <> 'active' OR num_nonnulls("listings"."published_at", "listings"."ranked_at", "listings"."expires_at") = 3),
	CONSTRAINT "listings_deleted_check" CHECK (("listings"."status" = 'deleted') = ("listings"."deleted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"country_code" text NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name_fa" text NOT NULL,
	"name_fa_normalized" text NOT NULL,
	"name_local" text NOT NULL,
	"center" geography(Point,4326) NOT NULL,
	"timezone" text NOT NULL,
	"population" integer,
	"geonames_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "locations_geonames_id_key" UNIQUE("geonames_id"),
	CONSTRAINT "locations_id_country_code_key" UNIQUE("id","country_code"),
	CONSTRAINT "locations_kind_check" CHECK ("locations"."kind" IN ('region', 'city')),
	CONSTRAINT "locations_slug_check" CHECK ("locations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "locations_parent_check" CHECK (("locations"."kind" = 'region') = ("locations"."parent_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"listing_id" uuid NOT NULL,
	"uploader_user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"byte_size" integer,
	"blur_placeholder" text,
	"phash" bigint,
	"phash_bands" integer[] GENERATED ALWAYS AS (CASE WHEN phash IS NULL THEN NULL ELSE ARRAY[
          ((phash >> 48) & 65535)::int,
          ((phash >> 32) & 65535)::int + 65536,
          ((phash >> 16) & 65535)::int + 131072,
          ( phash        & 65535)::int + 196608 ]
        END) STORED,
	"sha256" "bytea",
	"processed_at" timestamp with time zone,
	CONSTRAINT "listing_images_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "listing_images_position_check" CHECK ("listing_images"."position" BETWEEN 0 AND 29),
	CONSTRAINT "listing_images_status_check" CHECK ("listing_images"."status" IN ('pending_upload', 'processing', 'ready', 'rejected', 'failed')),
	CONSTRAINT "listing_images_width_check" CHECK ("listing_images"."width" > 0),
	CONSTRAINT "listing_images_height_check" CHECK ("listing_images"."height" > 0),
	CONSTRAINT "listing_images_blur_placeholder_check" CHECK (char_length("listing_images"."blur_placeholder") <= 64),
	CONSTRAINT "listing_images_ready_check" CHECK ("listing_images"."status" <> 'ready' OR num_nonnulls("listing_images"."mime_type", "listing_images"."width", "listing_images"."height", "listing_images"."byte_size",
        "listing_images"."blur_placeholder", "listing_images"."phash", "listing_images"."sha256", "listing_images"."processed_at") = 8)
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"filters" jsonb NOT NULL,
	"filters_hash" "bytea" NOT NULL,
	"country_code" text,
	"category_id" uuid,
	"location_id" uuid,
	"point" geography(Point,4326),
	"radius_m" integer,
	"keyword_normalized" text,
	"notify_frequency" text DEFAULT 'instant' NOT NULL,
	"notify_channels" text[] DEFAULT '{telegram}'::text[] NOT NULL,
	"last_notified_at" timestamp with time zone,
	CONSTRAINT "saved_searches_name_check" CHECK (char_length("saved_searches"."name") <= 60),
	CONSTRAINT "saved_searches_filters_check" CHECK (jsonb_typeof("saved_searches"."filters") = 'object'),
	CONSTRAINT "saved_searches_radius_m_check" CHECK ("saved_searches"."radius_m" BETWEEN 1000 AND 500000),
	CONSTRAINT "saved_searches_point_radius_check" CHECK (("saved_searches"."point" IS NULL) = ("saved_searches"."radius_m" IS NULL)),
	CONSTRAINT "saved_searches_notify_frequency_check" CHECK ("saved_searches"."notify_frequency" IN ('off', 'instant', 'daily')),
	CONSTRAINT "saved_searches_notify_channels_check" CHECK ("saved_searches"."notify_channels" <@ ARRAY['email', 'telegram', 'push']::text[])
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"phone_e164" text,
	"link_token_hash" "bytea",
	"telegram_user_id" bigint,
	"code_hash" "bytea",
	"attempts" smallint DEFAULT 0 NOT NULL,
	"sms_provider" text,
	"provider_message_id" text,
	"failure_reason" text,
	"ip_address" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "phone_verifications_link_token_hash_key" UNIQUE("link_token_hash"),
	CONSTRAINT "phone_verifications_method_check" CHECK ("phone_verifications"."method" IN ('telegram', 'sms')),
	CONSTRAINT "phone_verifications_status_check" CHECK ("phone_verifications"."status" IN ('pending', 'verified', 'failed', 'expired')),
	CONSTRAINT "phone_verifications_phone_e164_check" CHECK ("phone_verifications"."phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "phone_verifications_attempts_check" CHECK ("phone_verifications"."attempts" BETWEEN 0 AND 10),
	CONSTRAINT "phone_verifications_sms_check" CHECK ("phone_verifications"."method" <> 'sms' OR ("phone_verifications"."phone_e164" IS NOT NULL AND "phone_verifications"."code_hash" IS NOT NULL)),
	CONSTRAINT "phone_verifications_telegram_check" CHECK ("phone_verifications"."method" <> 'telegram' OR "phone_verifications"."link_token_hash" IS NOT NULL),
	CONSTRAINT "phone_verifications_verified_check" CHECK ("phone_verifications"."status" <> 'verified' OR ("phone_verifications"."verified_at" IS NOT NULL AND "phone_verifications"."phone_e164" IS NOT NULL)),
	CONSTRAINT "phone_verifications_telegram_verified_check" CHECK ("phone_verifications"."method" <> 'telegram' OR "phone_verifications"."status" <> 'verified' OR "phone_verifications"."telegram_user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	CONSTRAINT "two_factors_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_pkey" PRIMARY KEY("blocker_user_id","blocked_user_id"),
	CONSTRAINT "user_blocks_self_check" CHECK ("user_blocks"."blocker_user_id" <> "user_blocks"."blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"public_token" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"display_name" text NOT NULL,
	"display_name_normalized" text NOT NULL,
	"avatar_key" text,
	"phone_e164" text,
	"phone_verified_at" timestamp with time zone,
	"phone_verification_method" text,
	"telegram_user_id" bigint,
	"staff_role" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"trust_score" smallint DEFAULT 50 NOT NULL,
	"home_location_id" uuid,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_public_token_key" UNIQUE("public_token"),
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_phone_e164_key" UNIQUE("phone_e164"),
	CONSTRAINT "users_telegram_user_id_key" UNIQUE("telegram_user_id"),
	CONSTRAINT "users_public_token_check" CHECK ("users"."public_token" ~ '^[0-9a-hjkmnp-tv-z]{10}$'),
	CONSTRAINT "users_email_check" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_display_name_check" CHECK (char_length("users"."display_name") BETWEEN 1 AND 50),
	CONSTRAINT "users_phone_e164_check" CHECK ("users"."phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "users_phone_verification_method_check" CHECK ("users"."phone_verification_method" IN ('telegram', 'sms')),
	CONSTRAINT "users_staff_role_check" CHECK ("users"."staff_role" IN ('moderator', 'admin')),
	CONSTRAINT "users_trust_score_check" CHECK ("users"."trust_score" BETWEEN 0 AND 100),
	CONSTRAINT "users_notification_prefs_check" CHECK (jsonb_typeof("users"."notification_prefs") = 'object'),
	CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('active', 'deactivated', 'deleted')),
	CONSTRAINT "users_phone_check" CHECK (num_nonnulls("users"."phone_e164", "users"."phone_verified_at", "users"."phone_verification_method") IN (0, 3)),
	CONSTRAINT "users_deleted_check" CHECK (("users"."status" = 'deleted') = ("users"."deleted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text,
	"phone_e164" text,
	"role" text NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "organization_invitations_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "organization_invitations_contact_check" CHECK (num_nonnulls("organization_invitations"."email", "organization_invitations"."phone_e164") = 1),
	CONSTRAINT "organization_invitations_phone_e164_check" CHECK ("organization_invitations"."phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "organization_invitations_role_check" CHECK ("organization_invitations"."role" IN ('owner', 'manager', 'staff'))
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_pkey" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "organization_members_role_check" CHECK ("organization_members"."role" IN ('owner', 'manager', 'staff'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"legal_name" text,
	"vat_id" text,
	"registration_number" text,
	"country_code" text NOT NULL,
	"location_id" uuid,
	"address_line1" text,
	"address_line2" text,
	"postal_code" text,
	"point" geography(Point,4326),
	"phone_e164" text,
	"email" text,
	"website" text,
	"description" text DEFAULT '' NOT NULL,
	"description_normalized" text DEFAULT '' NOT NULL,
	"logo_key" text,
	"cover_key" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_key" UNIQUE("slug"),
	CONSTRAINT "organizations_slug_check" CHECK ("organizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "organizations_name_check" CHECK (char_length("organizations"."name") BETWEEN 2 AND 80),
	CONSTRAINT "organizations_phone_e164_check" CHECK ("organizations"."phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "organizations_website_check" CHECK ("organizations"."website" ~ '^https://'),
	CONSTRAINT "organizations_description_check" CHECK (char_length("organizations"."description") <= 5000),
	CONSTRAINT "organizations_verification_status_check" CHECK ("organizations"."verification_status" IN ('unverified', 'pending', 'verified', 'rejected')),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" IN ('active', 'suspended', 'deleted')),
	CONSTRAINT "organizations_deleted_check" CHECK (("organizations"."status" = 'deleted') = ("organizations"."deleted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"buyer_last_read_at" timestamp with time zone,
	"seller_last_read_at" timestamp with time zone,
	"buyer_unread_count" integer DEFAULT 0 NOT NULL,
	"seller_unread_count" integer DEFAULT 0 NOT NULL,
	"buyer_archived_at" timestamp with time zone,
	"seller_archived_at" timestamp with time zone,
	CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" IN ('open', 'closed', 'locked')),
	CONSTRAINT "conversations_buyer_unread_count_check" CHECK ("conversations"."buyer_unread_count" >= 0),
	CONSTRAINT "conversations_seller_unread_count_check" CHECK ("conversations"."seller_unread_count" >= 0),
	CONSTRAINT "conversations_participants_check" CHECK ("conversations"."buyer_user_id" <> "conversations"."seller_user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"risk_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_kind_check" CHECK ("messages"."kind" IN ('text', 'system')),
	CONSTRAINT "messages_body_check" CHECK (char_length("messages"."body") BETWEEN 1 AND 4000),
	CONSTRAINT "messages_risk_flags_check" CHECK ("messages"."risk_flags" <@ ARRAY['link', 'payment_request', 'off_platform_contact', 'phone_number', 'iban']::text[]),
	CONSTRAINT "messages_sender_check" CHECK (("messages"."kind" = 'system') = ("messages"."sender_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"listing_id" uuid,
	"listing_image_id" uuid,
	"user_id" uuid,
	"organization_id" uuid,
	"message_id" uuid,
	"listing_revision" integer,
	"decision" text NOT NULL,
	"reason_code" text,
	"policy_ground" text,
	"legal_ground" text,
	"statement_fa" text,
	"decided_by" text NOT NULL,
	"moderator_user_id" uuid,
	"ai_model" text,
	"ai_score" real,
	"ai_output" jsonb,
	"appeal_of_decision_id" uuid,
	"content_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_decisions_target_check" CHECK (num_nonnulls("moderation_decisions"."listing_id", "moderation_decisions"."listing_image_id", "moderation_decisions"."user_id", "moderation_decisions"."organization_id", "moderation_decisions"."message_id") = 1),
	CONSTRAINT "moderation_decisions_listing_revision_check" CHECK (("moderation_decisions"."listing_id" IS NULL) = ("moderation_decisions"."listing_revision" IS NULL)),
	CONSTRAINT "moderation_decisions_decision_check" CHECK ("moderation_decisions"."decision" IN ('approve', 'reject', 'remove', 'hide', 'restore', 'warn', 'sanction', 'no_action', 'escalate')),
	CONSTRAINT "moderation_decisions_reason_code_check" CHECK ("moderation_decisions"."reason_code" IN ('scam', 'prohibited', 'counterfeit', 'wrong_category', 'duplicate', 'misleading', 'offensive', 'harassment', 'spam', 'illegal', 'personal_data', 'other')),
	CONSTRAINT "moderation_decisions_decided_by_check" CHECK ("moderation_decisions"."decided_by" IN ('staff', 'ai', 'rule')),
	CONSTRAINT "moderation_decisions_moderator_check" CHECK (("moderation_decisions"."decided_by" = 'staff') = ("moderation_decisions"."moderator_user_id" IS NOT NULL)),
	CONSTRAINT "moderation_decisions_ai_score_check" CHECK ("moderation_decisions"."ai_score" BETWEEN 0 AND 1),
	CONSTRAINT "moderation_decisions_ai_output_check" CHECK (jsonb_typeof("moderation_decisions"."ai_output") = 'object'),
	CONSTRAINT "moderation_decisions_content_snapshot_check" CHECK (jsonb_typeof("moderation_decisions"."content_snapshot") = 'object'),
	CONSTRAINT "moderation_decisions_statement_check" CHECK ("moderation_decisions"."decision" NOT IN ('reject', 'remove', 'hide', 'warn', 'sanction') OR (
        "moderation_decisions"."reason_code" IS NOT NULL AND "moderation_decisions"."statement_fa" IS NOT NULL
        AND num_nonnulls("moderation_decisions"."policy_ground", "moderation_decisions"."legal_ground") >= 1))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reporter_user_id" uuid,
	"reporter_email" text,
	"reporter_name" text,
	"listing_id" uuid,
	"reported_user_id" uuid,
	"organization_id" uuid,
	"message_id" uuid,
	"reason_code" text NOT NULL,
	"details" text,
	"is_illegal_content_notice" boolean DEFAULT false NOT NULL,
	"legal_reference" text,
	"good_faith_confirmed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" uuid,
	"moderation_decision_id" uuid,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_reporter_check" CHECK (num_nonnulls("reports"."reporter_user_id", "reports"."reporter_email") >= 1),
	CONSTRAINT "reports_reason_code_check" CHECK ("reports"."reason_code" IN ('scam', 'prohibited', 'counterfeit', 'wrong_category', 'duplicate', 'misleading', 'offensive', 'harassment', 'spam', 'illegal', 'personal_data', 'other')),
	CONSTRAINT "reports_details_check" CHECK (char_length("reports"."details") <= 2000),
	CONSTRAINT "reports_good_faith_check" CHECK (NOT "reports"."is_illegal_content_notice" OR "reports"."good_faith_confirmed"),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" IN ('open', 'in_review', 'resolved', 'dismissed')),
	CONSTRAINT "reports_target_check" CHECK (num_nonnulls("reports"."listing_id", "reports"."reported_user_id", "reports"."organization_id", "reports"."message_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "user_sanctions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"moderation_decision_id" uuid NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revoke_note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sanctions_type_check" CHECK ("user_sanctions"."type" IN ('warning', 'posting_restricted', 'messaging_restricted', 'suspended', 'banned')),
	CONSTRAINT "user_sanctions_period_check" CHECK ("user_sanctions"."ends_at" IS NULL OR "user_sanctions"."ends_at" > "user_sanctions"."starts_at"),
	CONSTRAINT "user_sanctions_permanent_check" CHECK ("user_sanctions"."type" NOT IN ('banned', 'warning') OR "user_sanctions"."ends_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	CONSTRAINT "billing_customers_payer_check" CHECK (num_nonnulls("billing_customers"."user_id", "billing_customers"."organization_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"listing_id" uuid,
	"order_id" uuid,
	"subscription_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	CONSTRAINT "entitlements_type_check" CHECK ("entitlements"."type" IN ('pro_plan', 'featured', 'top_of_category', 'homepage', 'highlight', 'bump', 'extended_radius')),
	CONSTRAINT "entitlements_holder_check" CHECK (num_nonnulls("entitlements"."user_id", "entitlements"."organization_id") = 1),
	CONSTRAINT "entitlements_source_check" CHECK (num_nonnulls("entitlements"."order_id", "entitlements"."subscription_id") = 1),
	CONSTRAINT "entitlements_listing_check" CHECK (("entitlements"."type" = 'pro_plan') = ("entitlements"."listing_id" IS NULL)),
	CONSTRAINT "entitlements_bump_check" CHECK (("entitlements"."type" = 'bump') = ("entitlements"."ends_at" IS NULL)),
	CONSTRAINT "entitlements_period_check" CHECK ("entitlements"."ends_at" IS NULL OR "entitlements"."ends_at" > "entitlements"."starts_at"),
	CONSTRAINT "entitlements_features_check" CHECK (jsonb_typeof("entitlements"."features") = 'object')
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"product_id" uuid NOT NULL,
	"product_price_id" uuid NOT NULL,
	"listing_id" uuid,
	"currency" text NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_checkout_id" text,
	"provider_invoice_id" text,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_provider_checkout_id_key" UNIQUE("provider_checkout_id"),
	CONSTRAINT "orders_subtotal_minor_check" CHECK ("orders"."subtotal_minor" >= 0),
	CONSTRAINT "orders_discount_minor_check" CHECK ("orders"."discount_minor" >= 0),
	CONSTRAINT "orders_tax_minor_check" CHECK ("orders"."tax_minor" >= 0),
	CONSTRAINT "orders_total_minor_check" CHECK ("orders"."total_minor" >= 0),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total_minor" = "orders"."subtotal_minor" - "orders"."discount_minor" + "orders"."tax_minor"),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')),
	CONSTRAINT "orders_paid_check" CHECK ("orders"."status" <> 'paid' OR "orders"."paid_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid,
	"subscription_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"fee_minor" bigint,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_payment_id" text NOT NULL,
	"provider_invoice_id" text,
	"failure_code" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_source_check" CHECK (num_nonnulls("payments"."order_id", "payments"."subscription_id") = 1),
	CONSTRAINT "payments_kind_check" CHECK ("payments"."kind" IN ('charge', 'refund')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('pending', 'succeeded', 'failed')),
	CONSTRAINT "payments_amount_minor_check" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_fee_minor_check" CHECK ("payments"."fee_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"interval" text,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_price_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_prices_amount_minor_check" CHECK ("product_prices"."amount_minor" > 0),
	CONSTRAINT "product_prices_interval_check" CHECK ("product_prices"."interval" IN ('month', 'year'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name_fa" text NOT NULL,
	"description_fa" text NOT NULL,
	"kind" text NOT NULL,
	"entitlement_type" text NOT NULL,
	"applies_to" text NOT NULL,
	"duration_days" smallint,
	"bump_count" smallint,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "products_code_key" UNIQUE("code"),
	CONSTRAINT "products_code_check" CHECK ("products"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "products_kind_check" CHECK ("products"."kind" IN ('one_time', 'subscription')),
	CONSTRAINT "products_entitlement_type_check" CHECK ("products"."entitlement_type" IN ('pro_plan', 'featured', 'top_of_category', 'homepage', 'highlight', 'bump', 'extended_radius')),
	CONSTRAINT "products_applies_to_check" CHECK ("products"."applies_to" IN ('listing', 'user', 'organization')),
	CONSTRAINT "products_features_check" CHECK (jsonb_typeof("products"."features") = 'object')
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"product_price_id" uuid NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "subscriptions_provider_subscription_id_key" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscriptions_subscriber_check" CHECK (num_nonnulls("subscriptions"."organization_id", "subscriptions"."user_id") = 1),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "webhook_events_payload_check" CHECK (jsonb_typeof("webhook_events"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"session_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" IN ('user', 'staff', 'system', 'webhook')),
	CONSTRAINT "audit_log_action_check" CHECK ("audit_log"."action" ~ '^[a-z_]+\.[a-z_]+$'),
	CONSTRAINT "audit_log_data_check" CHECK (jsonb_typeof("audit_log"."data") = 'object')
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_type_check" CHECK ("outbox_events"."event_type" ~ '^[a-z_]+\.[a-z_]+$'),
	CONSTRAINT "outbox_events_payload_check" CHECK (jsonb_typeof("outbox_events"."payload") = 'object')
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute_options" ADD CONSTRAINT "category_attribute_options_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."category_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute_options" ADD CONSTRAINT "category_attribute_options_parent_option_id_fkey" FOREIGN KEY ("parent_option_id") REFERENCES "public"."category_attribute_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_depends_on_attribute_id_fkey" FOREIGN KEY ("depends_on_attribute_id") REFERENCES "public"."category_attributes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_default_currency_currencies_code_fk" FOREIGN KEY ("default_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_moderation_decision_id_fkey" FOREIGN KEY ("moderation_decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_location_fkey" FOREIGN KEY ("location_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_fkey" FOREIGN KEY ("parent_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_location_id_locations_id_fk" FOREIGN KEY ("home_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_location_fkey" FOREIGN KEY ("location_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_listing_image_id_listing_images_id_fk" FOREIGN KEY ("listing_image_id") REFERENCES "public"."listing_images"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_moderator_user_id_users_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_appeal_of_decision_id_fkey" FOREIGN KEY ("appeal_of_decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderation_decision_id_moderation_decisions_id_fk" FOREIGN KEY ("moderation_decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_moderation_decision_id_fkey" FOREIGN KEY ("moderation_decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_price_id_product_prices_id_fk" FOREIGN KEY ("product_price_id") REFERENCES "public"."product_prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_price_id_product_prices_id_fk" FOREIGN KEY ("product_price_id") REFERENCES "public"."product_prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_path_idx" ON "categories" USING gist ("path");--> statement-breakpoint
CREATE INDEX "categories_parent_id_sort_order_idx" ON "categories" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "category_attribute_options_attribute_id_value_key" ON "category_attribute_options" USING btree ("attribute_id","value");--> statement-breakpoint
CREATE INDEX "category_attribute_options_parent_sort_idx" ON "category_attribute_options" USING btree ("attribute_id","parent_option_id","sort_order");--> statement-breakpoint
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "listing_events_listing_id_created_at_idx" ON "listing_events" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_country_category_ranked_idx" ON "listings" USING btree ("country_code","category_id","ranked_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_location_category_ranked_idx" ON "listings" USING btree ("location_id","category_id","ranked_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_location_ranked_idx" ON "listings" USING btree ("location_id","ranked_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_point_idx" ON "listings" USING gist ("point") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_attributes_idx" ON "listings" USING gin ("attributes" jsonb_path_ops) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_user_id_created_at_idx" ON "listings" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "listings_organization_ranked_idx" ON "listings" USING btree ("organization_id","ranked_at" DESC NULLS FIRST) WHERE status = 'active' AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "listings_expires_at_idx" ON "listings" USING btree ("expires_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "listings_review_queue_idx" ON "listings" USING btree ("status_changed_at") WHERE status = 'pending_review';--> statement-breakpoint
CREATE INDEX "listings_deleted_at_idx" ON "listings" USING btree ("deleted_at") WHERE status = 'deleted';--> statement-breakpoint
CREATE UNIQUE INDEX "locations_city_slug_key" ON "locations" USING btree ("slug") WHERE "locations"."kind" = 'city';--> statement-breakpoint
CREATE UNIQUE INDEX "locations_region_slug_key" ON "locations" USING btree ("country_code","slug") WHERE "locations"."kind" = 'region';--> statement-breakpoint
CREATE INDEX "locations_parent_id_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_center_idx" ON "locations" USING gist ("center");--> statement-breakpoint
CREATE INDEX "listing_images_phash_bands_idx" ON "listing_images" USING gin ("phash_bands") WHERE status = 'ready';--> statement-breakpoint
CREATE INDEX "listing_images_sha256_idx" ON "listing_images" USING btree ("sha256") WHERE status = 'ready';--> statement-breakpoint
CREATE INDEX "listing_images_abandoned_idx" ON "listing_images" USING btree ("created_at") WHERE status IN ('pending_upload', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_user_id_filters_hash_key" ON "saved_searches" USING btree ("user_id","filters_hash");--> statement-breakpoint
CREATE INDEX "saved_searches_matching_idx" ON "saved_searches" USING btree ("country_code","category_id") WHERE notify_frequency <> 'off';--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "phone_verifications_user_id_created_at_idx" ON "phone_verifications" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "phone_verifications_sms_phone_idx" ON "phone_verifications" USING btree ("phone_e164","created_at" DESC NULLS FIRST) WHERE method = 'sms';--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_user_id_idx" ON "user_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "organization_invitations_pending_idx" ON "organization_invitations" USING btree ("organization_id") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_country_code_vat_id_key" ON "organizations" USING btree ("country_code","vat_id") WHERE vat_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "organizations_verification_queue_idx" ON "organizations" USING btree ("created_at") WHERE verification_status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_listing_id_buyer_user_id_key" ON "conversations" USING btree ("listing_id","buyer_user_id");--> statement-breakpoint
CREATE INDEX "conversations_buyer_inbox_idx" ON "conversations" USING btree ("buyer_user_id","last_message_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "conversations_seller_inbox_idx" ON "conversations" USING btree ("seller_user_id","last_message_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "conversations_organization_inbox_idx" ON "conversations" USING btree ("organization_id","last_message_at" DESC NULLS FIRST) WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_id_idx" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_sender_user_id_created_at_idx" ON "messages" USING btree ("sender_user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "moderation_decisions_listing_id_created_at_idx" ON "moderation_decisions" USING btree ("listing_id","created_at" DESC NULLS FIRST) WHERE listing_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "moderation_decisions_user_id_created_at_idx" ON "moderation_decisions" USING btree ("user_id","created_at" DESC NULLS FIRST) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "moderation_decisions_moderator_created_at_idx" ON "moderation_decisions" USING btree ("moderator_user_id","created_at" DESC NULLS FIRST) WHERE moderator_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "moderation_decisions_ai_sample_idx" ON "moderation_decisions" USING btree ("created_at") WHERE decided_by = 'ai';--> statement-breakpoint
CREATE INDEX "reports_queue_idx" ON "reports" USING btree ("created_at") WHERE status IN ('open', 'in_review');--> statement-breakpoint
CREATE INDEX "reports_listing_id_idx" ON "reports" USING btree ("listing_id") WHERE listing_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_reported_user_id_idx" ON "reports" USING btree ("reported_user_id") WHERE reported_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_message_id_idx" ON "reports" USING btree ("message_id") WHERE message_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_reporter_user_id_created_at_idx" ON "reports" USING btree ("reporter_user_id","created_at" DESC NULLS FIRST) WHERE reporter_user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_per_reporter_listing_key" ON "reports" USING btree ("reporter_user_id","listing_id") WHERE status IN ('open', 'in_review') AND reporter_user_id IS NOT NULL AND listing_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_sanctions_active_idx" ON "user_sanctions" USING btree ("user_id","starts_at") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_provider_customer_id_key" ON "billing_customers" USING btree ("provider","provider_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_provider_user_id_key" ON "billing_customers" USING btree ("provider","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_provider_organization_id_key" ON "billing_customers" USING btree ("provider","organization_id");--> statement-breakpoint
CREATE INDEX "entitlements_listing_idx" ON "entitlements" USING btree ("listing_id","type","ends_at") WHERE listing_id IS NOT NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "entitlements_paid_slots_idx" ON "entitlements" USING btree ("type","ends_at") WHERE type IN ('featured', 'top_of_category', 'homepage') AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "entitlements_organization_idx" ON "entitlements" USING btree ("organization_id","type","ends_at") WHERE organization_id IS NOT NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id","type","ends_at") WHERE user_id IS NOT NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "entitlements_due_bumps_idx" ON "entitlements" USING btree ("starts_at") WHERE type = 'bump' AND applied_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "entitlements_order_id_idx" ON "entitlements" USING btree ("order_id") WHERE order_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "entitlements_subscription_id_idx" ON "entitlements" USING btree ("subscription_id") WHERE subscription_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_buyer_user_id_created_at_idx" ON "orders" USING btree ("buyer_user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "orders_organization_id_created_at_idx" ON "orders" USING btree ("organization_id","created_at" DESC NULLS FIRST) WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_listing_id_idx" ON "orders" USING btree ("listing_id") WHERE listing_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id") WHERE order_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_subscription_id_occurred_at_idx" ON "payments" USING btree ("subscription_id","occurred_at" DESC NULLS FIRST) WHERE subscription_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_provider_price_id_key" ON "product_prices" USING btree ("provider","provider_price_id");--> statement-breakpoint
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" USING btree ("organization_id") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_unprocessed_idx" ON "webhook_events" USING btree ("created_at") WHERE processed_at IS NULL;--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_created_at_idx" ON "audit_log" USING btree ("actor_user_id","created_at" DESC NULLS FIRST) WHERE actor_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING brin ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_unprocessed_idx" ON "outbox_events" USING btree ("id") WHERE processed_at IS NULL;