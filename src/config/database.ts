import { Pool, PoolClient, QueryResult } from "pg";
import config from "./environment";
import { logger } from "../utils/logger";

const poolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// for running railway
// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
// });

// console.log(poolConfig)
export const pool = new Pool(poolConfig);

pool.on("connect", () => {
  logger.info("Database connection established");
});

pool.on("error", (err) => {
  logger.error(`Unexpected database error: ${err.message}`);
});

// for Single SQL statement with Centralized logging
export const query = async (
  text: string,
  params?: any[]
): Promise<QueryResult> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`);
    return result;
  } catch (error) {
    logger.error(`Query error: ${error}`);
    throw error;
  }
};

// usage
// const users = await query(
//   "SELECT * FROM users WHERE is_active = $1",
//   [true]
// );

// Rare / advanced cases ==> Gives you a dedicated client
// ⚠️ Must always be released
export const getClient = async () => {
  return await pool.connect();
};

// Multiple dependent queries
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// usage
// await transaction(async (client) => {
//   await client.query(
//     "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
//     [email, hash]
//   );

//   await client.query(
//     "INSERT INTO audit_logs (action) VALUES ($1)",
//     ["USER_CREATED"]
//   );
// });
