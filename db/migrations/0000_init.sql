CREATE TYPE "public"."actor_type" AS ENUM('CUSTOMER', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."auction_outcome" AS ENUM('WON', 'NO_BIDS', 'RESERVE_NOT_MET', 'MIN_PARTICIPANTS_NOT_MET');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'FINALIZING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('INFO', 'NOTICE', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."autobid_status" AS ENUM('ACTIVE', 'COMPLETED', 'EXHAUSTED', 'STOPPED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."bid_kind" AS ENUM('MANUAL', 'AUTOBID', 'SIMULATED');--> statement-breakpoint
CREATE TYPE "public"."bid_pack_order_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."credit_bucket" AS ENUM('PURCHASED', 'PROMOTIONAL');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('GBP', 'EUR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."drop_state" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."fraud_case_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'CLEARED', 'THROTTLED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."idempotency_status" AS ENUM('IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."inventory_event_type" AS ENUM('RECEIVED', 'RESERVED', 'RESERVATION_RELEASED', 'SOLD', 'DAMAGED', 'RETURNED', 'RESTOCKED', 'ADJUSTED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('BID_PACK_PURCHASE', 'PROMOTIONAL_CREDIT', 'AUCTION_BID', 'BID_REFUND', 'BUY_NOW_RECOVERY', 'ADMIN_ADJUSTMENT', 'EXPIRY');--> statement-breakpoint
CREATE TYPE "public"."market" AS ENUM('UK', 'IE', 'US');--> statement-breakpoint
CREATE TYPE "public"."message_author" AS ENUM('CUSTOMER', 'AGENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('AUCTION_STARTING', 'OUTBID', 'AUCTION_WON', 'AUCTION_LOST', 'AUCTION_ENDING', 'DROP_STARTING', 'ORDER_PAID', 'ORDER_SHIPPED', 'REWARD_EARNED', 'BID_BALANCE_LOW', 'LIMIT_THRESHOLD', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('AUCTION_WIN', 'MARKETPLACE', 'FLASH_DROP', 'AUCTION_BUY_NOW');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('ORDER', 'BID_PACK');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('NEW', 'REFURBISHED', 'OPEN_BOX');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('ACTIVE', 'DRAFT', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('ACTIVE', 'PAUSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SHIPPING', 'BONUS_BID_CREDITS', 'BID_PACK_DISCOUNT', 'CATEGORY_OFFER', 'NEW_CUSTOMER');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."recovery_mode" AS ENUM('RETURN_BIDS', 'PRICE_CREDIT');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."reward_entry_type" AS ENUM('EARN_PURCHASE', 'EARN_ACHIEVEMENT', 'EARN_REFERRAL', 'REDEEM', 'EXPIRE', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."reward_tier" AS ENUM('MEMBER', 'SILVER', 'GOLD', 'PLATINUM');--> statement-breakpoint
CREATE TYPE "public"."risk_action" AS ENUM('ALLOW', 'REVIEW', 'THROTTLE', 'BLOCK');--> statement-breakpoint
CREATE TYPE "public"."risk_class" AS ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CUSTOMER', 'SUPPORT_AGENT', 'OPERATIONS', 'MERCHANDISER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."shipping_class" AS ENUM('DIGITAL', 'SMALL', 'STANDARD', 'LARGE');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('ACTIVE', 'ONBOARDING', 'ON_HOLD');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('auction', 'payment', 'wallet', 'order', 'delivery', 'refund', 'technical', 'account');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'UNDER_REVIEW', 'RESTRICTED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."watch_target" AS ENUM('AUCTION', 'PRODUCT', 'DROP');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"full_name" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"postcode" text NOT NULL,
	"country_code" text DEFAULT 'GB' NOT NULL,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limit_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" integer,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "limit_change_requests_field" CHECK ("limit_change_requests"."field" IN ('dailyBidLimit', 'weeklyBidLimit', 'monthlyBidPurchaseBudgetMinor')),
	CONSTRAINT "limit_change_requests_delay" CHECK ("limit_change_requests"."effective_at" >= "limit_change_requests"."requested_at" + interval '24 hours')
);
--> statement-breakpoint
CREATE TABLE "responsible_use_limits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_bid_limit" integer,
	"weekly_bid_limit" integer,
	"monthly_bid_purchase_budget_minor" integer,
	"budget_currency" "currency" DEFAULT 'GBP' NOT NULL,
	"cool_off_until" timestamp with time zone,
	"spending_notifications" boolean DEFAULT true NOT NULL,
	"bid_use_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "limits_daily_positive" CHECK ("responsible_use_limits"."daily_bid_limit" IS NULL OR "responsible_use_limits"."daily_bid_limit" > 0),
	CONSTRAINT "limits_weekly_positive" CHECK ("responsible_use_limits"."weekly_bid_limit" IS NULL OR "responsible_use_limits"."weekly_bid_limit" > 0),
	CONSTRAINT "limits_budget_positive" CHECK ("responsible_use_limits"."monthly_bid_purchase_budget_minor" IS NULL OR "responsible_use_limits"."monthly_bid_purchase_budget_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "reward_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier" "reward_tier" DEFAULT 'MEMBER' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"qualifying_points" integer DEFAULT 0 NOT NULL,
	"weekly_streak" integer DEFAULT 0 NOT NULL,
	"referral_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_accounts_balance_non_negative" CHECK ("reward_accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"locale" text DEFAULT 'en-GB' NOT NULL,
	"notification_channels" jsonb DEFAULT '{"IN_APP":true,"EMAIL":true,"PUSH":false,"SMS":false}'::jsonb NOT NULL,
	"notification_types" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"auth_provider_id" text,
	"display_name" text NOT NULL,
	"handle" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"phone" text,
	"age_verified_at" timestamp with time zone,
	"date_of_birth" date,
	"market" "market" DEFAULT 'UK' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"restriction_reason" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"previous_wins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "users_previous_wins_non_negative" CHECK ("users"."previous_wins" >= 0)
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text,
	"art_key" text,
	"alt" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"licence" text,
	CONSTRAINT "product_images_source" CHECK ("product_images"."url" IS NOT NULL OR "product_images"."art_key" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"subcategory" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"description" text NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"reference_price_minor" integer NOT NULL,
	"buy_now_price_minor" integer NOT NULL,
	"cost_price_minor" integer NOT NULL,
	"condition" "product_condition" DEFAULT 'NEW' NOT NULL,
	"shipping_class" "shipping_class" DEFAULT 'STANDARD' NOT NULL,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"auction_eligible" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rating" real,
	"review_count" integer DEFAULT 0 NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_prices_non_negative" CHECK ("products"."reference_price_minor" >= 0 AND "products"."buy_now_price_minor" >= 0 AND "products"."cost_price_minor" >= 0),
	CONSTRAINT "products_buy_now_within_reference" CHECK ("products"."buy_now_price_minor" <= "products"."reference_price_minor"),
	CONSTRAINT "products_rating_range" CHECK ("products"."rating" IS NULL OR "products"."rating" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	CONSTRAINT "purchase_order_lines_quantity_positive" CHECK ("purchase_order_lines"."quantity" > 0),
	CONSTRAINT "purchase_order_lines_received_within_quantity" CHECK ("purchase_order_lines"."received_quantity" BETWEEN 0 AND "purchase_order_lines"."quantity"),
	CONSTRAINT "purchase_order_lines_cost_non_negative" CHECK ("purchase_order_lines"."unit_cost_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"expected_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "supplier_status" DEFAULT 'ONBOARDING' NOT NULL,
	"country_code" text NOT NULL,
	"lead_time_days" integer NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"on_time_rate_bps" integer,
	"fill_rate_bps" integer,
	"defect_rate_bps" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_lead_time_positive" CHECK ("suppliers"."lead_time_days" >= 0),
	CONSTRAINT "suppliers_rates_bps" CHECK (coalesce("suppliers"."on_time_rate_bps", 0) BETWEEN 0 AND 10000 AND coalesce("suppliers"."fill_rate_bps", 0) BETWEEN 0 AND 10000 AND coalesce("suppliers"."defect_rate_bps", 0) BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "inventory_event_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"note" text,
	"actor" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_events_quantity_sign" CHECK (("inventory_events"."type" = 'ADJUSTED' AND "inventory_events"."quantity" <> 0) OR ("inventory_events"."type" <> 'ADJUSTED' AND "inventory_events"."quantity" > 0)),
	CONSTRAINT "inventory_events_reference_type" CHECK ("inventory_events"."reference_type" IS NULL OR "inventory_events"."reference_type" IN ('AUCTION', 'ORDER', 'DROP', 'PURCHASE_ORDER', 'MANUAL'))
);
--> statement-breakpoint
CREATE TABLE "inventory_positions" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"damaged" integer DEFAULT 0 NOT NULL,
	"returned" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_positions_non_negative" CHECK ("inventory_positions"."on_hand" >= 0 AND "inventory_positions"."reserved" >= 0 AND "inventory_positions"."sold" >= 0 AND "inventory_positions"."damaged" >= 0 AND "inventory_positions"."returned" >= 0),
	CONSTRAINT "inventory_positions_reserved_within_on_hand" CHECK ("inventory_positions"."reserved" <= "inventory_positions"."on_hand")
);
--> statement-breakpoint
CREATE TABLE "auction_participants" (
	"auction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"bids" integer DEFAULT 0 NOT NULL,
	"purchased_credits_spent" integer DEFAULT 0 NOT NULL,
	"promotional_credits_spent" integer DEFAULT 0 NOT NULL,
	"first_bid_at" timestamp with time zone NOT NULL,
	"last_bid_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auction_participants_auction_id_user_id_pk" PRIMARY KEY("auction_id","user_id"),
	CONSTRAINT "auction_participants_non_negative" CHECK ("auction_participants"."bids" >= 0 AND "auction_participants"."purchased_credits_spent" >= 0 AND "auction_participants"."promotional_credits_spent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auction_results" (
	"auction_id" uuid PRIMARY KEY NOT NULL,
	"outcome" "auction_outcome" NOT NULL,
	"winner_id" uuid,
	"final_price_minor" integer NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"bid_count" integer NOT NULL,
	"unique_bidders" integer NOT NULL,
	"winner_bid_count" integer DEFAULT 0 NOT NULL,
	"bids_refunded" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"order_id" uuid,
	CONSTRAINT "auction_results_winner_consistency" CHECK (("auction_results"."outcome" = 'WON') = ("auction_results"."winner_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "auction_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"from_status" "auction_status" NOT NULL,
	"to_status" "auction_status" NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auction_transitions_actor" CHECK ("auction_transitions"."actor_type" IN ('SYSTEM', 'ADMIN'))
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"label" text,
	"status" "auction_status" DEFAULT 'DRAFT' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"starting_price_minor" integer DEFAULT 0 NOT NULL,
	"bid_increment_minor" integer DEFAULT 1 NOT NULL,
	"bid_credit_cost" integer DEFAULT 1 NOT NULL,
	"timer_seconds" integer NOT NULL,
	"timer_extension_seconds" integer DEFAULT 15 NOT NULL,
	"hard_stop_after_seconds" integer,
	"minimum_participants" integer DEFAULT 2 NOT NULL,
	"maximum_participants" integer,
	"reserve_price_minor" integer,
	"per_user_bid_limit" integer,
	"prevent_self_outbid" boolean DEFAULT true NOT NULL,
	"autobid_enabled" boolean DEFAULT true NOT NULL,
	"buy_now_enabled" boolean DEFAULT true NOT NULL,
	"buy_now_price_minor" integer,
	"bid_credit_recovery_enabled" boolean DEFAULT true NOT NULL,
	"recovery_mode" "recovery_mode" DEFAULT 'RETURN_BIDS' NOT NULL,
	"recovery_window_hours" integer DEFAULT 48 NOT NULL,
	"recover_promotional_bids" boolean DEFAULT true NOT NULL,
	"winner_payment_window_hours" integer DEFAULT 72 NOT NULL,
	"eligibility" jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"close_at" timestamp with time zone NOT NULL,
	"hard_close_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"remaining_at_pause_ms" bigint,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"bid_count" integer DEFAULT 0 NOT NULL,
	"unique_bidders" integer DEFAULT 0 NOT NULL,
	"last_bid_at" timestamp with time zone,
	"leader_id" uuid,
	"leader_name" text,
	"version" integer DEFAULT 1 NOT NULL,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auctions_money_non_negative" CHECK ("auctions"."starting_price_minor" >= 0 AND "auctions"."price_minor" >= 0 AND coalesce("auctions"."reserve_price_minor", 0) >= 0 AND coalesce("auctions"."buy_now_price_minor", 0) >= 0),
	CONSTRAINT "auctions_increment_positive" CHECK ("auctions"."bid_increment_minor" BETWEEN 1 AND 10000),
	CONSTRAINT "auctions_bid_cost_positive" CHECK ("auctions"."bid_credit_cost" BETWEEN 1 AND 10),
	CONSTRAINT "auctions_timer_bounds" CHECK ("auctions"."timer_seconds" BETWEEN 30 AND 604800 AND "auctions"."timer_extension_seconds" BETWEEN 5 AND 120),
	CONSTRAINT "auctions_participants" CHECK ("auctions"."minimum_participants" >= 1 AND ("auctions"."maximum_participants" IS NULL OR "auctions"."maximum_participants" >= "auctions"."minimum_participants")),
	CONSTRAINT "auctions_hard_stop_after_timer" CHECK ("auctions"."hard_stop_after_seconds" IS NULL OR "auctions"."hard_stop_after_seconds" >= "auctions"."timer_seconds"),
	CONSTRAINT "auctions_recovery_requires_buy_now" CHECK (NOT "auctions"."bid_credit_recovery_enabled" OR "auctions"."buy_now_enabled"),
	CONSTRAINT "auctions_counters_non_negative" CHECK ("auctions"."bid_count" >= 0 AND "auctions"."unique_bidders" >= 0 AND "auctions"."version" >= 1),
	CONSTRAINT "auctions_close_after_start" CHECK ("auctions"."close_at" >= "auctions"."starts_at"),
	CONSTRAINT "auctions_hard_close_bound" CHECK ("auctions"."hard_close_at" IS NULL OR "auctions"."close_at" <= "auctions"."hard_close_at"),
	CONSTRAINT "auctions_price_matches_bids" CHECK ("auctions"."price_minor" = "auctions"."starting_price_minor" + "auctions"."bid_count" * "auctions"."bid_increment_minor"),
	CONSTRAINT "auctions_pause_state" CHECK (("auctions"."status" = 'PAUSED') = ("auctions"."paused_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "autobid_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"max_bids" integer NOT NULL,
	"max_price_minor" integer,
	"bids_placed" integer DEFAULT 0 NOT NULL,
	"status" "autobid_status" DEFAULT 'ACTIVE' NOT NULL,
	"stop_reason" text,
	"last_bid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "autobid_rules_bounds" CHECK ("autobid_rules"."max_bids" BETWEEN 1 AND 500 AND "autobid_rules"."bids_placed" BETWEEN 0 AND "autobid_rules"."max_bids")
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "bid_kind" NOT NULL,
	"price_after_minor" integer NOT NULL,
	"credits_spent" integer NOT NULL,
	"close_at_after" timestamp with time zone NOT NULL,
	"idempotency_key" text,
	"request_id" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_sequence_positive" CHECK ("bids"."sequence" >= 1),
	CONSTRAINT "bids_credits_positive" CHECK ("bids"."credits_spent" >= 1),
	CONSTRAINT "bids_price_non_negative" CHECK ("bids"."price_after_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bid_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"bucket" "credit_bucket" NOT NULL,
	"credits" integer NOT NULL,
	"lot_id" uuid,
	"expires_at" timestamp with time zone,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"idempotency_key" text,
	"purchased_balance_after" integer NOT NULL,
	"promotional_balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bid_ledger_credits_non_zero" CHECK ("bid_ledger_entries"."credits" <> 0),
	CONSTRAINT "bid_ledger_balances_non_negative" CHECK ("bid_ledger_entries"."purchased_balance_after" >= 0 AND "bid_ledger_entries"."promotional_balance_after" >= 0),
	CONSTRAINT "bid_ledger_sign_by_type" CHECK (("bid_ledger_entries"."type" IN ('BID_PACK_PURCHASE', 'PROMOTIONAL_CREDIT', 'BID_REFUND', 'BUY_NOW_RECOVERY') AND "bid_ledger_entries"."credits" > 0)
        OR ("bid_ledger_entries"."type" IN ('AUCTION_BID', 'EXPIRY') AND "bid_ledger_entries"."credits" < 0)
        OR "bid_ledger_entries"."type" = 'ADMIN_ADJUSTMENT'),
	CONSTRAINT "bid_ledger_purchase_bucket" CHECK ("bid_ledger_entries"."type" <> 'BID_PACK_PURCHASE' OR "bid_ledger_entries"."bucket" = 'PURCHASED'),
	CONSTRAINT "bid_ledger_promotional_expiry" CHECK (NOT ("bid_ledger_entries"."bucket" = 'PROMOTIONAL' AND "bid_ledger_entries"."credits" > 0) OR "bid_ledger_entries"."expires_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "bid_package_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" text NOT NULL,
	"credits" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"promo_bonus_credits" integer DEFAULT 0 NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"price_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"promotion_code" text,
	"status" "bid_pack_order_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "bid_package_orders_amounts" CHECK ("bid_package_orders"."price_minor" > 0 AND "bid_package_orders"."discount_minor" >= 0 AND "bid_package_orders"."total_minor" = "bid_package_orders"."price_minor" - "bid_package_orders"."discount_minor" AND "bid_package_orders"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bid_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"badge" text,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bid_packages_values" CHECK ("bid_packages"."credits" > 0 AND "bid_packages"."bonus_credits" >= 0 AND "bid_packages"."price_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "bid_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"purchased_balance" integer DEFAULT 0 NOT NULL,
	"promotional_balance" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bid_wallets_non_negative" CHECK ("bid_wallets"."purchased_balance" >= 0 AND "bid_wallets"."promotional_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_user_id_product_id_pk" PRIMARY KEY("user_id","product_id"),
	CONSTRAINT "cart_items_quantity" CHECK ("cart_items"."quantity" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"note" text,
	"actor" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"brand_name" text NOT NULL,
	"shipping_class" "shipping_class" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"line_total_minor" bigint NOT NULL,
	CONSTRAINT "order_lines_quantity" CHECK ("order_lines"."quantity" >= 1),
	CONSTRAINT "order_lines_total" CHECK ("order_lines"."unit_price_minor" >= 0 AND "order_lines"."line_total_minor" = "order_lines"."unit_price_minor" * "order_lines"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "order_source" NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"recovery_credit_minor" bigint DEFAULT 0 NOT NULL,
	"shipping_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"tax_inclusive" text DEFAULT 'INCLUSIVE' NOT NULL,
	"total_minor" bigint NOT NULL,
	"promotion_code" text,
	"recovery_mode" "recovery_mode",
	"recovery_credits" integer,
	"shipping_method" text DEFAULT 'STANDARD' NOT NULL,
	"shipping_address" jsonb,
	"auction_id" uuid,
	"drop_id" uuid,
	"payment_due_at" timestamp with time zone,
	"tracking_number" text,
	"carrier" text,
	"exception_code" text,
	"exception_message" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_non_negative" CHECK ("orders"."subtotal_minor" >= 0 AND "orders"."discount_minor" >= 0 AND "orders"."recovery_credit_minor" >= 0 AND "orders"."shipping_minor" >= 0 AND "orders"."tax_minor" >= 0 AND "orders"."total_minor" >= 0),
	CONSTRAINT "orders_total_consistent" CHECK ("orders"."total_minor" = "orders"."subtotal_minor" - "orders"."discount_minor" - "orders"."recovery_credit_minor" + "orders"."shipping_minor" + CASE WHEN "orders"."tax_inclusive" = 'EXCLUSIVE' THEN "orders"."tax_minor" ELSE 0 END),
	CONSTRAINT "orders_tax_mode" CHECK ("orders"."tax_inclusive" IN ('INCLUSIVE', 'EXCLUSIVE')),
	CONSTRAINT "orders_auction_source" CHECK ("orders"."source" NOT IN ('AUCTION_WIN', 'AUCTION_BUY_NOW') OR "orders"."auction_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_event_id" text,
	"status" text NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"order_id" uuid,
	"bid_package_order_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"method_label" text,
	"refunded_minor" bigint DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amounts" CHECK ("payments"."amount_minor" > 0 AND "payments"."refunded_minor" BETWEEN 0 AND "payments"."amount_minor"),
	CONSTRAINT "payments_target" CHECK (("payments"."kind" = 'ORDER' AND "payments"."order_id" IS NOT NULL) OR ("payments"."kind" = 'BID_PACK' AND "payments"."bid_package_order_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'PENDING' NOT NULL,
	"provider_reference" text,
	"actor_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"service" text NOT NULL,
	"tracking_number" text NOT NULL,
	"label_url" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flash_drop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flash_drop_purchases_quantity" CHECK ("flash_drop_purchases"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "flash_drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"drop_price_minor" integer NOT NULL,
	"stock_total" integer NOT NULL,
	"stock_sold" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer DEFAULT 1 NOT NULL,
	"minimum_tier" "reward_tier",
	"members_only" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"state" "drop_state" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flash_drops_window" CHECK ("flash_drops"."ends_at" > "flash_drops"."starts_at"),
	CONSTRAINT "flash_drops_stock" CHECK ("flash_drops"."stock_total" > 0 AND "flash_drops"."stock_sold" BETWEEN 0 AND "flash_drops"."stock_total"),
	CONSTRAINT "flash_drops_limits" CHECK ("flash_drops"."per_customer_limit" >= 1 AND "flash_drops"."drop_price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "promotion_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"bid_package_order_id" uuid,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_redemptions_target" CHECK ("promotion_redemptions"."order_id" IS NOT NULL OR "promotion_redemptions"."bid_package_order_id" IS NOT NULL),
	CONSTRAINT "promotion_redemptions_values" CHECK ("promotion_redemptions"."discount_minor" >= 0 AND "promotion_redemptions"."bonus_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "promotion_type" NOT NULL,
	"value" integer NOT NULL,
	"value_kind" text NOT NULL,
	"currency" "currency" DEFAULT 'GBP' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer,
	"minimum_spend_minor" integer,
	"maximum_discount_minor" integer,
	"eligibility" jsonb NOT NULL,
	"status" "promotion_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_window" CHECK ("promotions"."ends_at" > "promotions"."starts_at"),
	CONSTRAINT "promotions_usage" CHECK ("promotions"."usage_count" >= 0 AND ("promotions"."usage_limit" IS NULL OR "promotions"."usage_count" <= "promotions"."usage_limit")),
	CONSTRAINT "promotions_value_kind" CHECK ("promotions"."value_kind" IN ('PERCENT', 'FIXED', 'CREDITS', 'NONE')),
	CONSTRAINT "promotions_percent_range" CHECK ("promotions"."value_kind" <> 'PERCENT' OR "promotions"."value" BETWEEN 1 AND 9000),
	CONSTRAINT "promotions_value_non_negative" CHECK ("promotions"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "achievement_unlocks" (
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "reward_entry_type" NOT NULL,
	"points" integer NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_ledger_points_non_zero" CHECK ("reward_ledger_entries"."points" <> 0),
	CONSTRAINT "reward_ledger_sign_by_type" CHECK (("reward_ledger_entries"."type"::text LIKE 'EARN_%' AND "reward_ledger_entries"."points" > 0) OR ("reward_ledger_entries"."type" IN ('REDEEM', 'EXPIRE') AND "reward_ledger_entries"."points" < 0) OR "reward_ledger_entries"."type" = 'ADJUST')
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author" "message_author" NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_body" CHECK (length("support_messages"."body") BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "ticket_category" NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'NORMAL' NOT NULL,
	"assignee_id" uuid,
	"related_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "watch_target" NOT NULL,
	"target_id" text NOT NULL,
	"price_at_add_minor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"session_id" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"severity" "audit_severity" DEFAULT 'INFO' NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"market_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"risk_class" "risk_class" NOT NULL,
	"recommended_action" "risk_action" NOT NULL,
	"automated_action" "risk_action" NOT NULL,
	"signals" jsonb NOT NULL,
	"status" "fraud_case_status" DEFAULT 'OPEN' NOT NULL,
	"decision_action" text,
	"decision_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fraud_cases_score_range" CHECK ("fraud_cases"."score" BETWEEN 0 AND 100),
	CONSTRAINT "fraud_cases_no_automated_block" CHECK ("fraud_cases"."automated_action" <> 'BLOCK'),
	CONSTRAINT "fraud_cases_decision_note" CHECK ("fraud_cases"."decision_action" IS NULL OR length("fraud_cases"."decision_note") >= 5)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"scope" text NOT NULL,
	"owner_key" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" "idempotency_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_scope_owner_key_key_pk" PRIMARY KEY("scope","owner_key","key")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_change_requests" ADD CONSTRAINT "limit_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsible_use_limits" ADD CONSTRAINT "responsible_use_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_accounts" ADD CONSTRAINT "reward_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_positions" ADD CONSTRAINT "inventory_positions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_transitions" ADD CONSTRAINT "auction_transitions_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autobid_rules" ADD CONSTRAINT "autobid_rules_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autobid_rules" ADD CONSTRAINT "autobid_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_ledger_entries" ADD CONSTRAINT "bid_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_package_orders" ADD CONSTRAINT "bid_package_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_package_orders" ADD CONSTRAINT "bid_package_orders_package_id_bid_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."bid_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_wallets" ADD CONSTRAINT "bid_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_carts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."carts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bid_package_order_id_bid_package_orders_id_fk" FOREIGN KEY ("bid_package_order_id") REFERENCES "public"."bid_package_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_drop_purchases" ADD CONSTRAINT "flash_drop_purchases_drop_id_flash_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."flash_drops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_drop_purchases" ADD CONSTRAINT "flash_drop_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_drops" ADD CONSTRAINT "flash_drops_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger_entries" ADD CONSTRAINT "reward_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_cases" ADD CONSTRAINT "fraud_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_cases" ADD CONSTRAINT "fraud_cases_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default";--> statement-breakpoint
CREATE INDEX "limit_change_requests_pending_idx" ON "limit_change_requests" USING btree ("user_id","effective_at") WHERE "limit_change_requests"."applied_at" IS NULL AND "limit_change_requests"."superseded_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_accounts_referral_code_key" ON "reward_accounts" USING btree ("referral_code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_provider_id_key" ON "users" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_key" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_supplier_idx" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin (to_tsvector('english', "name" || ' ' || "description"));--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_reference_key" ON "purchase_orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_contacts_supplier_idx" ON "supplier_contacts" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "inventory_events_product_idx" ON "inventory_events" USING btree ("product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_events_reference_idx" ON "inventory_events" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "auction_participants_user_idx" ON "auction_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auction_transitions_auction_idx" ON "auction_transitions" USING btree ("auction_id","occurred_at");--> statement-breakpoint
CREATE INDEX "auctions_status_close_idx" ON "auctions" USING btree ("status","close_at");--> statement-breakpoint
CREATE INDEX "auctions_status_starts_idx" ON "auctions" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "auctions_product_idx" ON "auctions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "autobid_rules_one_active" ON "autobid_rules" USING btree ("auction_id","user_id") WHERE "autobid_rules"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "autobid_rules_auction_active_idx" ON "autobid_rules" USING btree ("auction_id") WHERE "autobid_rules"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "bids_auction_sequence_key" ON "bids" USING btree ("auction_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_idempotency_key" ON "bids" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bids_user_idx" ON "bids" USING btree ("user_id","placed_at");--> statement-breakpoint
CREATE INDEX "bid_ledger_user_idx" ON "bid_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bid_ledger_lot_idx" ON "bid_ledger_entries" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "bid_ledger_reference_idx" ON "bid_ledger_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_ledger_idempotency_key" ON "bid_ledger_entries" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_package_orders_reference_key" ON "bid_package_orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_package_orders_idempotency_key" ON "bid_package_orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bid_package_orders_user_idx" ON "bid_package_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_key" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key" ON "orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_win_per_auction" ON "orders" USING btree ("auction_id") WHERE "orders"."source" = 'AUCTION_WIN';--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_key" ON "payment_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_idempotency_key" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_tracking_key" ON "shipments" USING btree ("carrier","tracking_number");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "flash_drop_purchases_user_idx" ON "flash_drop_purchases" USING btree ("drop_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flash_drops_slug_key" ON "flash_drops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "flash_drops_window_idx" ON "flash_drops" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "promotion_redemptions_user_idx" ON "promotion_redemptions" USING btree ("promotion_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions" USING btree (upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "achievement_unlocks_key" ON "achievement_unlocks" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "reward_ledger_user_idx" ON "reward_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_ledger_idempotency_key" ON "reward_ledger_entries" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_reference_key" ON "support_tickets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_unique" ON "watchlist_items" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "watchlist_items_target_idx" ON "watchlist_items" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "fraud_cases_status_idx" ON "fraud_cases" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "fraud_cases_user_idx" ON "fraud_cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");