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

For the backend, set `DATABASE_URL`, `DIRECT_URL`, and a strong `JWT_SECRET`. `DATABASE_URL` should use the Supabase transaction pooler; `DIRECT_URL` should use the direct PostgreSQL connection for Prisma migrations. Never commit real `.env` files or service-role keys.
