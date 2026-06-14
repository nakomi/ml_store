# ML B2B Store

ML B2B Store is a lightweight B2B ordering portal for factory, wholesale, hotel, salon, and OEM customer workflows. It includes a customer-facing catalog and an admin backend for account, product, pricing, visibility, and order review management.

## Features

- Customer login with short login IDs separate from email addresses.
- Customer catalog with product search, category filter, grid view, and fast list view.
- Product detail modal with pack size, MOQ, order increment, and customer-specific pricing.
- Cart checkout with a confirmation step and required terms agreement before order submission.
- Thank-you page with delivery address and delivery details.
- Customer profile fields for tax ID, company name, contact person, delivery address, and delivery notes.
- Admin-only customer account maintenance.
- Admin customer tier management.
- Admin product setup for SKU, name, brand, series, category, image, description, MOQ, order increment, active status, and orderable status.
- Admin price setup for default prices, customer-tier prices, and customer-specific prices.
- Admin visibility rules for all customers, customer tiers, specific customers, and hidden customer exceptions.
- Admin order review with line-item quantity and unit-price revisions, freight, adjustments, notes, revision history, and non-payment status updates.
- Excel XML export for order summaries and order details.

Payment gateway integration is intentionally excluded for now. The current implementation only keeps basic payment status fields and a manual admin mark-paid action.

## Tech Stack

- React 18
- TypeScript
- Vite
- Express
- JSON Web Tokens
- bcryptjs
- PostgreSQL

## Requirements

- Node.js 20 or newer
- npm

The project currently uses `concurrently@9.x` and an npm override for `shell-quote@1.8.4` so it remains compatible with Node 20 while keeping `npm audit` clean.

PostgreSQL can run on the same server as the Node.js app. The API connects through `DATABASE_URL`.

## Quick Start

Install dependencies:

```bash
npm install
```

Create a local PostgreSQL database and user:

```sql
CREATE DATABASE ml_store;
CREATE USER ml_store_user WITH PASSWORD 'change-this-password';
GRANT ALL PRIVILEGES ON DATABASE ml_store TO ml_store_user;
```

For PostgreSQL 15 or newer, also grant schema privileges after connecting to the database:

```sql
\c ml_store
GRANT ALL ON SCHEMA public TO ml_store_user;
```

Create a local `.env` file from the example values:

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your local PostgreSQL connection string:

```text
DATABASE_URL=postgresql://ml_store_user:change-this-password@127.0.0.1:5432/ml_store
```

Run the frontend and API together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:api
npm run dev:web
```

Default local URLs:

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:3001

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Demo Accounts

| Role | Login ID | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Customer | `hotel` | `customer123` |
| Customer | `salon` | `customer123` |

## Database

The backend uses PostgreSQL through the `pg` driver.

On startup, the API creates the required tables if they do not exist:

- `customer_tiers`
- `app_users`
- `products`
- `product_prices`
- `visibility_rules`
- `orders`
- `order_items`
- `order_revisions`
- `payment_records`

If the database is empty, the API seeds demo customers, tiers, products, prices, and visibility rules. If an old local `data/store.json` file exists, it is used as the seed source for the first database initialization.

## API Environment

Optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `API_PORT` | `3001` | Express API port |
| `JWT_SECRET` | `local-dev-secret-change-me` | JWT signing secret |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/ml_store` | PostgreSQL connection string |
| `PG_POOL_MAX` | `10` | Maximum PostgreSQL pool connections |

For production-like usage, set a strong `JWT_SECRET` and a dedicated PostgreSQL user/password.

## Main Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and Vite frontend together |
| `npm run dev:api` | Run Express API with Node watch mode |
| `npm run dev:web` | Run Vite frontend on `127.0.0.1` |
| `npm run build` | Type-check and build frontend assets |
| `npm run preview` | Preview the built frontend |

## Current Scope

Implemented:

- Customer ordering workflow through order submission.
- Admin catalog, price, visibility, account, tier, and order review workflows.
- Order revision and customer acceptance flow.
- Manual order status management for non-payment fulfillment stages.

Not implemented yet:

- Real payment gateway integration.
- Email notifications.
- Role/permission matrix beyond admin and customer.

## Repository

GitHub: https://github.com/nakomi/ml_store
