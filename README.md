<!-- # Hotel Management System - Backend API -->

🏨 Hotel Management System - Complete Backend
A production-ready hotel management system built with Node.js, Express, TypeScript, and PostgreSQL (No ORM). Designed for hotels serving 100-200 customers per day.


# Complete Hotel Management System - Full Code

## Project Structure
```
hotel-management-system/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── environment.ts
│   │   └── constants.ts
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_create_users_table.sql
│   │   │   ├── 002_create_tables.sql
│   │   │   ├── 003_create_menu_items.sql
│   │   │   ├── 004_create_orders.sql
│   │   │   ├── 005_create_order_items.sql
│   │   │   └── migration.ts
│   │   └── seeds/
│   │       └── seed.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── auth.types.ts
│   │   ├── menu.types.ts
│   │   ├── order.types.ts
│   │   ├── table.types.ts
│   │   └── analytics.types.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── menu.model.ts
│   │   ├── order.model.ts
│   │   └── table.model.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── menu.controller.ts
│   │   ├── order.controller.ts
│   │   ├── table.controller.ts
│   │   └── analytics.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── menu.service.ts
│   │   ├── order.service.ts
│   │   ├── table.service.ts
│   │   └── analytics.service.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── menu.routes.ts
│   │   ├── order.routes.ts
│   │   ├── table.routes.ts
│   │   └── analytics.routes.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── errorHandler.ts
│   │   ├── validateRequest.ts
│   │   ├── asyncHandler.ts
│   │   ├── rateLimiter.ts
│   │   └── requestLogger.ts
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── menu.validator.ts
│   │   ├── order.validator.ts
│   │   └── table.validator.ts
│   ├── utils/
│   │   ├── ApiResponse.ts
│   │   ├── ApiError.ts
│   │   ├── logger.ts
│   │   ├── helpers.ts
│   │   └── jwt.ts
│   ├── app.ts
│   └── server.ts
├── tests/
├── logs/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── migrate.ts
└── README.md
```

## Database Schema Overview

### Tables:
1. **users** - Authentication and user management
2. **tables** - Restaurant tables
3. **menu_items** - Menu catalog
4. **orders** - Order header
5. **order_items** - Order line items

### Key Concepts:
- **Migrations are SQL files** stored in `src/database/migrations/`
- **Migration tracker** keeps track of applied migrations
- **Each migration is timestamped** and runs in order
- **Rollback support** for development

---

## Complete Implementation

I'll provide the complete code in sections. Save each file in its respective location.

<!-- 📋 Features -->

✅ Authentication & Authorization - JWT-based with role-based access control
✅ Menu Management - Complete CRUD operations for menu items
✅ Order Management - Full order lifecycle with status tracking
✅ Table Management - Track table status and availability
✅ Sales Analytics - Comprehensive reporting and insights
✅ User Management - Multi-role user system (Admin, Manager, Waiter, Chef)
✅ Rate Limiting - Protect against abuse
✅ Migration System - SQL-based database versioning
✅ Database Transactions - Ensure data consistency
✅ Comprehensive Logging - Winston-based logging
✅ Security - Helmet, CORS, bcrypt password hashing

<!-- 🗄️ Database Schema -->
Understanding the Schema System
Unlike Prisma's schema.prisma file, this project uses SQL migration files:

