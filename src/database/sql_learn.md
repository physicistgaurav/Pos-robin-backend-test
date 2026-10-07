🟢 SELECT (READ)
SELECT * FROM users;
SELECT id, email FROM users;
SELECT * FROM users WHERE id = $1;


With pagination:

SELECT * FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

INSERT (CREATE)
INSERT INTO users (email, password, full_name)
VALUES ($1, $2, $3)
RETURNING *;

UPDATE
UPDATE users
SET full_name = $1,
    role = $2
WHERE id = $3
RETURNING *;

DELETE
DELETE FROM users
WHERE id = $1;

WHERE (Filtering)
WHERE email = $1
WHERE role IN ('admin', 'staff')
WHERE created_at >= NOW() - INTERVAL '7 days'


JOIN (Very Important)
SELECT u.id, u.email, p.bio
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.id = $1;

Transactions (Critical for APIs)
BEGIN;
INSERT ...
UPDATE ...
COMMIT;
-- or ROLLBACK

7️⃣ Best Practices When Using Raw SQL in APIs
✅ Always use parameterized queries

Never interpolate values.

✅ Lowercase / normalize inputs (like email)
email.toLowerCase()

✅ Use RETURNING *

Saves extra SELECT queries.

✅ Keep SQL in repositories

Not in controllers.

8️⃣ When Raw SQL Is BETTER Than Prisma

Complex joins

Heavy reporting queries

Performance-critical paths

Full control over execution plans

Many senior devs use Prisma + raw SQL together.

🧠 Mental Model to Remember

$1 is NOT weird — it’s Prisma’s { email }, just explicit.