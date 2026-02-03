# Problem 5: E-Commerce API

A RESTful API for e-commerce operations built with ExpressJS, TypeScript, and PostgreSQL.

## Quick Start with Docker Compose

The easiest way to run the application is with Docker Compose:

```bash
cd src/problem5

# Start services (PostgreSQL + API)
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

The API will be available at http://localhost:3000

## API Documentation

**Live docs**: http://localhost:3000/api-docs (Swagger UI)

See [openapi.yaml](./openapi.yaml) for full OpenAPI 3.0 specification.

### Endpoints

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List users (with filters, pagination) |
| POST | `/users` | Create a user |
| GET | `/users/:id` | Get user details |
| PATCH | `/users/:id` | Update user (partial) |
| DELETE | `/users/:id` | Delete user |

#### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List products (with filters, pagination) |
| POST | `/products` | Create a product |
| GET | `/products/:id` | Get product details |
| PATCH | `/products/:id` | Update product (partial) |
| DELETE | `/products/:id` | Delete product |

#### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | List orders (with filters, pagination) |
| POST | `/orders` | Create an order |
| GET | `/orders/:id` | Get order details |
| PATCH | `/orders/:id` | Update order status/address |
| DELETE | `/orders/:id` | Delete order (pending only) |

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with DB status |
| GET | `/api-docs` | Swagger UI |

### Query Parameters

**Users (GET /users)**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `email` | string | - | Filter by email (partial match) |
| `name` | string | - | Filter by name (partial match) |
| `role` | enum | - | Filter by role: `customer`, `admin` |
| `sortBy` | enum | `createdAt` | Sort field |
| `order` | enum | `desc` | Sort order: `asc`, `desc` |
| `limit` | integer | 100 | Max results (1-1000) |
| `offset` | integer | 0 | Number to skip |

**Products (GET /products)**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | - | Filter by name (partial match) |
| `status` | enum | - | Filter: `draft`, `active`, `archived` |
| `minPrice` | number | - | Minimum price filter |
| `maxPrice` | number | - | Maximum price filter |
| `sortBy` | enum | `createdAt` | Sort field |
| `order` | enum | `desc` | Sort order |
| `limit` | integer | 100 | Max results (1-1000) |
| `offset` | integer | 0 | Number to skip |

**Orders (GET /orders)**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | integer | - | Filter by user ID |
| `status` | enum | - | Filter: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled` |
| `sortBy` | enum | `createdAt` | Sort field |
| `order` | enum | `desc` | Sort order |
| `limit` | integer | 100 | Max results (1-1000) |
| `offset` | integer | 0 | Number to skip |

### Response Format (Paginated Lists)

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### Business Logic

**Order Creation:**
- Validates user exists
- Validates all products exist and are active
- Checks sufficient stock for each item
- Calculates total from current product prices
- Reduces stock for each product

**Order Status Transitions:**
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `shipped`, `cancelled`
- `shipped` → `delivered`
- `delivered` → (terminal)
- `cancelled` → (terminal)

**Stock Management:**
- Stock is reduced when order is created
- Stock is restored when order is cancelled or deleted

## Setup

### Option 1: Docker Compose (Recommended)

Prerequisites:
- Docker & Docker Compose

```bash
# Start in development mode (with hot-reload)
npm run docker:up

# Start in production mode
BUILD_TARGET=production npm run docker:up

# View logs
npm run docker:logs

# Stop and remove containers
npm run docker:down
```

### Option 2: Local Development

Prerequisites:
- Node.js v20+ (for native TypeScript support)
- Docker (for PostgreSQL) or PostgreSQL 16+ installed locally

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
```

**Start PostgreSQL using Docker (recommended):**

```bash
# Start only the database container
docker compose up -d db

# Wait a few seconds for PostgreSQL to be ready, then run migrations
npm run db:migrate

