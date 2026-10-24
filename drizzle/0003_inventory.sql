CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(20) NOT NULL,
	"address" text,
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"sku" varchar(60),
	"category" varchar(80),
	"unit" varchar(20) DEFAULT 'pcs' NOT NULL,
	"price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"min_stock" numeric(14, 2) DEFAULT 0 NOT NULL,
	"current_stock" numeric(14, 2) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"movement_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"is_void" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_store_name_idx" ON "products" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_sku_unique" ON "products" USING btree ("store_id","sku");--> statement-breakpoint
CREATE INDEX "stock_movements_store_date_idx" ON "stock_movements" USING btree ("store_id","movement_date" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id","created_at" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "stores" ("name", "code") VALUES
	('Toko Pupuk', 'PPK'),
	('Toko Bangunan', 'BGN'),
	('Toko ATK', 'ATK'),
	('Toko Listrik', 'LSK'),
	('Toko Furniture', 'FRN')
ON CONFLICT ("code") DO NOTHING;
