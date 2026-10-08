/**
 * Development seed: a cafe/restaurant with ~90 days of realistic history.
 *
 *   npm run seed                 -> seeds an EMPTY database
 *   npm run seed -- --reset      -> wipes operational data first (users are kept), then seeds
 *   npm run seed -- --days=180   -> history length (default 90)
 *   npm run seed -- --scale=2    -> order volume multiplier (default 1 => ~50-90 orders/day)
 *
 * What you get: users for every role, 12 tables, a ~100 product menu (12 stock-tracked),
 * 11 credit customers with different payment habits (good payers, slow payers, overdue,
 * suspended, closed), daily orders (dine-in / takeaway / delivery / online / credit) with
 * discounts, split payments, refunds, cancellations, invoices, stock purchases / wastage,
 * store income + expenses (rent, salary, utilities...), and live "today" orders in every
 * kitchen status.
 *
 * SAFETY: this script uses its OWN connection (from DB_* in .env, like the app's
 * environment config) and refuses to run against anything that is not localhost, because
 * --reset deletes data. Override with SEED_ALLOW_REMOTE=yes-i-am-sure (do not do this on
 * production).
 *
 * Data is generated with a fixed random seed, so every run produces the same dataset
 * (relative to "today" in Kathmandu).
 */
import bcrypt from "bcryptjs";
import { Pool, PoolClient } from "pg";
import config from "../../config/environment";

// ─────────────────────────────────────────────────────────────────────────────
// Safety guard + connection
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "host.docker.internal"];
const dbHost = config.database.host;
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}
if (!LOCAL_HOSTS.includes(dbHost) && process.env.SEED_ALLOW_REMOTE !== "yes-i-am-sure") {
  console.error(
    `Refusing to seed: DB_HOST is "${dbHost}", not a local database.\n` +
      `This script can wipe data (--reset). Point DB_HOST at your local Postgres, ` +
      `or set SEED_ALLOW_REMOTE=yes-i-am-sure if you really mean it.`
  );
  process.exit(1);
}

const pool = new Pool({
  host: dbHost,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const argNum = (name: string, def: number) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  const n = a ? Number(a.split("=")[1]) : def;
  return Number.isFinite(n) && n > 0 ? n : def;
};
const DAYS = Math.floor(argNum("days", 90));
const SCALE = argNum("scale", 1);

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic random helpers
// ─────────────────────────────────────────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261007);
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
function weighted<T>(items: T[], w: (t: T) => number): T {
  let total = 0;
  const ws = items.map((i) => {
    const x = Math.max(0, w(i));
    total += x;
    return x;
  });
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

// ─────────────────────────────────────────────────────────────────────────────
// Time helpers - everything is generated in Kathmandu wall-clock time (UTC+5:45)
// ─────────────────────────────────────────────────────────────────────────────
const NPT_MS = (5 * 60 + 45) * 60 * 1000;
// SEED_NOW (ISO timestamp) is only for testing the generator at a different time of day.
const NOW_MS = process.env.SEED_NOW ? Date.parse(process.env.SEED_NOW) : Date.now();
const nptNow = new Date(NOW_MS + NPT_MS);
const BY = nptNow.getUTCFullYear();
const BM = nptNow.getUTCMonth();
const BD = nptNow.getUTCDate();
const atNPT = (daysAgo: number, h: number, mi: number, s = 0) =>
  new Date(Date.UTC(BY, BM, BD - daysAgo, h, mi, s) - NPT_MS);
const calOf = (daysAgo: number) => {
  const d = new Date(Date.UTC(BY, BM, BD - daysAgo));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() };
};
const ymd = (d: Date) => new Date(d.getTime() + NPT_MS).toISOString().slice(0, 10);
const ymdCompact = (d: Date) => ymd(d).replace(/-/g, "");
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
const minMs = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);
const NOW = new Date(NOW_MS);

