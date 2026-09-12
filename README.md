# Glosir E-Commerce Platform

A large-scale commerce system for Glosir + Parcel commerce with WhatsApp ordering flow.

## Tech Stack
- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- Auth: JWT + role-based access
- Payment: midtrans/other provider optional
- Messaging: WhatsApp API integration
- Monorepo-style structure in a single workspace

## Project Structure

```text
Glosir/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/config, middleware, services, routes/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/components, context, pages, services, styles, utils/
│   ├── .env.example
│   └── package.json
├── README.md
└── struktur.md
```

## Core Architecture

### 1. Backend API
- REST API for products, catalog, orders, parcel bundles, finance, and admin.
- Role-based access for owner and cashier.
- One database source for products, stock, sales, and finance.

### 2. Frontend Store
- Public storefront for Glosir and Parcel categories.
- Cart and checkout logic built for direct WhatsApp ordering.
- Admin dashboard for management and reporting.

### 3. WhatsApp Ordering System
- Customers add items to cart.
- User clicks order via WhatsApp.
- Backend generates message template with product list, customer data, and total.
- Order later confirmed into internal system and stock/finance update.

### 4. Finance Sync
- Cashier sales, online order confirmations, and expenditures sync into one finance ledger.
- Owner can review profit, debt, and savings targets.

## Recommended Development Phases

1. Setup backend + database
2. Build product catalog and stock management
3. Build cashier and POS flow
4. Build storefront and cart
5. Build WhatsApp order automation
6. Integrate finance and admin dashboard
7. Add promotions, reports, and optimization

## Notes

This is the initial project blueprint. It is meant to be expanded into a production-grade commerce system with a real database schema, user roles, API validations, and operational flows.

## Environment and Hosting

Set `VITE_API_URL` in the frontend environment. Use `http://127.0.0.1:5000/api` for local development and the deployed API URL, such as `https://api.example.com/api`, in Vercel/Netlify environment settings.
Set `VITE_STORE_WHATSAPP_NUMBER` to the store's customer-order number in international format (`62...`, without `+`, spaces, or a leading `0`). Keep it separate from `VITE_SUPPORT_WHATSAPP_NUMBER`.

For the backend, set `DATABASE_URL`, `DIRECT_URL`, and a strong `JWT_SECRET`. `DATABASE_URL` should use the Supabase transaction pooler; `DIRECT_URL` should use the direct PostgreSQL connection for Prisma migrations. Never commit real `.env` files or service-role keys.

## Implemented Controls

- JWT sessions expire after 8 hours and automatically redirect to login when expired or rejected.
- API requests use `VITE_API_URL`, and backend CORS is restricted by `FRONTEND_URL`.
- Customer loyalty points are stored in `Customer.points`, separate from notes.
- Finance and debt deletion uses soft-delete (`deletedAt`).
- Stock opname, price/stock audit logs, and event package APIs are available to authenticated staff/admin users.
- Admin routes: `/admin/stock-opname` and `/admin/event-packages`; public catalog: `/paket-acara`.
- Optional nightly WhatsApp recap uses Fonnte when `ENABLE_NIGHTLY_RECAP=true`, `FONNTE_API_KEY`, and `OWNER_WHATSAPP_NUMBER` are configured.
- WhatsApp owner commands are available at `POST /api/whatsapp/webhook`; configure the owner whitelist and optional `WHATSAPP_WEBHOOK_SECRET` before connecting a provider.
- Customer WhatsApp commands: `cek pesanan`, `status`, and `lacak [nomor order]`. Status notifications are sent after admin updates an order through `PATCH /api/orders/:id/status`.
- Parsel now uses `ProductVariant` contents, supports automatic/manual pricing, shows contents publicly, and deducts component stock during POS checkout.

WhatsApp provider integration, error monitoring, and scheduled database backups still require deployment-specific credentials and infrastructure.
