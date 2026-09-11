-- Glosir initial Supabase schema
-- Run this file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type "Role" as enum ('OWNER', 'ADMIN', 'CASHIER');
create type "ProductStatus" as enum ('ACTIVE', 'DRAFT', 'HIDDEN', 'OUT_OF_STOCK');
create type "TransactionType" as enum ('INCOME', 'EXPENSE', 'TRANSFER', 'DEBT');
create type "OrderType" as enum ('STORE', 'ONLINE', 'WHATSAPP');
create type "OrderStatus" as enum ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED');
create type "ParcelType" as enum ('STANDARD', 'CUSTOM');

create table "User" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "passwordHash" text not null,
  "phone" text,
  "role" "Role" not null default 'CASHIER',
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "Customer" (
  "id" text primary key,
  "name" text not null,
  "phone" text,
  "email" text,
  "address" text,
  "notes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "Category" (
  "id" text primary key,
  "name" text not null,
  "slug" text not null unique,
  "description" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "Product" (
  "id" text primary key,
  "sku" text not null unique,
  "name" text not null,
  "slug" text not null unique,
  "description" text,
  "categoryId" text not null references "Category"("id") on update cascade on delete restrict,
  "imageUrl" text,
  "status" "ProductStatus" not null default 'ACTIVE',
  "isFeatured" boolean not null default false,
  "isParcel" boolean not null default false,
  "stockWarning" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "ProductVariant" (
  "id" text primary key,
  "productId" text not null references "Product"("id") on update cascade on delete cascade,
  "name" text not null,
  "sku" text not null unique,
  "barcode" text unique,
  "basePrice" numeric(12,2) not null,
  "sellPrice" numeric(12,2) not null,
  "stockQty" integer not null default 0,
  "unit" text not null,
  "isDefault" boolean not null default false,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "StockMovement" (
  "id" text primary key,
  "productId" text not null references "Product"("id") on update cascade on delete cascade,
  "variantId" text references "ProductVariant"("id") on update cascade on delete set null,
  "type" text not null,
  "quantity" integer not null,
  "note" text,
  "reference" text,
  "createdAt" timestamptz not null default now()
);

create table "Parcel" (
  "id" text primary key,
  "name" text not null,
  "slug" text not null unique,
  "description" text,
  "type" "ParcelType" not null default 'STANDARD',
  "price" numeric(12,2) not null,
  "imageUrl" text,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "ParcelItem" (
  "id" text primary key,
  "parcelId" text not null references "Parcel"("id") on update cascade on delete cascade,
  "productId" text not null references "Product"("id") on update cascade on delete restrict,
  "quantity" integer not null,
  "notes" text
);

create table "ParcelParticipant" (
  "id" text primary key,
  "customerId" text not null references "Customer"("id") on update cascade on delete cascade,
  "parcelId" text references "Parcel"("id") on update cascade on delete set null,
  "name" text not null,
  "targetAmount" numeric(12,2) not null,
  "contributionAmount" numeric(12,2) not null,
  "frequency" text not null default 'DAILY',
  "startDate" timestamptz not null default now(),
  "endDate" timestamptz,
  "status" text not null default 'ACTIVE',
  "notes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "ParcelProgram" (
  "id" text primary key,
  "name" text not null,
  "year" integer not null,
  "targetAmount" numeric(12,2) not null,
  "isActive" boolean not null default true,
  "notes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("name", "year")
);

create table "ParcelContribution" (
  "id" text primary key,
  "participantId" text not null references "ParcelParticipant"("id") on update cascade on delete cascade,
  "amount" numeric(12,2) not null,
  "paidAt" timestamptz not null default now(),
  "note" text,
  "createdAt" timestamptz not null default now()
);

create table "Order" (
  "id" text primary key,
  "orderNumber" text not null unique,
  "type" "OrderType" not null,
  "status" "OrderStatus" not null default 'PENDING',
  "customerId" text references "Customer"("id") on update cascade on delete set null,
  "userId" text references "User"("id") on update cascade on delete set null,
  "subtotal" numeric(12,2) not null,
  "discount" numeric(12,2) not null default 0,
  "shippingCost" numeric(12,2) not null default 0,
  "total" numeric(12,2) not null,
  "notes" text,
  "whatsappLink" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "OrderItem" (
  "id" text primary key,
  "orderId" text not null references "Order"("id") on update cascade on delete cascade,
  "productId" text references "Product"("id") on update cascade on delete set null,
  "variantId" text references "ProductVariant"("id") on update cascade on delete set null,
  "parcelId" text references "Parcel"("id") on update cascade on delete set null,
  "name" text not null,
  "quantity" integer not null,
  "unitPrice" numeric(12,2) not null,
  "total" numeric(12,2) not null,
  "createdAt" timestamptz not null default now()
);

create table "FinanceTransaction" (
  "id" text primary key,
  "orderId" text references "Order"("id") on update cascade on delete set null,
  "userId" text references "User"("id") on update cascade on delete set null,
  "type" "TransactionType" not null,
  "amount" numeric(12,2) not null,
  "description" text not null,
  "category" text,
  "paymentMethod" text,
  "createdAt" timestamptz not null default now()
);

create table "DebtRecord" (
  "id" text primary key,
  "customerId" text not null references "Customer"("id") on update cascade on delete cascade,
  "amount" numeric(12,2) not null,
  "status" text not null default 'OPEN',
  "dueDate" timestamptz,
  "description" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "PromoCampaign" (
  "id" text primary key,
  "name" text not null,
  "slug" text not null unique,
  "description" text,
  "discountType" text not null default 'PERCENT',
  "discountValue" numeric(12,2) not null,
  "startsAt" timestamptz,
  "endsAt" timestamptz,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "SiteProfile" (
  "id" text primary key default 'main',
  "headline" text not null,
  "story" text not null,
  "photoUrl" text,
  "updatedAt" timestamptz not null default now()
);

create index "Product_categoryId_idx" on "Product"("categoryId");
create index "ProductVariant_productId_idx" on "ProductVariant"("productId");
create index "StockMovement_productId_idx" on "StockMovement"("productId");
create index "StockMovement_variantId_idx" on "StockMovement"("variantId");
create index "ParcelItem_parcelId_idx" on "ParcelItem"("parcelId");
create index "ParcelItem_productId_idx" on "ParcelItem"("productId");
create index "ParcelParticipant_customerId_idx" on "ParcelParticipant"("customerId");
create index "ParcelParticipant_programId_idx" on "ParcelParticipant"("programId");
create index "ParcelParticipant_parcelId_idx" on "ParcelParticipant"("parcelId");
create index "ParcelContribution_participantId_idx" on "ParcelContribution"("participantId");
create index "ParcelContribution_paidAt_idx" on "ParcelContribution"("paidAt");
create index "Order_customerId_idx" on "Order"("customerId");
create index "Order_userId_idx" on "Order"("userId");
create index "OrderItem_orderId_idx" on "OrderItem"("orderId");
create index "OrderItem_productId_idx" on "OrderItem"("productId");
create index "OrderItem_variantId_idx" on "OrderItem"("variantId");
create index "OrderItem_parcelId_idx" on "OrderItem"("parcelId");
create index "FinanceTransaction_orderId_idx" on "FinanceTransaction"("orderId");
create index "FinanceTransaction_userId_idx" on "FinanceTransaction"("userId");
create index "DebtRecord_customerId_idx" on "DebtRecord"("customerId");

-- Keep updatedAt in sync for rows changed directly in Supabase.
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

create trigger user_updated_at before update on "User" for each row execute function set_updated_at();
create trigger customer_updated_at before update on "Customer" for each row execute function set_updated_at();
create trigger category_updated_at before update on "Category" for each row execute function set_updated_at();
create trigger product_updated_at before update on "Product" for each row execute function set_updated_at();
create trigger product_variant_updated_at before update on "ProductVariant" for each row execute function set_updated_at();
create trigger site_profile_updated_at before update on "SiteProfile" for each row execute function set_updated_at();
create trigger parcel_updated_at before update on "Parcel" for each row execute function set_updated_at();
create trigger order_updated_at before update on "Order" for each row execute function set_updated_at();
create trigger promo_campaign_updated_at before update on "PromoCampaign" for each row execute function set_updated_at();
create trigger debt_record_updated_at before update on "DebtRecord" for each row execute function set_updated_at();