# Start development server (with hot-reload)
npm run dev
```

**Or use an existing PostgreSQL instance:**

Edit `.env` and update `DATABASE_URL` to point to your PostgreSQL server:

```env
DATABASE_URL=postgres://username:password@localhost:5432/your_database
```

Then run migrations and start the server:

```bash
npm run db:migrate
npm run dev
```

Server starts at http://localhost:3000

### Running Tests

With the server running, execute the test script:

```bash
./test-api.sh
```

This runs a comprehensive test suite covering all CRUD operations, validations, and business logic.

## Database Migrations

This project uses Drizzle ORM with the **generate + migrate** workflow, which is ideal for team collaboration.

### Workflow Overview

```
Schema Changes → Generate SQL → Commit → Apply Migrations
```

1. **Schema files** (`src/db/schema/*.ts`) define your database structure in TypeScript
2. **Generate** creates versioned SQL migration files from schema changes
3. **Migration files** are committed to git for team synchronization
4. **Migrate** applies pending migrations to the database

### Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate new migration from schema changes |
| `npm run db:migrate` | Apply all pending migrations |
| `npm run db:studio` | Open Drizzle Studio (visual DB explorer) |

### Development Workflow

**When making schema changes:**

```bash
# 1. Modify schema files in src/db/schema/
#    (e.g., add a new column, create a new table)

# 2. Generate a new migration
npm run db:generate

# 3. Review the generated SQL in drizzle/XXXX_*.sql

# 4. Apply the migration locally
npm run db:migrate

# 5. Commit both schema changes AND migration files
git add src/db/schema/ drizzle/
git commit -m "Add new feature to database schema"
```

**When pulling changes from teammates:**

```bash
# 1. Pull latest changes (includes new migration files)
git pull

# 2. Apply any new migrations
npm run db:migrate
```

### Docker Compose Behavior

When using Docker Compose, migrations are **automatically applied on startup**:

```yaml
command: sh -c "npm run db:migrate && npm run dev"
```

The `drizzle/` directory is mounted into the container, so any new migration files are immediately available.

### Migration Files Structure

```
drizzle/
├── 0000_rapid_naoko.sql      # Initial schema migration
├── 0001_*.sql                # Subsequent migrations...
└── meta/
    ├── _journal.json         # Migration history tracker
    └── 0000_snapshot.json    # Schema snapshots
```

- **SQL files**: Contain the actual DDL statements (CREATE TABLE, ALTER, etc.)
- **meta/_journal.json**: Tracks which migrations have been generated
- **meta/*_snapshot.json**: Schema state snapshots for diffing

> **Important**: Always commit migration files to git. Never modify existing migration files that have been applied—create new migrations instead.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment: `development`, `production`, `test` |
| `CORS_ORIGIN` | No | `*` | Allowed origins (comma-separated or `*`) |
| `RATE_LIMIT_WINDOW_MS` | No | 60000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | 100 | Max requests per window |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run integration tests |
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Open Drizzle Studio (DB explorer) |
| `npm run docker:up` | Start Docker Compose services |
| `npm run docker:down` | Stop Docker Compose services |
| `npm run docker:logs` | Stream container logs |

## Project Structure

```
src/problem5/
├── src/
│   ├── index.ts                    # Entry point with graceful shutdown
│   ├── app.ts                      # Express app with middleware
│   ├── config/
│   │   └── index.ts                # Environment configuration (Zod validated)
│   ├── common/
│   │   ├── errors/
│   │   │   └── index.ts            # Custom error classes
│   │   └── middleware/
│   │       ├── index.ts            # Middleware exports
│   │       ├── errorHandler.ts     # Global error handler
│   │       ├── logger.ts           # Pino structured logger
│   │       └── validate.ts         # Validation middleware
│   ├── db/
│   │   ├── index.ts                # Database connection + health check
│   │   └── schema/
│   │       ├── index.ts            # Schema exports
│   │       ├── users.ts            # Users table schema
│   │       ├── products.ts         # Products table schema
│   │       └── orders.ts           # Orders + OrderItems schemas
│   └── modules/
│       ├── users/                  # User management module
│       │   ├── index.ts
│       │   ├── user.types.ts
│       │   ├── user.schema.ts
│       │   ├── user.repository.ts
│       │   ├── user.service.ts
│       │   ├── user.controller.ts
│       │   └── user.routes.ts
│       ├── products/               # Product catalog module
│       │   ├── index.ts
│       │   ├── product.types.ts
│       │   ├── product.schema.ts
│       │   ├── product.repository.ts
│       │   ├── product.service.ts
│       │   ├── product.controller.ts
│       │   └── product.routes.ts
│       └── orders/                 # Order management module
│           ├── index.ts
│           ├── order.types.ts
│           ├── order.schema.ts
│           ├── order.repository.ts
│           ├── order.service.ts
│           ├── order.controller.ts
│           └── order.routes.ts
├── drizzle/                        # Database migrations
├── openapi.yaml                    # API specification
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Docker Compose configuration
├── package.json
└── tsconfig.json
```

## Architecture Highlights

- **Modular Structure**: Feature-based organization for scalability
- **Layered Architecture**: Controller → Service → Repository pattern
- **Domain Relationships**: Users → Orders → Products with foreign keys
- **Security**: Helmet, CORS, rate limiting, body size limits
- **Validation**: Zod schemas with fail-fast config validation
- **Error Handling**: Custom error classes with global handler
- **Logging**: Pino structured logging with correlation IDs
- **Health Check**: Database connectivity, memory, uptime metrics
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Stock Management**: Automatic stock adjustment on order lifecycle
- **Status Transitions**: Validated order status state machine
- **API Documentation**: Auto-served Swagger UI
- **Docker**: Multi-stage builds for dev/prod

## Tech Stack

- **Runtime**: Node.js v18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (via Drizzle ORM)
- **Validation**: Zod
- **Logging**: Pino
- **Security**: Helmet, CORS, express-rate-limit
- **Documentation**: Swagger UI + OpenAPI 3.0
- **Testing**: Node.js test runner + supertest
- **Containerization**: Docker + Docker Compose
