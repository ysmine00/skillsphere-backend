# SkillSphere — Backend

> A RESTful API for the SkillSphere community skill-exchange platform, built with Node.js, Express, and PostgreSQL.

SkillSphere enables students, faculty, and staff at Al Akhawayn University to offer, request, and exchange skills. This repository contains the backend API that powers authentication, skill management, and exchange coordination.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Database](#database)
- [Related Repository](#related-repository)

---

## Overview

SkillSphere is a database-driven web application originally developed as a capstone project for a Database Systems course. The backend exposes a RESTful API consumed by the React frontend. It handles user authentication with JWT, password hashing with bcrypt, and all data operations against a PostgreSQL database.

Key features:
- Secure registration and login restricted to `@aui.ma` email addresses
- JWT-based authentication with protected routes
- Full CRUD for skill offerings, requests, and exchanges
- Activity score calculation via a PostgreSQL stored function
- Matching algorithm that suggests relevant offerings for a given request
- Soft deletion of offerings and requests that have associated exchanges

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express 5 | Web framework and routing |
| PostgreSQL 14+ | Relational database |
| pg | PostgreSQL client for Node.js |
| bcrypt | Password hashing |
| jsonwebtoken | JWT generation and verification |
| helmet | HTTP security headers |
| cors | Cross-origin request handling |
| morgan | HTTP request logging |
| dotenv | Environment variable management |
| nodemon | Development auto-restart |

---

## Project Structure

```
src/
├── config/
│   └── database.js          # PostgreSQL connection pool
├── controllers/
│   ├── authController.js    # register, login, getCurrentUser
│   ├── dashboardController.js
│   ├── exchangesController.js
│   ├── offeringsController.js
│   ├── profileController.js
│   ├── requestsController.js
│   └── skillsController.js
├── middleware/
│   └── authMiddleware.js    # JWT verification — protect()
├── routes/
│   ├── authRoutes.js
│   ├── dashboardRoutes.js
│   ├── exchangesRoutes.js
│   ├── offeringsRoutes.js
│   ├── profileRoutes.js
│   ├── requestsRoutes.js
│   └── skillsRoutes.js
└── server.js                # Express app entry point
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# Clone the repository
git clone https://github.com/ysmine00/skillsphere-backend.git
cd skillsphere-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Create the database and apply the schema
createdb skillsphere
psql -d skillsphere -f schema.sql

# Start the development server
npm run dev
```

The API will be available at `http://localhost:5000`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL=postgresql://localhost:5432/skillsphere
JWT_SECRET=your-long-random-secret
PORT=5000
NODE_ENV=development
```

Generate a secure JWT secret with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## API Endpoints

All protected routes require an `Authorization: Bearer <token>` header.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register a new user |
| POST | `/api/auth/login` | — | Login and receive a JWT |
| GET | `/api/auth/me` | ✓ | Get the current authenticated user |

### Dashboard
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard` | ✓ | Full dashboard data including stats and activity score |

### Skills
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/skills/available` | ✓ | All skills grouped by category |
| GET | `/api/skills/categories` | ✓ | All categories |
| GET | `/api/skills/user` | ✓ | Current user's skills |
| POST | `/api/skills/user` | ✓ | Add a skill to profile |
| PUT | `/api/skills/user/:id` | ✓ | Update a user skill |
| DELETE | `/api/skills/user/:id` | ✓ | Remove a skill from profile |

### Offerings
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/offerings` | ✓ | All active offerings |
| GET | `/api/offerings/user` | ✓ | Current user's offerings |
| GET | `/api/offerings/:id` | ✓ | Single offering |
| POST | `/api/offerings` | ✓ | Create a new offering |
| PUT | `/api/offerings/:id` | ✓ | Update an offering |
| DELETE | `/api/offerings/:id` | ✓ | Delete or deactivate an offering |

### Requests
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/requests` | ✓ | All active requests |
| GET | `/api/requests/user` | ✓ | Current user's requests |
| GET | `/api/requests/:id` | ✓ | Single request and matching offerings |
| POST | `/api/requests` | ✓ | Create a new request |
| PUT | `/api/requests/:id` | ✓ | Update a request |
| DELETE | `/api/requests/:id` | ✓ | Delete or deactivate a request |

### Exchanges
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/exchanges/user` | ✓ | Current user's exchanges |
| GET | `/api/exchanges/:id` | ✓ | Single exchange |
| POST | `/api/exchanges` | ✓ | Initiate a new exchange |
| PUT | `/api/exchanges/:id/status` | ✓ | Update exchange status |
| DELETE | `/api/exchanges/:id` | ✓ | Delete a pending exchange |

### Profile
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | ✓ | Current user's full profile |
| PUT | `/api/profile` | ✓ | Update profile information |

---

## Database

The full database schema is in `schema.sql`. It includes:

- **Tables:** `users`, `user_profiles`, `categories`, `skills`, `user_skills`, `skill_offerings`, `skill_requests`, `exchanges`
- **Indexes** on all foreign keys for query performance
- **Triggers** to auto-update `updated_at` timestamps on every table
- **Views:** `vw_active_skills_marketplace`, `vw_user_skills_profile`, `vw_exchange_activity`, `vw_admin_dashboard`
- **Functions:** `calculate_user_activity_score()`, `find_matching_offerings()`, `search_skills()`

Email domain validation (`@aui.ma`) is enforced at the database level via a `CHECK` constraint, in addition to API-level validation.

---

## Related Repository

- [skillsphere-frontend](https://github.com/ysmine00/skillsphere-frontend) — React frontend

---

**Developer:** Yasmine Kouch  
**GitHub:** [@ysmine00](https://github.com/ysmine00)
