CREATE TYPE "public"."booking_source" AS ENUM('direct', 'whatsapp', 'phone', 'walk_in', 'channel');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'checked_in', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."guest_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'preparing', 'served', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."room_entry_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_phone" text,
	"guest_country" text,
	"identity_number" text,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"source" "booking_source" DEFAULT 'direct' NOT NULL,
	"rate_npr" integer DEFAULT 0 NOT NULL,
	"total_npr" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"room_entry_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"guest_name" text,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"status" "guest_status" DEFAULT 'open' NOT NULL,
	"booking_id" uuid,
	"room_entry_id" integer,
	"notes" text,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hotels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer NOT NULL,
	"hotel_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_npr" integer DEFAULT 0 NOT NULL,
	"total_npr" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer,
	"customer_name" text NOT NULL,
	"room_id" uuid NOT NULL,
	"status" "room_entry_status" DEFAULT 'open' NOT NULL,
	"check_in_date" timestamp DEFAULT now() NOT NULL,
	"identity_number" text,
	"number_of_guest" integer DEFAULT 1 NOT NULL,
	"mobile_number" text,
	"males_count" integer DEFAULT 0 NOT NULL,
	"females_count" integer DEFAULT 0 NOT NULL,
	"purpose" varchar(255),
	"signature" text,
	"check_out_date" timestamp,
	"room_rate" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"seats" integer DEFAULT 2 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_entries" ADD CONSTRAINT "room_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_room_dates_idx" ON "bookings" USING btree (room_id,check_in,check_out);--> statement-breakpoint
CREATE INDEX "bookings_hotel_status_idx" ON "bookings" USING btree (hotel_id,status);--> statement-breakpoint
CREATE INDEX "bookings_hotel_checkin_idx" ON "bookings" USING btree (hotel_id,check_in);--> statement-breakpoint
CREATE UNIQUE INDEX "guests_one_open_per_table" ON "guests" USING btree (table_id) WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "guests_hotel_status_idx" ON "guests" USING btree (hotel_id,status);--> statement-breakpoint
CREATE INDEX "guests_table_id_idx" ON "guests" USING btree (table_id);--> statement-breakpoint
CREATE INDEX "guests_booking_id_idx" ON "guests" USING btree (booking_id);--> statement-breakpoint
CREATE INDEX "guests_room_entry_id_idx" ON "guests" USING btree (room_entry_id);--> statement-breakpoint
CREATE INDEX "orders_guest_id_idx" ON "orders" USING btree (guest_id);--> statement-breakpoint
CREATE INDEX "orders_hotel_status_idx" ON "orders" USING btree (hotel_id,status);--> statement-breakpoint
CREATE UNIQUE INDEX "room_entries_one_open_per_room" ON "room_entries" USING btree (room_id) WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "room_entries_status_idx" ON "room_entries" USING btree (status);