Location: src/database/migrations/*.sql
Each file is a migration that modifies the database
Migrations run in order (numbered: 001, 002, 003, etc.)
Tracking: schema_migrations table tracks which migrations have run

# Database Tables

users - Authentication and user management
tables - Restaurant tables
menu_items - Menu catalog with pricing
orders - Order headers with totals
order_items - Individual items in orders
schema_migrations - Migration tracking


# Key Relationships
users (1) ──→ (many) orders (waiter_id)
tables (1) ──→ (many) orders
orders (1) ──→ (many) order_items
menu_items (1) ──→ (many) order_items

🚀 Quick Start
Prerequisites
bash# Required
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

# Optional
- pgAdmin or any PostgreSQL client
- Postman for API testing


<!-- ## Installation Steps -->

bash# 1. Clone the repository
git clone <your-repo-url>
cd hotel-management-system

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Create PostgreSQL database
createdb hotel_management

use this instead
sudo -u postgres createdb hotel_management

# OR using psql:
psql -U postgres -c "CREATE DATABASE hotel_management;"

# 5. Run migrations
npm run migrate:up

# 6. Seed the database (optional - creates sample data)
npm run seed

# 7. Start development server
npm run dev


<!-- Production Build -->
bash# Build TypeScript
npm run build

# Start production server
npm start


<!-- 📂 Project Structure -->
hotel-management-system/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.ts      # Database connection & query helper
│   │   ├── environment.ts   # Environment variables
│   │   └── constants.ts     # Application constants
│   ├── database/
│   │   ├── migrations/      # SQL migration files (YOUR SCHEMA)
│   │   │   ├── 001_create_users_table.sql
│   │   │   ├── 002_create_tables.sql
│   │   │   ├── 003_create_menu_items.sql
│   │   │   ├── 004_create_orders.sql
│   │   │   └── 005_create_order_items.sql
│   │   └── seeds/           # Database seeding
│   │       └── seed.ts
│   ├── types/               # TypeScript types
│   ├── models/              # Data access layer (SQL queries)
│   ├── services/            # Business logic
│   ├── controllers/         # Request handlers
│   ├── routes/              # API routes
│   ├── middleware/          # Express middleware
│   ├── validators/          # Request validation
│   ├── utils/               # Utilities
│   ├── app.ts              # Express app setup
│   └── server.ts           # Server entry point
├── migrate.ts              # Migration CLI tool
├── .env.example           # Environment template
└── package.json

<!-- 🔧 Working with Migrations -->
Creating a New Migration
When you need to change the database schema:
bash# Create a new migration file
npm run migrate:create add_email_to_orders

# This creates: src/database/migrations/20240101120000_add_email_to_orders.sql
Edit the created SQL file:
sql-- Migration: add email to orders
-- Created: 2024-01-01

ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
Running Migrations
bash# Run all pending migrations
npm run migrate:up

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down

# Example: Adding a New Table

 <!-- Create migration: 006_create_reservations.sql

 Migration: Create reservations table
-- Created: 2024-01-01 -->

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50) NOT NULL,
  table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT reservations_status_check 
    CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled')),
  CONSTRAINT reservations_party_size_check 
    CHECK (party_size > 0 AND party_size <= 50)
);

CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_table_id ON reservations(table_id);

Then run: npm run migrate:up

<!-- 🔐 Authentication & Authorization -->
User Roles
Role            Permissions
admin           Full system access, user management
manager         Orders, menu, analytics, tables
waiter          Create orders, update table status
chef            View orders, update order items status
staff           Basic read access

# Default Credentials (After Seeding)
Admin:    admin@hotel.com / password123
Manager:  manager@hotel.com / password123
Waiter:   waiter@hotel.com / password123
Chef:     chef@hotel.com / password123

# Authentication Flow

Register/Login → Get access token + refresh token
Access Token → Include in Authorization: Bearer <token> header
Refresh Token → Stored in HTTP-only cookie (secure)
Token Expiry → Access: 7 days, Refresh: 30 days


<!-- 📡 API Endpoints -->

Base URL
http://localhost:3000/api/v1

# Authentication (/auth)
bash# Register new user

POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "waiter"
}

# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get current user profile
GET /auth/profile
Headers: Authorization: Bearer <token>

# Refresh access token
POST /auth/refresh
{
  "refreshToken": "<refresh_token>"
}

# Logout
POST /auth/logout
Headers: Authorization: Bearer <token>

# Get all users (Admin only)
GET /auth/users?page=1&limit=10&role=waiter

# Update user (Admin only)
PUT /auth/users/:id
{
  "full_name": "Updated Name",
  "role": "manager",
  "is_active": true
}

# Delete user (Admin only)
DELETE /auth/users/:id
Menu Management (/menu)
bash# Get all menu items (Public)
GET /menu?category=main_course&is_available=true&page=1&limit=10

# Get single menu item (Public)
GET /menu/:id

# Create menu item (Chef/Manager/Admin)
POST /menu
Headers: Authorization: Bearer <token>
{
  "name": "Chicken Tikka",
  "description": "Spicy grilled chicken",
  "category": "main_course",
  "price": 12.99,
  "cost_price": 5.50,
  "preparation_time": 25,
  "is_available": true
}

# Update menu item (Chef/Manager/Admin)
PUT /menu/:id
Headers: Authorization: Bearer <token>
{
  "price": 13.99,
  "is_available": false
}

# Delete menu item (Manager/Admin)
DELETE /menu/:id
Headers: Authorization: Bearer <token>
Table Management (/tables)
bash# All endpoints require authentication

# Get all tables
GET /tables?page=1&limit=10

# Get single table
GET /tables/:id

# Create table (Manager/Admin)
POST /tables
{
  "table_number": "T7",
  "capacity": 4,
  "location": "Patio",
  "status": "available"
}

# Update table (Manager/Admin/Waiter)
PUT /tables/:id
{
  "status": "occupied"
}

# Delete table (Manager/Admin)
DELETE /tables/:id
Order Management (/orders)
bash# All endpoints require authentication

# Create order (Waiter/Manager/Admin)
POST /orders
{
  "table_id": 1,
  "notes": "Extra spicy",
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 2,
      "special_instructions": "No onions"
    },
    {
      "menu_item_id": 3,
      "quantity": 1
    }
  ]
}

# Get all orders
GET /orders?status=pending&table_id=1&page=1&limit=10

# Get single order with items
GET /orders/:id

# Update order status
PUT /orders/:id
{
  "status": "preparing",
  "payment_method": "card",
  "payment_status": "paid"
}

# Delete order (Manager/Admin)
DELETE /orders/:id
Analytics (/analytics)
bash# All endpoints require Manager/Admin role
Headers: Authorization: Bearer <token>

# Get sales analytics
GET /analytics/sales?start_date=2024-01-01&end_date=2024-01-31

# Get top selling items
GET /analytics/top-items?limit=10

# Get daily sales
GET /analytics/daily-sales?start_date=2024-01-01&end_date=2024-01-31

# Get sales by category
GET /analytics/category-sales
Health Check
bashGET /health

<!-- 🔒 Security Features -->

Password Hashing: bcrypt with 10 rounds
JWT Tokens: Secure token-based authentication
Rate Limiting: 100 requests per 15 minutes (general), 5 per 15 minutes (auth)
HTTP-Only Cookies: Refresh tokens stored securely
Helmet: Security headers
CORS: Configurable origin whitelist
Input Validation: Joi-based validation
SQL Injection Protection: Parameterized queries


<!-- 📊 Response Format -->

# Success Response

{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}

# Error Response
{
  "success": false,
  "message": "Error description"
}


# 🧪 Testing with Postman

Import the API into Postman
Create environment variables:

base_url: http://localhost:3000/api/v1
token: (will be set automatically after login)


After login, save the token:

 In Postman Tests tab:
pm.environment.set("token", pm.response.json().data.accessToken);

Use token in requests:

Authorization: Bearer {{token}}


<!-- 📈 Performance Considerations -->

Connection Pooling: Configured for 2-10 concurrent connections
Indexed Queries: All foreign keys and frequently queried columns indexed
Query Optimization: Uses EXPLAIN ANALYZE for complex queries
Transactions: Atomic operations for data consistency
Rate Limiting: Prevents abuse

<!-- 🔄 Common Workflows -->
# Adding a New Feature

Create migration for schema changes
Run migration
Add TypeScript types
Create model (data access)
Create service (business logic)
Create controller (request handling)
Create validator
Add routes
Test endpoints

# Modifying Existing Tables

# 1. Create migration
npm run migrate:create modify_orders_table

# 2. Edit the SQL file
# 3. Run migration
npm run migrate:up

# 4. Update TypeScript types if needed
# 5. Update models/services if needed


<!-- 🐛 Troubleshooting -->
Database Connection Errors
# Check PostgreSQL is running
pg_isready

# Check credentials in .env
cat .env | grep DB_

# Test connection manually
psql -U postgres -d hotel_management

Migration Errors
bash# Check current status
npm run migrate:status

# If stuck, manually fix database then update tracking
psql -U postgres -d hotel_management
DELETE FROM schema_migrations WHERE migration_name = 'problematic_migration.sql';
Port Already in Use
bash# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>


<!-- 📝 Environment Variables -->
See .env.example for all configuration options.
# Key variables:

DB_*: Database connection
JWT_*: Authentication secrets
PORT: Server port
NODE_ENV: development/production
ALLOWED_ORIGINS: CORS whitelist

<!-- 🚢 Deployment -->
# Production Checklist

 Change all default secrets in .env
 Set NODE_ENV=production
 Use strong JWT secrets (32+ characters)
 Configure ALLOWED_ORIGINS properly
 Set up SSL/TLS
 Configure firewall rules
 Set up database backups
 Enable logging to file/service
 Set up monitoring (PM2, New Relic, etc.)

# Using PM2
npm install -g pm2
npm run build
pm2 start dist/server.js --name hotel-api
pm2 save
pm2 startup

📖 API Documentation
Generate API docs using Postman or Swagger (not included but easy to add).
🤝 Contributing

Create feature branch
Make changes
Write/update tests
Submit pull request

📄 License
MIT

Built for production use in hotel/restaurant environments handling 100-200 customers per day.






<!-- first prompting -->

A robust Node.js/Express/TypeScript backend for managing hotel operations including menu management, order processing, table management, and sales analytics.

## 🏗️ Architecture

This project follows a clean **MVC (Model-View-Controller)** architecture with clear separation of concerns:

- **Models**: Database interaction layer
- **Services**: Business logic layer
- **Controllers**: Request/response handling layer
- **Routes**: API endpoint definitions
- **Middleware**: Cross-cutting concerns (validation, error handling, logging)
- **Utils**: Helper functions and utilities



## 🗄️ Database Recommendation: PostgreSQL

### Why PostgreSQL over MySQL?

For a hotel management system, **PostgreSQL is the recommended choice**:

#### Advantages of PostgreSQL:
1. **ACID Compliance**: Superior transaction handling for financial data
2. **JSON Support**: Native JSONB for flexible data storage (useful for order customizations)
3. **Advanced Indexing**: Better performance with complex queries (analytics)
4. **Concurrent Writes**: Better handling of multiple simultaneous orders
5. **Data Integrity**: Stronger constraint enforcement
6. **Extensibility**: Rich extension ecosystem (pg_trgm for search, etc.)
7. **Open Source**: True open-source with no licensing concerns

#### When MySQL might be preferred:
- Simpler read-heavy operations
- Team familiarity with MySQL
- Existing MySQL infrastructure
- Replication needs (MySQL has simpler replication)

## 🔧 ORM Analysis: Prisma vs Alternatives

### Prisma ORM

#### Advantages:
✅ **Type Safety**: Auto-generated TypeScript types  
✅ **Developer Experience**: Intuitive API and excellent tooling  
✅ **Schema Management**: Declarative schema with migrations  
✅ **Query Builder**: Clean, chainable query syntax  
✅ **Performance**: Connection pooling and query optimization  
✅ **Multi-Database**: Easy switching between databases

#### Disadvantages:
❌ **Overhead**: Additional abstraction layer (small performance cost)  
❌ **Bundle Size**: Larger than raw SQL  
❌ **Learning Curve**: New syntax to learn  
❌ **Complex Queries**: Sometimes difficult for very complex SQL  
❌ **Lock-in**: Migrations tied to Prisma format

#### Performance Impact:
- ~5-15% overhead compared to raw SQL
- Minimal in most CRUD operations
- Noticeable in high-frequency, simple queries
- Offset by developer productivity gains

### Alternative: Raw SQL with pg Driver (Current Implementation)

#### Advantages:
✅ **Maximum Performance**: No abstraction overhead  
✅ **Full Control**: Write any SQL query  
✅ **Lightweight**: Minimal dependencies  
✅ **Flexibility**: No ORM constraints  
✅ **Debugging**: See exact SQL being executed

#### Disadvantages:
❌ **Manual Type Definitions**: Must maintain types separately  
❌ **SQL Injection Risk**: Must be careful with parameterization  
❌ **More Boilerplate**: More code for basic operations  
❌ **Migration Management**: Manual migration tracking

## 🎯 Recommendation for This Project

### For Small to Medium Scale (< 1000 concurrent users):
**Use Prisma** - The developer productivity gains outweigh the small performance overhead. Your bottleneck will be business logic, not the ORM.

### For Large Scale (> 1000 concurrent users):
**Use Raw SQL (current implementation)** - Maximum control and performance. The extra boilerplate is worth it when every millisecond counts.

### For Balanced Approach:
**Use Drizzle ORM** - Best of both worlds with ~95% of Prisma's DX and minimal overhead.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repository-url>
cd hotel-management-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your database credentials

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Database Setup

```bash
# Create database
createdb hotel_management

# Tables are automatically created on first run in development mode
# Or run migrations manually:
psql -U postgres -d hotel_management -f src/database/migrations/001_initial.sql
```

## 📡 API Endpoints

### Menu Management
```
POST   /api/v1/menu           - Create menu item
GET    /api/v1/menu           - Get all menu items (with filters)
GET    /api/v1/menu/:id       - Get menu item by ID
PUT    /api/v1/menu/:id       - Update menu item
DELETE /api/v1/menu/:id       - Delete menu item
```

### Table Management
```
POST   /api/v1/tables         - Create table
GET    /api/v1/tables         - Get all tables
GET    /api/v1/tables/:id     - Get table by ID
PUT    /api/v1/tables/:id     - Update table
DELETE /api/v1/tables/:id     - Delete table
```

### Order Management
```
POST   /api/v1/orders         - Create order
GET    /api/v1/orders         - Get all orders (with filters)
GET    /api/v1/orders/:id     - Get order by ID
PUT    /api/v1/orders/:id     - Update order status
DELETE /api/v1/orders/:id     - Delete order
```

### Analytics
```
GET    /api/v1/analytics/sales          - Get sales analytics
GET    /api/v1/analytics/top-items      - Get top-selling items
GET    /api/v1/analytics/daily-sales    - Get daily sales breakdown
GET    /api/v1/analytics/category-sales - Get sales by category
```

### Health Check
```
GET    /api/v1/health         - Server health check
```

## 📝 Example Requests

### Create Menu Item
```json
POST /api/v1/menu
{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with tomatoes and mozzarella",
  "category": "main_course",
  "price": 12.99,
  "preparation_time": 20,
  "is_available": true
}
```

### Create Order
```json
POST /api/v1/orders
{
  "table_id": 1,
  "notes": "Extra cheese on pizza",
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 2,
      "special_instructions": "No olives"
    },
    {
      "menu_item_id": 3,
      "quantity": 1
    }
  ]
}
```

### Update Order Status
```json
PUT /api/v1/orders/1
{
  "status": "preparing"
}
```

## 🛡️ Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error description"
}
```

HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `500`: Internal Server Error


## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🔒 Security Best Practices Implemented

- Helmet for security headers
- CORS configuration
- Input validation with Joi
- SQL injection prevention via parameterized queries
- Request size limits
- Error stack traces only in development

## 📈 Performance Optimizations

- Database connection pooling
- Query result pagination
- Index optimization on frequently queried columns
- Gzip compression
- Async/await for non-blocking operations

## 🔄 Status Transitions

### Order Status Flow
```
pending → preparing → ready → served → completed
        ↘ cancelled
```

### Table Status Options
- `available`: Ready for customers
- `occupied`: Currently in use
- `reserved`: Booked for future use
- `cleaning`: Being cleaned/prepared


**Built with ❤️ using Node.js, Express, TypeScript, and PostgreSQL**


📦 Complete Template Structure
Core Components:

Project Setup - Complete package.json with all dependencies and TypeScript configuration
Configuration Layer - Environment management, constants, and database setup
Utilities - ApiResponse, ApiError, Logger, and helper functions
Type Definitions - Comprehensive TypeScript interfaces for all entities
Database Layer - PostgreSQL setup with connection pooling and SQL migrations
Middleware - Error handling, validation, async wrapper, and request logging
Validators - Joi schemas for all endpoints
Models - Data access layer with raw SQL queries
Services - Business logic layer with validation and error handling
Controllers - Request/response handlers
Routes - All API endpoints properly structured
Application Setup - Express app with security middleware and server initialization