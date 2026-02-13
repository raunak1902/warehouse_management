📄 EDSignage Inventory – Project Context
🔧 Tech Stack

Frontend

React (Vite)

React Router DOM

Axios

Tailwind CSS

Context API (InventoryProvider)

Backend

Node.js

Express

Prisma ORM

PostgreSQL

bcryptjs

jsonwebtoken (JWT)

🔐 Authentication Architecture

User logs in via /login

Backend verifies password using bcrypt

Backend generates JWT token

Token stored in localStorage

Token sent in Authorization header:

Authorization: Bearer <token>


Backend protects routes using authMiddleware

Role stored inside JWT payload

JWT payload example:

{
  userId: 1,
  role: "Admin"
}

🔐 Backend Middleware

authMiddleware:

Extracts token from Authorization header

Verifies using process.env.JWT_SECRET

Attaches req.user

Rejects if invalid

🗂 Route Structure
/login
/dashboard
/dashboard/client
/dashboard/devices
/dashboard/location
/dashboard/assigning
/dashboard/delivery
/dashboard/installation
/dashboard/return
/super-admin


Layout wrapper for protected routes

ProtectedRoute handles role-based restriction

🔑 LocalStorage Keys
token
user

🚀 Current Status

✔ JWT authentication working
✔ Backend route protection working
✔ Role-based frontend routing
✔ Prisma connected to PostgreSQL
✔ Login working
✔ Postman testing working

🎯 Next Goals

Add Inventory CRUD APIs

Add role-based backend authorization

Add token verification on refresh

Prepare for deployment