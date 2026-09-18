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

Runtime dependencies are kept separate from development-only build and inventory conversion tools. Run `npm audit` to check the complete dependency tree.

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

On Windows, the repository can also start its bundled local PostgreSQL instance before launching both services:

```bash
npm run dev:all
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

Run the server and frontend unit tests:

```bash
npm test
```

Preview the production build:

```bash
npm run preview
```

## Development Demo Accounts

These accounts are created only when a non-production database is initialized. Production never seeds these credentials.

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

If a non-production database is empty, the API seeds demo customers, tiers, products, prices, and visibility rules. If an old local `data/store.json` file exists, it is used as the seed source for the first database initialization.

Startup migrations are applied automatically. Existing text-based order and revision timestamps are converted to PostgreSQL `TIMESTAMPTZ`, and order idempotency and lookup indexes are created. Back up the production database before deploying a version that introduces schema changes.

## API Environment

Optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `API_PORT` | `3001` | Express API port |
| `JWT_SECRET` | `local-dev-secret-change-me` | JWT signing secret; production requires at least 32 characters |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/ml_store` | PostgreSQL connection string |
| `PG_POOL_MAX` | `10` | Maximum PostgreSQL pool connections |
| `TRUST_PROXY_HOPS` | `0` | Number of trusted reverse-proxy hops for correct login rate limiting |
| `INITIAL_ADMIN_LOGIN_ID` | `admin` | Initial production admin login ID when the database is empty |
| `INITIAL_ADMIN_PASSWORD` | none | Required initial production admin password; minimum 12 characters |
| `INITIAL_ADMIN_NAME` | `系統管理員` | Initial production admin display name |
| `INITIAL_ADMIN_EMAIL` | empty | Initial production admin email |

Production refuses to start with the development JWT secret or a secret shorter than 32 characters. An empty production database also requires `INITIAL_ADMIN_PASSWORD`; demo users and demo products are seeded only outside production. Use a dedicated PostgreSQL user/password and set `TRUST_PROXY_HOPS` when the app runs behind a reverse proxy.

## Main Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and Vite frontend together |
| `npm run dev:all` | Start the bundled Windows PostgreSQL instance, then run API and frontend |
| `npm run dev:api` | Run Express API with Node watch mode |
| `npm run dev:web` | Run Vite frontend on `127.0.0.1` |
| `npm test` | Run all server and frontend unit tests |
| `npm run test:server` | Run server unit tests |
| `npm run test:web` | Run frontend unit tests |
| `npm run build` | Type-check and build frontend assets |
| `npm run preview` | Preview the built frontend |
| `npm audit` | Check runtime and development dependencies for known vulnerabilities |

## Security Notes

- Customer bootstrap responses contain only products visible to the signed-in customer and only that customer's effective prices and orders.
- Login attempts are rate-limited. Configure `TRUST_PROXY_HOPS` correctly when a trusted reverse proxy is in front of the API.
- Production requires a non-default `JWT_SECRET` and an initial administrator password of at least 12 characters for an empty database.
- Order submission requires an idempotency key so retries cannot create duplicate orders.
- Product inventory imports accept only `.xls` and `.xlsx` files up to 25 MB. The converter uses the current SheetJS distribution from the official SheetJS CDN.

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