// Nepali fiscal year starts mid-July. Good enough for demo invoices.
function fiscalYearOf(d: Date): string {
  const n = new Date(d.getTime() + NPT_MS);
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth() + 1;
  const bsStart = (m >= 7 ? y : y - 1) + 57; // BS year the fiscal year starts in
  return `${bsStart}/${String(bsStart + 1).slice(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────
const USERS = [
  { email: "admin@hotel.com", full_name: "Admin User", role: "admin", phone: "9800000001" },
  { email: "manager@hotel.com", full_name: "Manager User", role: "manager", phone: "9800000002" },
  { email: "cashier@hotel.com", full_name: "Sunita Karki (Cashier)", role: "staff", phone: "9800000003" },
  { email: "cashier2@hotel.com", full_name: "Prakash Adhikari (Cashier)", role: "staff", phone: "9800000004" },
  { email: "waiter@hotel.com", full_name: "Waiter User", role: "waiter", phone: "9800000005" },
  { email: "waiter2@hotel.com", full_name: "Bishal Magar (Waiter)", role: "waiter", phone: "9800000006" },
  { email: "waiter3@hotel.com", full_name: "Anita Rai (Waiter)", role: "waiter", phone: "9800000007" },
  { email: "chef@hotel.com", full_name: "Chef User", role: "chef", phone: "9800000008" },
];

const TABLES = [
  { n: 1, name: "Mechi", cap: 2, loc: "Window Side" },
  { n: 2, name: "Koshi", cap: 4, loc: "Center" },
  { n: 3, name: "Sagarmatha", cap: 4, loc: "Corner" },
  { n: 4, name: "Janakpur", cap: 6, loc: "Private Room" },
  { n: 5, name: "Bagmati", cap: 2, loc: "Bar Area" },
  { n: 6, name: "Karnali", cap: 8, loc: "Party Section" },
  { n: 7, name: "Gandaki", cap: 4, loc: "Garden" },
  { n: 8, name: "Rapti", cap: 4, loc: "Garden" },
  { n: 9, name: "Phewa", cap: 2, loc: "Balcony" },
  { n: 10, name: "Rara", cap: 6, loc: "Balcony" },
  { n: 11, name: "Langtang", cap: 4, loc: "Center" },
  { n: 12, name: "Annapurna", cap: 10, loc: "Banquet Corner" },
];

const MAIN_CATS = [
  { name: "Beverages", order: 1, desc: "All types of drinks including hot, cold, and alcoholic beverages" },
  { name: "Food", order: 2, desc: "Main course items and meals" },
  { name: "Appetizers", order: 3, desc: "Starters and small bites" },
  { name: "Desserts", order: 4, desc: "Sweet treats and desserts" },
  { name: "Specials", order: 5, desc: "Chef's special and seasonal items" },
];
const SUB_CATS: { name: string; parent: string; order: number; desc: string }[] = [
  { name: "Hot Drinks", parent: "Beverages", order: 1, desc: "Coffee, tea, and other hot beverages" },
  { name: "Cold Drinks", parent: "Beverages", order: 2, desc: "Soft drinks, juices, and iced beverages" },
  { name: "Alcoholic Beverages", parent: "Beverages", order: 3, desc: "Beer, wine, cocktails, and spirits" },
  { name: "Smoothies & Shakes", parent: "Beverages", order: 4, desc: "Blended drinks and milkshakes" },
  { name: "Pizza", parent: "Food", order: 1, desc: "Various pizza options" },
  { name: "Burgers", parent: "Food", order: 2, desc: "Beef, chicken, and veggie burgers" },
  { name: "Pasta", parent: "Food", order: 3, desc: "Italian pasta dishes" },
  { name: "Asian Cuisine", parent: "Food", order: 4, desc: "Chinese, Thai, and Japanese dishes" },
  { name: "Grilled Items", parent: "Food", order: 5, desc: "Grilled meats and vegetables" },
  { name: "Sandwiches & Wraps", parent: "Food", order: 6, desc: "Various sandwiches and wraps" },
  { name: "Momo", parent: "Food", order: 7, desc: "Steamed, fried and jhol momo" },
  { name: "Nepali Khana", parent: "Food", order: 8, desc: "Traditional Nepali meals and snacks" },
  { name: "Soups", parent: "Appetizers", order: 1, desc: "Hot and cold soups" },
  { name: "Salads", parent: "Appetizers", order: 2, desc: "Fresh salads and greens" },
  { name: "Finger Foods", parent: "Appetizers", order: 3, desc: "Wings, nuggets, and fries" },
  { name: "Platters", parent: "Appetizers", order: 4, desc: "Sharing platters and combos" },
  { name: "Ice Cream", parent: "Desserts", order: 1, desc: "Ice cream and frozen desserts" },
  { name: "Cakes & Pastries", parent: "Desserts", order: 2, desc: "Cakes, pastries, and baked goods" },
  { name: "Traditional Sweets", parent: "Desserts", order: 3, desc: "Local and traditional desserts" },
  { name: "Daily Special", parent: "Specials", order: 1, desc: "Today's chef special" },
  { name: "Combo Meals", parent: "Specials", order: 2, desc: "Value combo meals" },
  { name: "Seasonal Items", parent: "Specials", order: 3, desc: "Limited time seasonal offerings" },
];

interface TrackSpec {
  unit: string; // stock_unit enum
  cost: number; // purchase cost per unit
  low: number; // low-stock threshold
  reorder: number; // reorder quantity
  open: number; // opening stock
  supplier: string;
}
interface ProdSpec {
  n: string;
  sub: string;
  price: number;
  dept: "kitchen" | "bar";
  w: number; // popularity weight
  veg?: boolean;
  prep?: number;
  track?: TrackSpec;
  inactive?: boolean;
}
const T = (unit: string, cost: number, low: number, reorder: number, open: number, supplier: string): TrackSpec => ({
  unit, cost, low, reorder, open, supplier,
});
const PRODUCTS: ProdSpec[] = [
  // Momo
  { n: "Veg Steam Momo", sub: "Momo", price: 150, dept: "kitchen", w: 10, veg: true, prep: 12 },
  { n: "Chicken Steam Momo", sub: "Momo", price: 180, dept: "kitchen", w: 14, prep: 12 },
  { n: "Buff Steam Momo", sub: "Momo", price: 160, dept: "kitchen", w: 16, prep: 12 },
  { n: "Chicken Fried Momo", sub: "Momo", price: 210, dept: "kitchen", w: 9, prep: 15 },
  { n: "Buff C Momo", sub: "Momo", price: 230, dept: "kitchen", w: 8, prep: 15 },
  { n: "Chicken Jhol Momo", sub: "Momo", price: 220, dept: "kitchen", w: 8, prep: 14 },
  { n: "Veg Kothey Momo", sub: "Momo", price: 170, dept: "kitchen", w: 4, veg: true, prep: 14 },
  { n: "Paneer Momo", sub: "Momo", price: 200, dept: "kitchen", w: 3, veg: true, prep: 12 },
  // Nepali Khana
  { n: "Veg Thali Set", sub: "Nepali Khana", price: 350, dept: "kitchen", w: 4, veg: true, prep: 20 },
  { n: "Chicken Thali Set", sub: "Nepali Khana", price: 480, dept: "kitchen", w: 5, prep: 22 },
  { n: "Mutton Thali Set", sub: "Nepali Khana", price: 650, dept: "kitchen", w: 3, prep: 25 },
  { n: "Dal Bhat Tarkari", sub: "Nepali Khana", price: 300, dept: "kitchen", w: 3, veg: true, prep: 15 },
  { n: "Sukuti Sadeko", sub: "Nepali Khana", price: 320, dept: "kitchen", w: 4, prep: 15 },
  { n: "Chatamari", sub: "Nepali Khana", price: 220, dept: "kitchen", w: 3, prep: 15 },
  { n: "Sel Roti with Aloo", sub: "Nepali Khana", price: 120, dept: "kitchen", w: 3, veg: true, prep: 10 },
  { n: "Newari Khaja Set", sub: "Nepali Khana", price: 520, dept: "kitchen", w: 2, prep: 20 },
  // Asian
  { n: "Veg Chowmein", sub: "Asian Cuisine", price: 180, dept: "kitchen", w: 6, veg: true, prep: 15 },
  { n: "Chicken Chowmein", sub: "Asian Cuisine", price: 220, dept: "kitchen", w: 9, prep: 15 },
  { n: "Buff Chowmein", sub: "Asian Cuisine", price: 200, dept: "kitchen", w: 6, prep: 15 },
  { n: "Chicken Fried Rice", sub: "Asian Cuisine", price: 260, dept: "kitchen", w: 5, prep: 15 },
  { n: "Veg Thukpa", sub: "Asian Cuisine", price: 200, dept: "kitchen", w: 4, veg: true, prep: 15 },
  { n: "Chicken Thukpa", sub: "Asian Cuisine", price: 250, dept: "kitchen", w: 6, prep: 15 },
  { n: "Chilli Chicken", sub: "Asian Cuisine", price: 320, dept: "kitchen", w: 6, prep: 18 },
  { n: "Chicken Manchurian", sub: "Asian Cuisine", price: 340, dept: "kitchen", w: 3, prep: 18 },
  { n: "Honey Chilli Potato", sub: "Asian Cuisine", price: 220, dept: "kitchen", w: 4, veg: true, prep: 12 },
  // Pizza
  { n: "Margherita Pizza", sub: "Pizza", price: 450, dept: "kitchen", w: 4, veg: true, prep: 20 },
  { n: "Chicken Pizza", sub: "Pizza", price: 550, dept: "kitchen", w: 5, prep: 22 },
  { n: "Pepperoni Pizza", sub: "Pizza", price: 600, dept: "kitchen", w: 4, prep: 22 },
  { n: "Mushroom Pizza", sub: "Pizza", price: 500, dept: "kitchen", w: 2, veg: true, prep: 20 },
  // Burgers
  { n: "Chicken Burger", sub: "Burgers", price: 320, dept: "kitchen", w: 6, prep: 15 },
  { n: "Buff Burger", sub: "Burgers", price: 280, dept: "kitchen", w: 5, prep: 15 },
  { n: "Veg Burger", sub: "Burgers", price: 250, dept: "kitchen", w: 3, veg: true, prep: 12 },
  { n: "Cheese Burger", sub: "Burgers", price: 360, dept: "kitchen", w: 3, prep: 15 },
  // Pasta
  { n: "Chicken Alfredo Pasta", sub: "Pasta", price: 420, dept: "kitchen", w: 3, prep: 18 },
  { n: "Veg Arrabbiata Pasta", sub: "Pasta", price: 380, dept: "kitchen", w: 2, veg: true, prep: 16 },
  { n: "Chicken Carbonara", sub: "Pasta", price: 450, dept: "kitchen", w: 2, prep: 18 },
  // Grilled
  { n: "Grilled Chicken Steak", sub: "Grilled Items", price: 650, dept: "kitchen", w: 3, prep: 25 },
  { n: "Chicken Tikka", sub: "Grilled Items", price: 420, dept: "kitchen", w: 5, prep: 22 },
  { n: "Pork Spare Ribs", sub: "Grilled Items", price: 780, dept: "kitchen", w: 1.5, prep: 30 },
  { n: "Fish Fry", sub: "Grilled Items", price: 560, dept: "kitchen", w: 2, prep: 20 },
  // Sandwiches
  { n: "Club Sandwich", sub: "Sandwiches & Wraps", price: 340, dept: "kitchen", w: 3, prep: 12 },
  { n: "Veg Sandwich", sub: "Sandwiches & Wraps", price: 220, dept: "kitchen", w: 3, veg: true, prep: 10 },
  { n: "Chicken Wrap", sub: "Sandwiches & Wraps", price: 300, dept: "kitchen", w: 3, prep: 12 },
  // Soups / Salads
  { n: "Tomato Soup", sub: "Soups", price: 160, dept: "kitchen", w: 2, veg: true, prep: 8 },
  { n: "Chicken Sweet Corn Soup", sub: "Soups", price: 190, dept: "kitchen", w: 2, prep: 8 },
  { n: "Greek Salad", sub: "Salads", price: 280, dept: "kitchen", w: 1.5, veg: true, prep: 8 },
  { n: "Chicken Caesar Salad", sub: "Salads", price: 360, dept: "kitchen", w: 1.5, prep: 10 },
  // Finger foods / platters
  { n: "French Fries", sub: "Finger Foods", price: 180, dept: "kitchen", w: 10, veg: true, prep: 8 },
  { n: "Chicken Wings", sub: "Finger Foods", price: 380, dept: "kitchen", w: 6, prep: 18 },
  { n: "Chicken Nuggets", sub: "Finger Foods", price: 300, dept: "kitchen", w: 4, prep: 10 },
  { n: "Cheese Balls", sub: "Finger Foods", price: 260, dept: "kitchen", w: 3, veg: true, prep: 10 },
  { n: "Peri Peri Fries", sub: "Finger Foods", price: 220, dept: "kitchen", w: 4, veg: true, prep: 8 },
  { n: "Mixed Platter", sub: "Platters", price: 850, dept: "kitchen", w: 1.5, prep: 25 },
  // Hot drinks
  { n: "Milk Tea", sub: "Hot Drinks", price: 60, dept: "bar", w: 12, veg: true, prep: 4 },
  { n: "Black Tea", sub: "Hot Drinks", price: 50, dept: "bar", w: 5, veg: true, prep: 3 },
  { n: "Masala Tea", sub: "Hot Drinks", price: 80, dept: "bar", w: 7, veg: true, prep: 5 },
  { n: "Americano", sub: "Hot Drinks", price: 150, dept: "bar", w: 5, veg: true, prep: 4 },
  { n: "Cappuccino", sub: "Hot Drinks", price: 190, dept: "bar", w: 8, veg: true, prep: 5 },
  { n: "Cafe Latte", sub: "Hot Drinks", price: 210, dept: "bar", w: 6, veg: true, prep: 5 },
  { n: "Espresso", sub: "Hot Drinks", price: 130, dept: "bar", w: 3, veg: true, prep: 3 },
  { n: "Hot Chocolate", sub: "Hot Drinks", price: 220, dept: "bar", w: 3, veg: true, prep: 5 },
  { n: "Lemon Honey Ginger Tea", sub: "Hot Drinks", price: 120, dept: "bar", w: 3, veg: true, prep: 5 },
  // Cold drinks (some tracked)
  { n: "Coca-Cola 250ml", sub: "Cold Drinks", price: 90, dept: "bar", w: 9, veg: true, prep: 1, track: T("bottle", 52, 24, 96, 144, "Bottlers Nepal Distributor") },
  { n: "Fanta 250ml", sub: "Cold Drinks", price: 90, dept: "bar", w: 4, veg: true, prep: 1, track: T("bottle", 52, 24, 72, 96, "Bottlers Nepal Distributor") },
  { n: "Sprite 250ml", sub: "Cold Drinks", price: 90, dept: "bar", w: 4, veg: true, prep: 1, track: T("bottle", 52, 24, 72, 96, "Bottlers Nepal Distributor") },
  { n: "Mineral Water 1L", sub: "Cold Drinks", price: 60, dept: "bar", w: 8, veg: true, prep: 1, track: T("bottle", 22, 30, 120, 180, "Himalayan Water Co.") },
  { n: "Real Fruit Juice", sub: "Cold Drinks", price: 120, dept: "bar", w: 3, veg: true, prep: 1, track: T("pack", 70, 12, 48, 60, "Kathmandu Wholesale Mart") },
  { n: "Fresh Lime Soda", sub: "Cold Drinks", price: 120, dept: "bar", w: 6, veg: true, prep: 4 },
  { n: "Iced Lemon Tea", sub: "Cold Drinks", price: 150, dept: "bar", w: 4, veg: true, prep: 4 },
  { n: "Virgin Mojito", sub: "Cold Drinks", price: 220, dept: "bar", w: 4, veg: true, prep: 5 },
  { n: "Cold Coffee", sub: "Cold Drinks", price: 240, dept: "bar", w: 6, veg: true, prep: 5 },
  // Shakes
  { n: "Banana Shake", sub: "Smoothies & Shakes", price: 220, dept: "bar", w: 3, veg: true, prep: 5 },
  { n: "Oreo Shake", sub: "Smoothies & Shakes", price: 280, dept: "bar", w: 4, veg: true, prep: 6 },
  { n: "Mango Lassi", sub: "Smoothies & Shakes", price: 180, dept: "bar", w: 5, veg: true, prep: 4 },
  { n: "Sweet Lassi", sub: "Smoothies & Shakes", price: 150, dept: "bar", w: 3, veg: true, prep: 4 },
  { n: "Chocolate Shake", sub: "Smoothies & Shakes", price: 270, dept: "bar", w: 3, veg: true, prep: 6 },
  // Alcohol
  { n: "Gorkha Strong 650ml", sub: "Alcoholic Beverages", price: 650, dept: "bar", w: 5, veg: true, prep: 1, track: T("bottle", 430, 12, 48, 72, "Gorkha Brewery Dealer") },
  { n: "Tuborg Gold 650ml", sub: "Alcoholic Beverages", price: 700, dept: "bar", w: 5, veg: true, prep: 1, track: T("bottle", 470, 12, 48, 72, "Carlsberg Dealer KTM") },
  { n: "Everest Beer 650ml", sub: "Alcoholic Beverages", price: 600, dept: "bar", w: 4, veg: true, prep: 1, track: T("bottle", 400, 12, 48, 60, "Everest Brewery Dealer") },
  { n: "Carlsberg 650ml", sub: "Alcoholic Beverages", price: 750, dept: "bar", w: 4, veg: true, prep: 1, track: T("bottle", 500, 12, 48, 60, "Carlsberg Dealer KTM") },
  { n: "Whisky Peg 30ml", sub: "Alcoholic Beverages", price: 220, dept: "bar", w: 4, veg: true, prep: 1 },
  { n: "House Red Wine (Glass)", sub: "Alcoholic Beverages", price: 380, dept: "bar", w: 1.5, veg: true, prep: 2 },
  { n: "Mojito Cocktail", sub: "Alcoholic Beverages", price: 450, dept: "bar", w: 2, veg: true, prep: 6 },
  { n: "Tongba (Millet Beer)", sub: "Alcoholic Beverages", price: 280, dept: "bar", w: 2.5, veg: true, prep: 6 },
  // Desserts
  { n: "Vanilla Ice Cream Scoop", sub: "Ice Cream", price: 100, dept: "kitchen", w: 3, veg: true, prep: 2 },
  { n: "Chocolate Sundae", sub: "Ice Cream", price: 250, dept: "kitchen", w: 3, veg: true, prep: 5 },
  { n: "Brownie with Ice Cream", sub: "Ice Cream", price: 320, dept: "kitchen", w: 4, veg: true, prep: 8 },
  { n: "Chocolate Cake Slice", sub: "Cakes & Pastries", price: 220, dept: "kitchen", w: 4, veg: true, prep: 2, track: T("piece", 110, 6, 24, 30, "Bakery Corner Supplier") },
  { n: "Cheesecake Slice", sub: "Cakes & Pastries", price: 260, dept: "kitchen", w: 3, veg: true, prep: 2, track: T("piece", 135, 6, 24, 24, "Bakery Corner Supplier") },
  { n: "Chocolate Lava Cake", sub: "Cakes & Pastries", price: 280, dept: "kitchen", w: 2, veg: true, prep: 12 },
  { n: "Juju Dhau", sub: "Traditional Sweets", price: 150, dept: "kitchen", w: 3, veg: true, prep: 2 },
  { n: "Lalmohan (2 pcs)", sub: "Traditional Sweets", price: 120, dept: "kitchen", w: 2, veg: true, prep: 3 },
  { n: "Sikarni", sub: "Traditional Sweets", price: 180, dept: "kitchen", w: 1, veg: true, prep: 3 },
  // Specials
  { n: "Chef's Special Thali", sub: "Daily Special", price: 599, dept: "kitchen", w: 2, prep: 25 },
  { n: "Momo + Coke Combo", sub: "Combo Meals", price: 250, dept: "kitchen", w: 5, prep: 14 },
  { n: "Burger + Fries Combo", sub: "Combo Meals", price: 450, dept: "kitchen", w: 4, prep: 18 },
  { n: "Family Pizza Combo", sub: "Combo Meals", price: 1400, dept: "kitchen", w: 1, prep: 30 },
  { n: "Hot Apple Cider", sub: "Seasonal Items", price: 220, dept: "bar", w: 1, veg: true, prep: 6 },
  { n: "Winter Special Soup (retired)", sub: "Seasonal Items", price: 200, dept: "kitchen", w: 0, prep: 10, inactive: true },
];

const FIRST = ["Ram", "Sita", "Hari", "Gita", "Bikash", "Sunita", "Anil", "Pooja", "Suresh", "Anjali", "Rajan", "Kabita", "Dipesh", "Sabina", "Niraj", "Mina", "Prabin", "Nisha", "Sandeep", "Rojina", "Bibek", "Sarita", "Kiran", "Manisha"];
const LAST = ["Shrestha", "Gurung", "Tamang", "Sharma", "Thapa", "Rai", "Limbu", "Magar", "Karki", "Adhikari", "Poudel", "Basnet", "Bhattarai", "Maharjan", "Khadka", "Neupane"];
const AREAS = ["Thamel", "New Baneshwor", "Lazimpat", "Boudha", "Jhamsikhel", "Kalanki", "Koteshwor", "Baluwatar", "Maharajgunj", "Patan Dhoka", "Sanepa", "Chabahil", "Budhanilkantha", "Kupondole"];
const NOTES = ["Less spicy", "No onion", "Extra sauce", "Serve hot", "No garlic", "Extra spicy", "Pack separately", "Birthday - please bring candle"];
const CANCEL_REASONS = ["Customer left", "Wrong order placed", "Kitchen out of item", "Customer changed mind", "Waiting too long", "Duplicate order"];
const DISCOUNT_REASONS = ["Regular customer", "Staff meal", "Happy hour", "Manager approval", "Birthday", "Complaint compensation"];
const REFUND_REASONS = ["Wrong item served", "Food quality complaint", "Item not available after payment", "Billing error", "Customer cancelled after payment"];
const PHONE = () => `${pick(["980", "981", "984", "985", "986", "974", "975"])}${String(rint(0, 9999999)).padStart(7, "0")}`;
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;

interface CustSpec {
  name: string; phone: string; company?: string; pan?: string; limit: number; terms: number;
  weight: number; startAgo: number; stopChargeAgo?: number; payEvery: number; frac: number;
  stopPayAgo?: number; finalStatus?: "suspended" | "closed"; opening?: number; email?: string;
}
const CREDIT_CUSTOMERS: CustSpec[] = [
  { name: "Himalayan Trekkers Pvt. Ltd.", phone: "9851000001", company: "Himalayan Trekkers Pvt. Ltd.", pan: "602114578", limit: 300000, terms: 30, weight: 6, startAgo: 88, payEvery: 30, frac: 1, email: "accounts@himalayantrek.example" },
  { name: "Sunrise Lodge & Restaurant", phone: "9851000002", company: "Sunrise Lodge", pan: "301778451", limit: 150000, terms: 15, weight: 4, startAgo: 85, payEvery: 14, frac: 1 },
  { name: "Rajesh Shrestha", phone: "9841000003", limit: 25000, terms: 7, weight: 3, startAgo: 80, payEvery: 10, frac: 1 },
  { name: "Sita Gurung", phone: "9841000004", limit: 20000, terms: 15, weight: 2, startAgo: 75, payEvery: 21, frac: 0.6 },
  { name: "Everest Cyber & Print", phone: "9851000005", company: "Everest Cyber & Print", pan: "500233918", limit: 60000, terms: 30, weight: 3, startAgo: 90, payEvery: 35, frac: 0.8 },
  { name: "Namaste Travels & Tours", phone: "9851000006", company: "Namaste Travels & Tours Pvt. Ltd.", pan: "604009231", limit: 120000, terms: 30, weight: 4, startAgo: 70, payEvery: 60, frac: 0.4, opening: 25000 },
  { name: "Dr. Anil Poudel", phone: "9841000007", limit: 40000, terms: 30, weight: 2, startAgo: 60, payEvery: 28, frac: 1 },
  { name: "Green Valley School", phone: "9851000008", company: "Green Valley English School", pan: "302556780", limit: 200000, terms: 45, weight: 3, startAgo: 90, payEvery: 50, frac: 1 },
  { name: "Sagar Thapa", phone: "9841000009", limit: 30000, terms: 15, weight: 2.5, startAgo: 88, stopChargeAgo: 25, payEvery: 30, frac: 0.5, stopPayAgo: 70, finalStatus: "suspended" },
  { name: "Old Friend Bakery", phone: "9851000010", company: "Old Friend Bakery", pan: "500998123", limit: 50000, terms: 30, weight: 2, startAgo: 90, stopChargeAgo: 60, payEvery: 20, frac: 1, finalStatus: "closed" },
  { name: "Bikash Tamang", phone: "9841000011", limit: 10000, terms: 15, weight: 1.5, startAgo: 14, payEvery: 100, frac: 1 },
];
interface Cust extends CustSpec { id: string; balance: number; nextPayAgo: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Seed state
// ─────────────────────────────────────────────────────────────────────────────
interface Prod extends ProdSpec { id: string; stock: number; }
let client: PoolClient;
const U: Record<string, string> = {}; // email -> id
let waiters: string[] = [];
let cashiers: string[] = [];
let manager = "";
let admin = "";
let tableIds: { id: string; cap: number; n: number }[] = [];
let prods: Prod[] = [];
let sellable: Prod[] = [];
let trackedProds: Prod[] = [];
let custs: Cust[] = [];
const counters = { orders: 0, cancelled: 0, open: 0, items: 0, payments: 0, refunds: 0, invoices: 0, creditCharges: 0, creditPayments: 0, purchases: 0, storeTxns: 0 };

const q = async (sql: string, params: any[] = []) => (await client.query(sql, params)).rows;

async function nextOrderNumber(t: Date) {
  const n = (await q(`SELECT nextval('order_number_seq') AS n`))[0].n;
  return `ORD-${ymdCompact(t)}-${String(n).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup (users, tables, categories, products, credit customers)
// ─────────────────────────────────────────────────────────────────────────────
async function resetData() {
  await client.query(
    `TRUNCATE order_refunds, order_payments, credit_transactions, invoice_records, stock_movements,
              order_items, orders, inventory_stock, store_transactions, credit_customers,
              products, tables, categories RESTART IDENTITY CASCADE`
  );
  await client.query(`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
  await client.query(`ALTER SEQUENCE invoice_number_seq RESTART WITH 1`);
}

async function seedUsers() {
  const hash = await bcrypt.hash("password123", 10);
  for (const u of USERS) {
    const r = await q(
      `INSERT INTO users (email, password_hash, full_name, role, phone_number)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
             role = EXCLUDED.role, is_active = true
       RETURNING id`,
      [u.email, hash, u.full_name, u.role, u.phone]
    );
    U[u.email] = r[0].id;
  }
  admin = U["admin@hotel.com"];
  manager = U["manager@hotel.com"];
  waiters = ["waiter@hotel.com", "waiter2@hotel.com", "waiter3@hotel.com"].map((e) => U[e]);
  cashiers = ["cashier@hotel.com", "cashier2@hotel.com"].map((e) => U[e]);
}

async function seedTablesAndMenu() {
  for (const t of TABLES) {
    const r = await q(
      `INSERT INTO tables (table_number, table_name, capacity, location) VALUES ($1,$2,$3,$4) RETURNING id`,
      [t.n, t.name, t.cap, t.loc]
    );
    tableIds.push({ id: r[0].id, cap: t.cap, n: t.n });
  }

  const catId: Record<string, string> = {};
  for (const c of MAIN_CATS) {
    const r = await q(
      `INSERT INTO categories (name, type, parent_id, display_order, description) VALUES ($1,'main',NULL,$2,$3) RETURNING id`,
      [c.name, c.order, c.desc]
    );
    catId[c.name] = r[0].id;
  }
  for (const c of SUB_CATS) {
    const r = await q(
      `INSERT INTO categories (name, type, parent_id, display_order, description) VALUES ($1,'sub',$2,$3,$4) RETURNING id`,
      [c.name, catId[c.parent], c.order, c.desc]
    );
    catId[c.name] = r[0].id;
  }

  const slugs = new Set<string>();
  let order = 0;
  for (const p of PRODUCTS) {
    let slug = p.n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    while (slugs.has(slug)) slug += "-2";
    slugs.add(slug);
    const r = await q(
      `INSERT INTO products
         (name, slug, description, category_id, type, status, selling_price, compare_at_price, prep_time,
          is_vegetarian, featured, is_bestseller, display_order, is_active, department,
          is_inventory_tracked, stock_unit, low_stock_threshold, reorder_quantity)
       VALUES ($1,$2,$3,$4,'simple',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        p.n, slug, `${p.n} - freshly prepared`, catId[p.sub],
        p.inactive ? "inactive" : "active", p.price,
        chance(0.15) ? Math.round(p.price * 1.12 / 10) * 10 : null, p.prep ?? 10,
        !!p.veg, p.w >= 9, p.w >= 12, order++, !p.inactive, p.dept,
        !!p.track, p.track?.unit ?? null, p.track?.low ?? 0, p.track?.reorder ?? 0,
      ]
    );
    prods.push({ ...p, id: r[0].id, stock: 0 });
  }
  sellable = prods.filter((p) => !p.inactive);
  trackedProds = prods.filter((p) => p.track);
}

async function seedCreditCustomers() {
  for (const c of CREDIT_CUSTOMERS) {
    const r = await q(
      `INSERT INTO credit_customers
         (customer_name, customer_phone, customer_email, company_name, pan_number, billing_address,
          credit_limit, payment_terms_days, status, contact_person, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11) RETURNING id`,
      [
        c.name, c.phone, c.email ?? null, c.company ?? null, c.pan ?? null,
        `${pick(AREAS)}, Kathmandu`, c.limit, c.terms,
        c.company ? personName() : null, manager, atNPT(c.startAgo, 10, 0),
      ]
    );
    custs.push({ ...c, id: r[0].id, balance: 0, nextPayAgo: c.startAgo - c.payEvery - rint(0, 6) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store transactions and stock helpers
// ─────────────────────────────────────────────────────────────────────────────
async function storeTxn(
  type: "incoming" | "outgoing", category: string, amount: number, when: Date,
  description: string, method: string | null, party: string | null = null, by = manager
): Promise<string> {
  counters.storeTxns++;
  const r = await q(
    `INSERT INTO store_transactions
       (type, category, amount, description, payment_method, party_name, transaction_date, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7,$7) RETURNING id`,
    [type, category, amount, description, method, party, when, by]
  );
  return r[0].id;
}

async function stockMove(
  p: Prod, type: string, qty: number, when: Date, opts: { orderId?: string; itemId?: string; txn?: string; reason?: string; unitCost?: number; supplier?: string; by?: string } = {}
) {
  await q(
    `INSERT INTO stock_movements
       (product_id, movement_type, quantity, unit_cost, total_cost, order_id, order_item_id, store_txn_id,
        supplier_name, reason, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      p.id, type, qty, opts.unitCost ?? null, opts.unitCost ? r2(opts.unitCost * qty) : null,
      opts.orderId ?? null, opts.itemId ?? null, opts.txn ?? null, opts.supplier ?? null,
      opts.reason ?? null, opts.by ?? manager, when,
    ]
  );
  if (type === "sale" || type === "wastage") p.stock -= qty;
  else p.stock += qty;
}

async function openingStock() {
  const when = atNPT(DAYS + 1, 9, 0);
  for (const p of trackedProds) {
    await q(`INSERT INTO inventory_stock (product_id) VALUES ($1) ON CONFLICT (product_id) DO NOTHING`, [p.id]);
    await stockMove(p, "opening_stock", p.track!.open, when, { reason: "Opening stock count", by: admin });
  }
}

async function purchase(p: Prod, when: Date, qty?: number) {
  const t = p.track!;
  const n = qty ?? t.reorder;
  const cost = r2(t.cost * (0.97 + rnd() * 0.08));
  const txn = await storeTxn("outgoing", "inventory_purchase", r2(cost * n), when, `Stock purchase: ${p.n} x ${n}`, pick(["cash", "fonepay", "connectIPS"]), t.supplier);
  await stockMove(p, "purchase", n, when, { txn, unitCost: cost, supplier: t.supplier });
  counters.purchases++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────
const HOUR_W: Record<number, number> = { 8: 2, 9: 4, 10: 5, 11: 8, 12: 14, 13: 14, 14: 9, 15: 6, 16: 7, 17: 9, 18: 13, 19: 16, 20: 15, 21: 9, 22: 3 };
const DOW_F = [1.05, 0.8, 0.85, 0.9, 1.0, 1.25, 1.35]; // Sun..Sat

function affinity(p: Prod, hour: number, type: string): number {
  let m = p.w;
  const hot = p.sub === "Hot Drinks";
  if (hour < 11) {
    if (hot) m *= 3;
    else if (["Pizza", "Alcoholic Beverages", "Grilled Items", "Platters"].includes(p.sub)) m *= 0.12;
    else if (p.sub === "Momo" || p.sub === "Asian Cuisine") m *= 0.5;
  } else if (hour >= 15 && hour < 18) {
    if (hot || ["Cakes & Pastries", "Finger Foods", "Smoothies & Shakes"].includes(p.sub)) m *= 1.8;
  } else if (hour >= 18) {
    if (p.sub === "Alcoholic Beverages") m *= type === "dine_in" ? 3.5 : 0.25;
    if (p.sub === "Grilled Items" || p.sub === "Pizza") m *= 1.6;
    if (hot) m *= 0.5;
  }
  return m;
}

interface PlannedItem { p: Prod; qty: number; note: string | null }
interface Planned {
  t: Date;
  type: "dine_in" | "takeaway" | "delivery" | "online" | "credit";
  table?: { id: string; cap: number };
  items: PlannedItem[];
  waiter: string;
  cashier: string;
  discount?: { type: "percentage" | "fixed"; value: number; reason: string };
  tax: number;
  svc: number;
  cust?: Cust;
  creditSplit: boolean;
  fate: "completed" | "cancelled" | "open";
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
}

function buildItems(hour: number, type: string): PlannedItem[] {
  const count = weighted([1, 2, 3, 4, 5, 6], (n) => [0, 18, 28, 24, 16, 9, 5][n]);
  const chosen: Prod[] = [];
  for (let i = 0; i < count; i++) {
    const p = weighted(sellable.filter((x) => !chosen.includes(x)), (x) => affinity(x, hour, type));
    chosen.push(p);
  }
  return chosen.map((p) => {
    let qty = weighted([1, 2, 3, 4], (n) => [0, 70, 22, 6, 2][n]);
    if (p.sub === "Alcoholic Beverages" && p.track) qty = weighted([1, 2, 3, 4], (n) => [0, 40, 30, 20, 10][n]);
    if (p.price >= 700) qty = 1;
    return { p, qty, note: chance(0.07) ? pick(NOTES) : null };
  });
}

function planDay(daysAgo: number): Planned[] {
  const cal = calOf(daysAgo);
  const growth = 1 + ((DAYS - daysAgo) / DAYS) * 0.3; // business grows ~30% over the period
  let n = 52 * growth * DOW_F[cal.dow] * (0.85 + rnd() * 0.3) * SCALE;
  if (chance(0.05)) n *= 1.5; // busy day / event
  if (chance(0.03)) n *= 0.5; // slow day
  n = Math.round(n);

  const plans: Planned[] = [];
  const hours = Object.keys(HOUR_W).map(Number);
  for (let i = 0; i < n; i++) {
    const hour = weighted(hours, (h) => HOUR_W[h]);
    let t = atNPT(daysAgo, hour, rint(0, 59), rint(0, 59));
    if (daysAgo === 0 && t.getTime() > NOW_MS - 60000) continue; // nothing in the future
    const type = weighted(["dine_in", "takeaway", "delivery", "online"] as const, (x) => ({ dine_in: 55, takeaway: 28, delivery: 12, online: 5 }[x]));
    const items = buildItems(hour, type);
    const hasPerson = type !== "dine_in" && chance(type === "delivery" ? 1 : 0.4);
    const subtotalEst = items.reduce((s, i) => s + i.p.price * i.qty, 0);
    let discount: Planned["discount"];
    if (chance(0.08)) {
      if (chance(0.55)) discount = { type: "percentage", value: pick([5, 10, 10, 15]), reason: pick(DISCOUNT_REASONS) };
      else discount = { type: "fixed", value: Math.min(pick([50, 100, 100, 200]), Math.floor(subtotalEst * 0.2 / 10) * 10 || 10), reason: pick(DISCOUNT_REASONS) };
    }
    const age = (NOW_MS - t.getTime()) / 60000;
    let fate: Planned["fate"] = "completed";
    if (daysAgo === 0 && age < 90) fate = "open";
    else if (chance(0.04)) fate = "cancelled";
    const table = type === "dine_in" ? pick(tableIds.filter((x) => x.n <= 12)) : undefined;
    plans.push({
      t, type, table, items,
      waiter: pick(waiters), cashier: pick(cashiers),
      discount,
      tax: 13, svc: type === "dine_in" ? 10 : 0,
      cust: undefined, creditSplit: false, fate,
      customerName: hasPerson ? personName() : null,
      customerPhone: hasPerson ? PHONE() : null,
      address: type === "delivery" ? `${pick(AREAS)}, Kathmandu` : null,
    });
  }

  // choose credit customers for ~6% of completed orders
  for (const p of plans) {
    if (p.fate !== "completed" || p.type === "online") continue;
    if (!chance(0.065)) continue;
    const eligible = custs.filter((c) => daysAgo <= c.startAgo && (c.stopChargeAgo === undefined || daysAgo >= c.stopChargeAgo));
    if (!eligible.length) continue;
    p.cust = weighted(eligible, (c) => c.weight);
    p.creditSplit = chance(0.15);
    if (chance(0.3)) {
      p.type = "credit";
      p.table = undefined;
      p.svc = 0;
    }
  }
  return plans.sort((a, b) => a.t.getTime() - b.t.getTime());
}

function estimateTotal(pl: Planned): number {
  const sub = pl.items.reduce((s, i) => s + i.p.price * i.qty, 0);
  let disc = 0;
  if (pl.discount) disc = pl.discount.type === "percentage" ? r2((sub * pl.discount.value) / 100) : pl.discount.value;
  disc = Math.min(disc, sub);
  const after = sub - disc;
  return r2(after + r2((after * pl.tax) / 100) + r2((after * pl.svc) / 100));
}

const GATEWAYS: Record<string, string> = { esewa: "eSewa", khalti: "Khalti", fonepay: "Fonepay", connectIPS: "ConnectIPS", online: "Online" };
let txnSeq = 1;
async function addPayment(orderId: string, method: string, amount: number, when: Date, by: string): Promise<string> {
  const gateway = GATEWAYS[method] ?? null;
  const r = await q(
    `INSERT INTO order_payments
       (order_id, payment_method, amount, transaction_id, reference_number, card_last_4_digits, payment_gateway,
        status, processed_by, payment_date, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9,$9) RETURNING id`,
    [
      orderId, method, amount,
      gateway ? `${method.toUpperCase().slice(0, 3)}${ymdCompact(when)}${String(txnSeq++).padStart(6, "0")}` : null,
      gateway || method === "debit_card" ? `REF${rint(100000, 999999)}` : null,
      method === "debit_card" ? String(rint(1000, 9999)) : null,
      gateway, by, when,
    ]
  );
  counters.payments++;
  return r[0].id;
}

function pickMethod(): string {
  return weighted(["cash", "esewa", "fonepay", "khalti", "debit_card", "connectIPS"], (m) => ({ cash: 45, esewa: 20, fonepay: 15, khalti: 6, debit_card: 5, connectIPS: 2 }[m] as number));
}

async function recalcOrderPaid(orderId: string) {
  await client.query(
    `WITH net AS (
       SELECT COALESCE(SUM(op.amount - COALESCE(r.refunded,0)),0) AS paid
         FROM order_payments op
         LEFT JOIN (SELECT payment_id, SUM(refund_amount) AS refunded FROM order_refunds GROUP BY payment_id) r
           ON r.payment_id = op.id
        WHERE op.order_id = $1 AND op.status = 'completed')
     UPDATE orders o
        SET paid_amount = GREATEST((SELECT paid FROM net),0),
            balance_amount = GREATEST(o.total_amount - (SELECT paid FROM net),0),
            payment_status = (CASE WHEN (SELECT paid FROM net) <= 0 THEN 'unpaid'
                                   WHEN (SELECT paid FROM net) >= o.total_amount THEN 'paid'
                                   ELSE 'partial' END)::payment_status
      WHERE o.id = $1`,
    [orderId]
  );
  await client.query(
    `UPDATE invoice_records i SET paid_amount = o.paid_amount, payment_status = o.payment_status
       FROM orders o WHERE i.order_id = o.id AND i.order_id = $1 AND i.credit_customer_id IS NULL`,
    [orderId]
  );
}

async function creditLedger(c: Cust, type: "charge" | "payment" | "credit_note" | "opening_balance", amount: number, when: Date, o: { orderId?: string; method?: string; note?: string; due?: string; by?: string } = {}): Promise<string> {
  const r = await q(
    `INSERT INTO credit_transactions
       (credit_customer_id, order_id, transaction_type, amount, balance_before, balance_after, payment_method,
        reference_number, due_date, notes, created_by, transaction_date, created_at)
     VALUES ($1,$2,$3,$4,0,0,$5,$6,$7,$8,$9,$10,$10) RETURNING id`,
    [
      c.id, o.orderId ?? null, type, amount, o.method ?? null,
      o.method && o.method !== "cash" ? `REF${rint(100000, 999999)}` : null,
      o.due ?? null, o.note ?? null, o.by ?? pick(cashiers), when,
    ]
  );
  if (type === "charge" || type === "opening_balance") c.balance = r2(c.balance + amount);
  else c.balance = r2(c.balance - amount);
  if (type === "charge") counters.creditCharges++;
  if (type === "payment") counters.creditPayments++;
  return r[0].id;
}

async function ensureStockFor(items: { p: Prod; qty: number }[], when: Date) {
  for (const it of items) {
    if (!it.p.track) continue;
    while (it.p.stock < it.qty) await purchase(it.p, addMin(when, -2 - rint(0, 20)));
  }
}

function itemStatusFor(age: number, fate: string): string {
  if (fate === "completed") return "completed";
  if (age < 10) return "pending";
  if (age < 25) return pick(["confirmed", "preparing"]);
  if (age < 50) return pick(["preparing", "ready"]);
  return "ready";
}

async function processOrder(pl: Planned, openTables: Set<string>) {
  const prepMax = Math.max(...pl.items.map((i) => i.p.prep ?? 10));
  const confirmedAt = addMin(pl.t, 1);
  const age = (NOW_MS - pl.t.getTime()) / 60000;

  // Resolve fate-specific timestamps/status
  let status: string = "completed";
  let servedAt: Date | null = null;
  let completedAt: Date | null = null;
  let cancelledAt: Date | null = null;
  let cancelReason: string | null = null;
  if (pl.fate === "cancelled") {
    status = "cancelled";
    cancelledAt = addMin(pl.t, rint(4, 25));
    cancelReason = pick(CANCEL_REASONS);
  } else if (pl.fate === "open") {
    if (age < 8) status = "pending";
    else if (age < 20) status = pick(["confirmed", "preparing"]);
    else if (age < 40) status = pick(["preparing", "ready"]);
    else status = pl.type === "dine_in" ? "served" : "ready";
    if (status === "served") servedAt = addMin(pl.t, prepMax + 5);
  } else {
    servedAt = addMin(pl.t, prepMax + rint(3, 12));
    const stay = pl.type === "dine_in" ? rint(20, 70) : rint(2, 10);
    completedAt = minMs(addMin(servedAt, stay), addMin(NOW, -1));
  }

  // Credit availability check (needs an estimate of the total)
  let cust = pl.cust;
  if (cust && pl.fate === "completed") {
    const est = estimateTotal(pl);
    if (cust.balance + est + 2 > cust.limit) cust = undefined;
  }

  // Stock must exist before the order is completed
  if (pl.fate === "completed") await ensureStockFor(pl.items, completedAt!);

  const orderNumber = await nextOrderNumber(pl.t);
  const o = (
    await q(
      `INSERT INTO orders
         (order_number, order_type, table_id, customer_name, customer_phone, delivery_address, status,
          created_by, served_by, discount_type, discount_value, discount_reason, tax_percentage,
          service_charge_percentage, special_instructions, order_time, confirmed_at, served_at, completed_at,
          cancelled_at, cancellation_reason, estimated_prep_time, credit_customer_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$16)
       RETURNING id`,
      [
        orderNumber, pl.type, pl.table?.id ?? null, pl.customerName, pl.customerPhone, pl.address, status,
        pl.waiter, servedAt ? pl.waiter : null,
        pl.discount?.type ?? null, pl.discount?.value ?? 0, pl.discount?.reason ?? null,
        pl.tax, pl.svc, chance(0.05) ? pick(NOTES) : null, pl.t, status === "pending" ? null : confirmedAt,
        servedAt, completedAt, cancelledAt, cancelReason, prepMax, cust?.id ?? null,
      ]
    )
  )[0];
  const orderId: string = o.id;
  counters.orders++;

  // Items
  const values: any[] = [];
  const rows = pl.items.map((it, i) => {
    const b = i * 9;
    values.push(orderId, it.p.id, it.p.n, it.p.price, it.qty, it.p.price * it.qty, itemStatusFor(age, pl.fate === "cancelled" ? "open" : pl.fate), it.note, pl.t);
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 4},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
  });
  const itemRows = await q(
    `INSERT INTO order_items
       (order_id, product_id, product_name, product_price, quantity, unit_price, total_price, item_status, special_instructions, ordered_at)
     VALUES ${rows.join(",")} RETURNING id`,
    values
  );
  counters.items += itemRows.length;

  if (pl.fate === "cancelled") {
    counters.cancelled++;
    return;
  }
  if (pl.fate === "open") {
    counters.open++;
    if (pl.table) openTables.add(pl.table.id);
    // a few open orders have been paid/partially paid already
    const total = Number((await q(`SELECT total_amount FROM orders WHERE id=$1`, [orderId]))[0].total_amount);
    if (status === "served" && chance(0.35)) {
      const amt = chance(0.5) ? total : roundTo(total * 0.5, 10);
      if (amt > 0 && amt <= total) await addPayment(orderId, pickMethod(), amt, addMin(NOW, -2), pl.cashier);
    }
    return;
  }

  // Completed: stock deduction at completion time
  for (let i = 0; i < pl.items.length; i++) {
    const it = pl.items[i];
    if (it.p.track) await stockMove(it.p, "sale", it.qty, completedAt!, { orderId, itemId: itemRows[i].id, by: pl.waiter });
  }

  const total = Number((await q(`SELECT total_amount FROM orders WHERE id=$1`, [orderId]))[0].total_amount);
  const payAt = addMin(completedAt!, -rint(0, 3));
  const recent = (NOW_MS - pl.t.getTime()) / 86400000 <= 3;
  const payments: { id: string; method: string; amount: number }[] = [];

  if (cust) {
    let creditAmt = total;
    if (pl.creditSplit) {
      const cashPart = roundTo(total * (0.2 + rnd() * 0.3), 10);
      if (cashPart > 0 && cashPart < total) {
        const m = pickMethod();
        payments.push({ id: await addPayment(orderId, m, cashPart, payAt, pl.cashier), method: m, amount: cashPart });
        creditAmt = r2(total - cashPart);
      }
    }
    const due = ymd(addMin(completedAt!, cust.terms * 1440));
    await addPayment(orderId, "credit", creditAmt, payAt, pl.cashier);
    const chargeId = await creditLedger(cust, "charge", creditAmt, completedAt!, { orderId, due, by: pl.cashier });
    // ~40% of credit sales get a credit invoice (linked to the ledger charge like the app does)
    if (chance(0.4)) await makeInvoice(orderId, pl, completedAt!, cust, due, chargeId);
  } else if (chance(recent ? 0.03 : 0.003)) {
    // completed but customer hasn't paid yet (shows up as outstanding order balance)
    if (chance(0.4)) {
      const part = roundTo(total * 0.4, 10);
      if (part > 0 && part < total) await addPayment(orderId, pickMethod(), part, payAt, pl.cashier);
    }
  } else if (chance(0.05) && total >= 200) {
    // split payment across two methods
    const first = roundTo(total * (0.3 + rnd() * 0.4), 10);
    const m1 = pickMethod();
    let m2 = pickMethod();
    if (m2 === m1) m2 = m1 === "cash" ? "esewa" : "cash";
    if (first > 0 && first < total) {
      payments.push({ id: await addPayment(orderId, m1, first, payAt, pl.cashier), method: m1, amount: first });
      payments.push({ id: await addPayment(orderId, m2, r2(total - first), payAt, pl.cashier), method: m2, amount: r2(total - first) });
    } else {
      payments.push({ id: await addPayment(orderId, m1, total, payAt, pl.cashier), method: m1, amount: total });
    }
  } else {
    const m = pickMethod();
    payments.push({ id: await addPayment(orderId, m, total, payAt, pl.cashier), method: m, amount: total });
  }

  // Refund (non-credit payments): partial or full
  if (payments.length && chance(0.018)) {
    const pay = payments[0];
    const full = chance(0.45);
    const amount = full ? pay.amount : Math.max(10, roundTo(pay.amount * (0.3 + rnd() * 0.4), 10));
    if (amount > 0 && amount <= pay.amount) {
      await q(
        `INSERT INTO order_refunds (order_id, payment_id, refund_amount, refund_method, reason, refunded_by, approved_by, refund_date, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [orderId, pay.id, amount, pay.method, pick(REFUND_REASONS), manager, admin, addMin(payAt, rint(5, 60))]
      );
      if (amount >= pay.amount) await q(`UPDATE order_payments SET status='refunded' WHERE id=$1`, [pay.id]);
      await recalcOrderPaid(orderId);
      counters.refunds++;
    }
  }

  // Invoices for regular (non-credit) sales: ~8%
  if (!cust && chance(0.08)) await makeInvoice(orderId, pl, completedAt!, undefined, undefined, undefined);
}

async function makeInvoice(orderId: string, pl: Planned, when: Date, cust: Cust | undefined, due: string | undefined, chargeId: string | undefined) {
  const od = (await q(`SELECT subtotal, discount_amount, tax_amount, service_charge_amount, total_amount, paid_amount, payment_status FROM orders WHERE id=$1`, [orderId]))[0];
  const fy = fiscalYearOf(when);
  const n = (await q(`SELECT nextval('invoice_number_seq') AS n`))[0].n;
  const b2b = !cust && chance(0.3);
  const r = await q(
    `INSERT INTO invoice_records
       (order_id, credit_customer_id, invoice_number, fiscal_year, invoice_type, invoice_date, due_date, subtotal,
        discount_amount, tax_amount, service_charge_amount, total_amount, pan_number, vat_amount, customer_name,
        customer_phone, customer_pan, payment_status, paid_amount, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'tax_invoice',$5,$6,$7,$8,$9,$10,$11,$12,$9,$13,$14,$15,$16,$17,$18,$5,$5) RETURNING id`,
    [
      orderId, cust?.id ?? null, `INV-${fy.replace("/", "")}-${String(n).padStart(5, "0")}`, fy, when, due ?? null,
      od.subtotal, od.discount_amount, od.tax_amount, od.service_charge_amount, od.total_amount, "601234567",
      cust ? cust.name : b2b ? `${pick(LAST)} Enterprises` : pl.customerName,
      cust ? cust.phone : pl.customerPhone, cust?.pan ?? (b2b ? String(rint(300000000, 699999999)) : null),
      cust ? "unpaid" : od.payment_status, cust ? 0 : od.paid_amount, pl.cashier,
    ]
  );
  counters.invoices++;
  if (chargeId) await client.query(`UPDATE credit_transactions SET invoice_id = $1 WHERE id = $2`, [r[0].id, chargeId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-day background events: customer repayments, store expenses, stock upkeep
// ─────────────────────────────────────────────────────────────────────────────
async function creditRepayments(daysAgo: number, when: Date) {
  for (const c of custs) {
    if (c.opening && daysAgo === c.startAgo) {
      await creditLedger(c, "opening_balance", c.opening, atNPT(daysAgo, 10, 5), { note: "Balance carried forward from paper ledger", by: manager });
    }
    if (c.payEvery >= 100 || (c.stopPayAgo !== undefined && daysAgo < c.stopPayAgo)) continue;
    if (daysAgo > c.nextPayAgo || daysAgo === 0) continue;
    if (daysAgo <= c.nextPayAgo) {
      c.nextPayAgo -= Math.max(5, c.payEvery + rint(-3, 3));
      if (c.balance <= 0) continue;
      let amt = c.frac >= 1 ? c.balance : roundTo(c.balance * (c.frac * (0.8 + rnd() * 0.4)), 100);
      amt = Math.min(amt, c.balance);
      if (amt <= 0) continue;
      await creditLedger(c, "payment", r2(amt), when, { method: pick(["cash", "cash", "esewa", "connectIPS", "fonepay"]), note: c.frac >= 1 ? "Account settlement" : "Part payment", by: pick(cashiers) });
    }
  }
}

async function dailyStore(daysAgo: number) {
  const cal = calOf(daysAgo);
  const at = (h: number, m = 0) => atNPT(daysAgo, h, m);
  if (daysAgo === DAYS) await storeTxn("incoming", "investment", 600000, at(9), "Initial working capital", "connectIPS", "Owner", admin);
  if (cal.d === 1) await storeTxn("outgoing", "rent", 45000, at(11), "Monthly rent", "connectIPS", "Landlord - Mr. Sharma");
  if (cal.d === 3) await storeTxn("outgoing", "utility", rint(6500, 11500), at(12), "Electricity bill (NEA)", "esewa", "Nepal Electricity Authority");
  if (cal.d === 5) await storeTxn("outgoing", "utility", 1800, at(12), "Internet (ISP) monthly", "esewa", "Worldlink");
  if (cal.d === 7) await storeTxn("outgoing", "utility", rint(900, 1400), at(12), "Water tanker + jar water", "cash", "Water supplier");
  if (cal.d === 28) {
    await storeTxn("outgoing", "salary", 85000, at(17), "Kitchen staff salary", "cash", "Kitchen staff");
    await storeTxn("outgoing", "salary", 68000, at(17, 10), "Waiters & cashiers salary", "cash", "Service staff");
    await storeTxn("outgoing", "salary", 42000, at(17, 20), "Manager salary", "connectIPS", "Manager");
  }
  if (cal.d === 12 || cal.d === 24) await storeTxn("outgoing", "marketing", rint(2500, 9000), at(14), "Facebook / Instagram ads", "esewa", "Meta Ads");
  if (cal.dow === 1) await storeTxn("outgoing", "petty_cash", rint(2000, 5000), at(10), "Petty cash for the week", "cash");
  if (daysAgo % 12 === 3) await storeTxn("outgoing", "utility", 1800 * rint(4, 6), at(10, 30), "LPG gas cylinders", "cash", "Gas supplier");
  if (chance(0.04)) await storeTxn("outgoing", "maintenance", rint(1500, 12000), at(15), pick(["AC servicing", "Plumbing repair", "Freezer repair", "Kitchen exhaust cleaning"]), "cash");
  if (daysAgo % 15 === 6) await storeTxn("incoming", "other_income", rint(800, 2500), at(16), "Sale of empty bottles / cartons", "cash");
  // daily market purchase of vegetables, chicken and buff (not tracked as stock)
  if (daysAgo > 0 || NOW_MS > atNPT(0, 10, 0).getTime()) {
    await storeTxn("outgoing", "inventory_purchase", roundTo(rint(6000, 16000) * (0.8 + 0.4 * DOW_F[cal.dow] / 1.35), 50), at(7, 30), "Vegetables, chicken & buff from market", "cash", "Kalimati market vendors");
  }
}

async function dailyStock(daysAgo: number) {
  const cal = calOf(daysAgo);
  const open = atNPT(daysAgo, 7, 45);
  for (const p of trackedProds) {
    if (p.stock <= p.track!.low && daysAgo > 1) await purchase(p, open);
  }
  if (cal.dow === 1 && daysAgo > 2) {
    const p = pick(trackedProds);
    const qty = Math.min(rint(1, 3), Math.floor(p.stock));
    if (qty > 0) await stockMove(p, "wastage", qty, atNPT(daysAgo, 9, 15), { reason: pick(["Breakage", "Expired", "Spillage"]), by: manager });
  }
  if (cal.d === 15 && daysAgo > 2) {
    const p = pick(trackedProds);
    await stockMove(p, "adjustment", chance(0.5) ? rint(1, 3) : -Math.min(rint(1, 3), Math.floor(p.stock)), atNPT(daysAgo, 9, 30), { reason: "Monthly stock count correction", by: manager });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  client = await pool.connect();
  const t0 = Date.now();
  try {
    const existing = (await q(`SELECT (SELECT COUNT(*) FROM orders) AS o, (SELECT COUNT(*) FROM products) AS p, (SELECT COUNT(*) FROM tables) AS t, (SELECT COUNT(*) FROM categories) AS c`))[0];
    const hasData = Number(existing.o) + Number(existing.p) + Number(existing.t) + Number(existing.c) > 0;
    if (hasData && !RESET) {
      console.error(
        `\nThe database "${config.database.name}" already has data (orders: ${existing.o}, products: ${existing.p}, tables: ${existing.t}, categories: ${existing.c}).\n` +
          `Re-run with --reset to wipe orders/products/tables/categories/credit/inventory/store data and seed fresh:\n\n    npm run seed -- --reset\n\n` +
          `(Users are kept; the seed users are upserted.)`
      );
      process.exitCode = 1;
      return;
    }

    console.log(`Seeding "${config.database.name}" on ${dbHost}  |  ${DAYS} days, scale ${SCALE}${RESET ? ", --reset" : ""}`);
    await client.query("BEGIN");
    if (RESET) await resetData();

    await seedUsers();
    await seedTablesAndMenu();
    await seedCreditCustomers();
    await openingStock();
    console.log(`  catalog ready: ${prods.length} products (${trackedProds.length} stock-tracked), ${tableIds.length} tables, ${custs.length} credit customers`);

    const openTables = new Set<string>();
    for (let d = DAYS; d >= 0; d--) {
      await dailyStore(d);
      await dailyStock(d);
      const plans = planDay(d);
      // repayments happen early afternoon; merge them into the day's timeline
      let repaid = false;
      const repayAt = atNPT(d, 14, rint(0, 30));
      for (const pl of plans) {
        if (!repaid && pl.t.getTime() >= repayAt.getTime()) {
          await creditRepayments(d, repayAt);
          repaid = true;
        }
        await processOrder(pl, openTables);
      }
      if (!repaid && (d > 0 || NOW_MS > repayAt.getTime())) await creditRepayments(d, repayAt);
      if (d % 15 === 0) console.log(`  ... ${d} days ago done (orders so far: ${counters.orders})`);
    }

    // Late-stage touches so the UI has interesting states to show
    // 1. low / out-of-stock items
    const lows = trackedProds.filter((p) => p.n.startsWith("Gorkha") || p.n.startsWith("Carlsberg"));
    for (const p of lows) {
      const target = p.n.startsWith("Carlsberg") ? 0 : 5;
      const qty = Math.floor(p.stock - target);
      if (qty > 0) await stockMove(p, "wastage", qty, addMin(NOW, -30), { reason: "Dealer shipment pending - counted down", by: manager });
    }
    // 2. voided store entries
    const v1 = await storeTxn("outgoing", "other_expense", 12000, atNPT(Math.min(40, DAYS), 15, 0), "Duplicate entry - generator service", "cash");
    await q(`UPDATE store_transactions SET status='voided', voided_at=$2, voided_by=$3, void_reason='Entered twice by mistake' WHERE id=$1`, [v1, atNPT(Math.min(40, DAYS), 16, 0), admin]);
    const v2 = await storeTxn("incoming", "other_income", 5000, atNPT(Math.min(15, DAYS), 11, 0), "Wrong amount entered", "cash");
    await q(`UPDATE store_transactions SET status='voided', voided_at=$2, voided_by=$3, void_reason='Incorrect amount' WHERE id=$1`, [v2, atNPT(Math.min(15, DAYS), 12, 0), manager]);
    // 3. customer statuses
    for (const c of custs) {
      if (c.finalStatus === "closed" && c.balance > 0) {
        await creditLedger(c, "payment", c.balance, atNPT(Math.min(20, DAYS), 13, 0), { method: "cash", note: "Final settlement - account closed", by: manager });
      }
      if (c.finalStatus) await q(`UPDATE credit_customers SET status=$2 WHERE id=$1`, [c.id, c.finalStatus]);
    }
    // 4. table states
    await q(`UPDATE tables SET status = 'available'`);
    if (openTables.size) await client.query(`UPDATE tables SET status='occupied' WHERE id = ANY($1::uuid[])`, [Array.from(openTables)]);
    const free = tableIds.filter((t) => !openTables.has(t.id));
    if (free.length > 3) {
      await q(`UPDATE tables SET status='reserved' WHERE id=$1`, [free[0].id]);
      await q(`UPDATE tables SET status='cleaning' WHERE id=$1`, [free[1].id]);
    }

    // Sanity checks: in-memory model vs what the triggers stored
    const bad = await q(
      `SELECT cc.customer_name, cc.current_balance,
              COALESCE((SELECT SUM(CASE WHEN transaction_type IN ('charge','opening_balance','adjustment') THEN amount ELSE -amount END)
                          FROM credit_transactions WHERE credit_customer_id = cc.id),0) AS ledger
         FROM credit_customers cc
        WHERE cc.current_balance <> COALESCE((SELECT SUM(CASE WHEN transaction_type IN ('charge','opening_balance','adjustment') THEN amount ELSE -amount END)
                          FROM credit_transactions WHERE credit_customer_id = cc.id),0)`
    );
    if (bad.length) throw new Error("Credit balance mismatch after seeding: " + JSON.stringify(bad));
    const negStock = await q(`SELECT product_id FROM inventory_stock WHERE current_stock < 0`);
    if (negStock.length) throw new Error("Negative stock after seeding");

    await client.query("COMMIT");

    const sum = (
      await q(
        `SELECT
           (SELECT COUNT(*) FROM orders WHERE status='completed') AS completed,
           (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='completed') AS revenue,
           (SELECT COUNT(*) FROM orders WHERE status NOT IN ('completed','cancelled')) AS open_orders,
           (SELECT COALESCE(SUM(current_balance),0) FROM credit_customers) AS credit_outstanding,
           (SELECT COUNT(*) FROM credit_customers WHERE current_balance > 0) AS credit_customers_owing`
      )
    )[0];
    console.log(`\n✓ Seeding finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(
      `  orders: ${counters.orders} (cancelled ${counters.cancelled}, open now ${counters.open}) | items: ${counters.items} | payments: ${counters.payments} | refunds: ${counters.refunds} | invoices: ${counters.invoices}`
    );
    console.log(
      `  credit: ${counters.creditCharges} charges, ${counters.creditPayments} repayments, outstanding Rs. ${Number(sum.credit_outstanding).toLocaleString("en-IN")} across ${sum.credit_customers_owing} customers`
    );
    console.log(`  stock purchases: ${counters.purchases} | store transactions: ${counters.storeTxns} | completed revenue: Rs. ${Number(sum.revenue).toLocaleString("en-IN")}`);
    console.log("\nLogins (password for all: password123)");
    for (const u of USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
    console.log("\nTip: the cashier@hotel.com / manager@hotel.com / admin@hotel.com logins can take payments; waiters cannot.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("\nSeeding failed - nothing was changed.\n", e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
