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


<!-- create db -->

sudo -u postgres createdb hotel_management

How to check existing PostgreSQL users
sudo -u postgres psql -c "\du"

Option 3: Explicitly specify a user

If you already have a DB user (e.g. postgres):

createdb -U postgres hotel_management