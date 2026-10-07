// PROJECT STRUCTURE
/*
hotel-management-backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── environment.ts
│   │   └── constants.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── menu.types.ts
│   │   ├── order.types.ts
│   │   ├── table.types.ts
│   │   └── analytics.types.ts
│   ├── models/
│   │   ├── menu.model.ts
│   │   ├── order.model.ts
│   │   ├── table.model.ts
│   │   └── orderItem.model.ts
│   ├── controllers/
│   │   ├── menu.controller.ts
│   │   ├── order.controller.ts
│   │   ├── table.controller.ts
│   │   └── analytics.controller.ts
│   ├── services/
│   │   ├── menu.service.ts
│   │   ├── order.service.ts
│   │   ├── table.service.ts
│   │   └── analytics.service.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── menu.routes.ts
│   │   ├── order.routes.ts
│   │   ├── table.routes.ts
│   │   └── analytics.routes.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── validateRequest.ts
│   │   ├── asyncHandler.ts
│   │   └── requestLogger.ts
│   ├── validators/
│   │   ├── menu.validator.ts
│   │   ├── order.validator.ts
│   │   └── table.validator.ts
│   ├── utils/
│   │   ├── ApiResponse.ts
│   │   ├── ApiError.ts
│   │   ├── logger.ts
│   │   └── helpers.ts
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── app.ts
│   └── server.ts
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
*/

// package.json
{
  "name": "hotel-management-backend",
  "version": "1.0.0",
  "description": "Hotel Management System Backend API",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "migrate": "node-pg-migrate",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "typescript": "^5.3.2",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.2",
    "@types/jest": "^29.5.10",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "node-pg-migrate": "^6.2.2"
  }
}

// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}

// .env.example
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_management
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MIN=2
DB_POOL_MAX=10

# Logging
LOG_LEVEL=info