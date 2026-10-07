import { Request, Response, NextFunction, RequestHandler } from "express";

// Your function wraps async route handlers and automatically forwards errors to Express’s error middleware.

export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 🧩 How It Works Visually
// Request
//   ↓
// asyncHandler
//   ↓
// Your async controller
//   ↓
// Error?
//   ↓
// next(error)
//   ↓
// Global error middleware

// ✅ How to Use It
// Before ❌
// router.get(
//   "/users/:id",
//   async (req, res, next) => {
//     try {
//       const user = await findUser(req.params.id);
//       res.json(user);
//     } catch (err) {
//       next(err);
//     }
//   }
// );

// After ✅
// router.get(
//   "/users/:id",
//   asyncHandler(async (req, res) => {
//     const user = await findUser(req.params.id);
//     res.json(user);
//   })
// );

// ✔ No try/catch
// ✔ Cleaner controllers
// ✔ Centralized error handling
