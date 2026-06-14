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
- Local JSON file storage

## Requirements

- Node.js 20 or newer
- npm

The project currently uses `concurrently@9.x` and an npm override for `shell-quote@1.8.4` so it remains compatible with Node 20 while keeping `npm audit` clean.

## Quick Start

Install dependencies:

```bash
npm install
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

## Data Storage

The backend stores runtime data in:

```text
data/store.json
```

If the file does not exist, the server seeds sample customers, tiers, products, prices, visibility rules, and an empty order list.

The `data/` directory is intended for local runtime data and is not committed to git.

## API Environment

Optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `API_PORT` | `3001` | Express API port |
| `JWT_SECRET` | `local-dev-secret-change-me` | JWT signing secret |

For production-like usage, set a strong `JWT_SECRET`.

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
- Production database persistence.
- Email notifications.
- Role/permission matrix beyond admin and customer.

## Repository

GitHub: https://github.com/nakomi/ml_store
