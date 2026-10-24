ALTER TABLE "products" ADD COLUMN "purchase_price" numeric(14, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "selling_price" numeric(14, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "products" SET "purchase_price" = "price";
