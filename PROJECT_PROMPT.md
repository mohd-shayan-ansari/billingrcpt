# Billing Lottery - Complete Project Prompt for AI Agents

## 1. PROJECT OVERVIEW

**Project Name:** Billing Lottery  
**Type:** Full-stack web application  
**Purpose:** Thermal receipt generation system with role-based access for billing/lottery operations  
**Primary Users:** Master Admin (manages system + counter admins) and Counter Admins (create receipts)  
**Deployment Target:** Vercel (production) + Local development (localhost:3000)

### Core Business Logic
- Master Admin: Can view ALL receipts from all counter admins, manage rates, create/update user accounts
- Counter Admin: Can only view and create receipts from their own counter
- Receipt System: Tracks three types of entries (Andar/Bahar/Result), auto-generates receipt numbers with counter prefix
- Print System: Optimized for 58mm thermal receipt printer with PDF download capability

---

## 2. TECHNOLOGY STACK

### Frontend
- **Framework:** Next.js 16.2.4 (App Router, Turbopack)
- **Language:** TypeScript 5
- **UI Styling:** Tailwind CSS 4 with @tailwindcss/postcss
- **PDF Generation:** jsPDF 4.2.1
- **State Management:** React 19.2.4 with hooks (useState, useEffect)
- **Form Validation:** Zod 4.3.6

### Backend
- **Runtime:** Node.js (via Next.js API routes)
- **ORM:** Prisma 6.16.0
- **Authentication:** JWT (jose 6.2.3) with httpOnly cookies
- **Password Hashing:** bcryptjs 3.0.3

### Database
- **Production:** PostgreSQL 15+ (Supabase)
- **Connection:** Via `DATABASE_URL` environment variable
- **Current Status:** Tables exist (User, Rate, Receipt)

### Development Tools
- **Build:** Next.js + Turbopack (faster than Webpack)
- **Linting:** ESLint 9
- **Build Script:** npm with tsx for TypeScript execution

---

## 3. PROJECT STRUCTURE

```
billinglottery/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts           # JWT login endpoint
│   │   │   │   ├── logout/route.ts          # Clear auth cookie
│   │   │   │   ├── me/route.ts              # Get current session user
│   │   │   │   └── update-password/route.ts # Change user password
│   │   │   ├── receipts/
│   │   │   │   ├── route.ts                 # GET/POST receipts (main receipts API)
│   │   │   │   └── next/route.ts            # Generate next receipt number
│   │   │   ├── rates/route.ts               # GET/PUT rates (Andar/Bahar/Result)
│   │   │   └── admin/
│   │   │       └── users/
│   │   │           ├── route.ts             # GET users + POST create user (admin only)
│   │   │           └── [id]/route.ts        # PUT/DELETE user by ID
│   │   ├── page.tsx                         # Main page (renders AppShell)
│   │   ├── layout.tsx                       # Root layout with globals
│   │   └── globals.css                      # Global styles (Tailwind directives)
│   ├── components/
│   │   └── app-shell.tsx                    # Main UI component (all pages + forms)
│   └── lib/
│       ├── auth.ts                          # JWT token creation/verification
│       ├── receipt.ts                       # Receipt formatting/calculation logic
│       └── constants.ts                     # Constants (roles, receipt keys, rates)
├── prisma/
│   ├── schema.prisma                        # Database schema definition
│   └── seed.ts                              # Database seeding script
├── public/
├── scripts/
│   ├── check-db.js                          # Debug: Display current DB contents
│   ├── create-counter-admins.js             # Debug: Create test counter admins
│   └── test-login.js                        # Debug: Test login endpoint
├── .env                                     # Environment variables (DATABASE_URL, JWT_SECRET)
├── .env.example                             # Example env template
├── package.json                             # Dependencies + scripts
├── tsconfig.json                            # TypeScript config
├── next.config.ts                           # Next.js config
├── eslint.config.mjs                        # ESLint rules
├── postcss.config.mjs                       # PostCSS/Tailwind config
├── README.md                                # Basic setup guide
└── PROJECT_PROMPT.md                        # This file
```

---

## 4. DATABASE SCHEMA

### Prisma Schema (PostgreSQL)

#### User Model
```prisma
enum Role {
  MASTER_ADMIN
  COUNTER_ADMIN
}

model User {
  id           String    @id @default(cuid())
  name         String
  username     String    @unique              # Email-like: admin@billing.local
  passwordHash String
  role         Role
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  receipts     Receipt[]                      # Foreign key relation
}
```

#### Rate Model
```prisma
model Rate {
  id        String   @id @default(cuid())
  itemKey   String   @unique                 # andar | bahar | result
  label     String
  rate      Int                              # Commission rate per entry
  updatedAt DateTime @updatedAt
}
```

#### Receipt Model
```prisma
model Receipt {
  id            String   @id @default(cuid())
  receiptNumber String   @unique             # A01, A02, B01, etc. (counter prefix + sequence)
  heading       String?                      # User-defined receipt heading
  adminId       String
  admin         User     @relation(fields: [adminId], references: [id], onDelete: Cascade)
  timestamp     DateTime @default(now())
  
  # Andar entry
  andarCode     String?                      # Single digit code
  andarRate     Int?
  andarQty      Int      @default(0)
  andarAmount   Int      @default(0)
  
  # Bahar entry
  baharCode     String?                      # Single digit code
  baharRate     Int?
  baharQty      Int      @default(0)
  baharAmount   Int      @default(0)
  
  # Result entry
  resultCode    String?                      # Two digit code
  resultRate    Int?
  resultQty     Int      @default(0)
  resultAmount  Int      @default(0)
  
  totalAmount   Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([adminId, timestamp])
  @@index([timestamp])
}
```

**Key Database Facts:**
- PostgreSQL provider via Supabase
- Connection string: `postgresql://user:password@db.dyrhkigsufgcbsvpvkfy.supabase.co:5432/postgres`
- User roles: MASTER_ADMIN (1 user) or COUNTER_ADMIN (multiple users)
- Receipt numbers auto-generated per counter: Counter 01→A prefix, Counter 02→B prefix, etc.
- Indexes on adminId+timestamp for efficient filtering

---

## 5. API ENDPOINTS

### Authentication Endpoints

#### POST `/api/auth/login`
- **Purpose:** Authenticate user and create JWT session
- **Request Body:**
  ```json
  {
    "username": "admin@billing.local",  // Or email/username
    "password": "Admin@1234"
  }
  ```
- **Response:** 200 OK (sets httpOnly cookie `billinglottery_token`) or 401 Unauthorized
- **Cookie Details:** 7-day expiration, SameSite=Lax, HttpOnly
- **Validation:** Zod schema requires username OR name field; password hashed with bcryptjs

#### POST `/api/auth/logout`
- **Purpose:** Clear authentication cookie
- **Response:** 200 OK

#### GET `/api/auth/me`
- **Purpose:** Get current authenticated user
- **Response:**
  ```json
  {
    "id": "cuid",
    "name": "Admin Name",
    "username": "admin@billing.local",
    "role": "MASTER_ADMIN"
  }
  ```
- **Auth Required:** Yes (JWT cookie)

#### POST `/api/auth/update-password`
- **Purpose:** Change user password
- **Request Body:**
  ```json
  {
    "currentPassword": "old_password",
    "newPassword": "new_password"
  }
  ```
- **Response:** 200 OK or 401 Unauthorized
- **Auth Required:** Yes

---

### Receipt Endpoints

#### GET `/api/receipts`
- **Purpose:** Fetch receipt history with filters
- **Query Parameters:**
  - `search` (optional): Filter by receipt number, heading, or admin name/username
- **Response:** Array of receipts with admin details
- **Access Control:**
  - Master Admin: Sees ALL receipts (with optional search filter)
  - Counter Admin: Sees only their own receipts (with optional search filter)
- **Key Logic:** WHERE clause handling
  - Master admin + no search: `WHERE 1=1` (sees all)
  - Master admin + search: `WHERE receiptNumber ILIKE '%search%' OR ...`
  - Counter admin: `WHERE r.adminId = session.id`

#### POST `/api/receipts`
- **Purpose:** Create new receipt
- **Request Body:**
  ```json
  {
    "heading": "Counter 01",
    "entries": [
      {
        "itemKey": "andar",
        "code": "5",
        "qty": 100,
        "rate": 12
      }
    ]
  }
  ```
- **Response:** Created receipt with ID and auto-generated receipt number
- **Business Logic:**
  - Calculates totalAmount from entries (qty × rate)
  - Fetches next receipt number from `/api/receipts/next`
  - Associates with logged-in admin

#### GET `/api/receipts/next`
- **Purpose:** Generate next receipt number (for preview)
- **Response:**
  ```json
  { "nextReceiptNumber": "A03" }
  ```
- **Algorithm:**
  - Counter prefix: Admin's counter ID → base-26 (01→A, 02→B, 27→AA, etc.)
  - Sequence: Query max sequence for that counter + 1
  - Format: `{prefix}{sequence.padStart(2, '0')}`

---

### Rate Endpoints

#### GET `/api/rates`
- **Purpose:** Fetch all rates (Andar, Bahar, Result)
- **Response:**
  ```json
  {
    "andar": 12,
    "bahar": 55,
    "result": 110
  }
  ```
- **Access Control:** Public (no auth required)

#### PUT `/api/rates`
- **Purpose:** Update rates (Master Admin only)
- **Request Body:**
  ```json
  {
    "andar": 15,
    "bahar": 60,
    "result": 120
  }
  ```
- **Response:** Updated rates
- **Auth Required:** Yes, must be MASTER_ADMIN

---

### Admin/User Endpoints

#### GET `/api/admin/users`
- **Purpose:** Fetch all users (Master Admin only)
- **Response:** Array of user records (id, name, username, role, createdAt)
- **Auth Required:** Yes, must be MASTER_ADMIN

#### POST `/api/admin/users`
- **Purpose:** Create new counter admin user
- **Request Body:**
  ```json
  {
    "name": "Counter Admin Name",
    "username": "counter1@billing.local",
    "password": "SecurePassword123"
  }
  ```
- **Response:** Created user (without passwordHash)
- **Auth Required:** Yes, must be MASTER_ADMIN
- **Password:** Hashed with bcryptjs before storage

#### PUT `/api/admin/users/[id]`
- **Purpose:** Update user name (Master Admin only)
- **Request Body:**
  ```json
  { "name": "Updated Name" }
  ```
- **Response:** Updated user
- **Auth Required:** Yes

#### DELETE `/api/admin/users/[id]`
- **Purpose:** Delete user (Master Admin only)
- **Response:** 200 OK
- **Auth Required:** Yes

---

## 6. AUTHENTICATION FLOW

### Login Process
1. User submits username and password on frontend
2. Backend validates credentials against User model (bcryptjs comparison)
3. If valid: Create JWT token (header.payload.signature)
4. Set httpOnly cookie with JWT (7-day expiration)
5. Frontend redirected to dashboard

### Session Verification
1. Browser automatically sends cookie with every request
2. Backend middleware extracts JWT from cookie
3. Verifies signature with JWT_SECRET
4. Decodes payload to get user ID, role, etc.
5. Rejected requests return 401 Unauthorized

### Logout
1. User clicks logout
2. Frontend calls POST `/api/auth/logout`
3. Backend clears cookie
4. Frontend redirected to login page

**Key Implementation Files:**
- `src/lib/auth.ts` - JWT creation/verification with jose
- `src/app/api/auth/login/route.ts` - Login endpoint with bcryptjs
- Frontend checks session with GET `/api/auth/me`

---

## 7. KEY FEATURES & BUSINESS LOGIC

### Receipt Number Generation
- **Algorithm:** Counter prefix (A, B, C...) + zero-padded sequence (01, 02...)
- **Counter Mapping:** Counter 01 = A, Counter 02 = B, Counter 03 = C, etc.
- **Base-26 Encoding:** Counter 27 = AA, Counter 28 = AB, etc.
- **Uniqueness:** @unique constraint in Prisma ensures no duplicates
- **Example:** Admin from "Counter 01" creates first receipt → "A01"

### Receipt Amount Calculation
- **Formula:** For each entry: `amount = qty × rate`
- **Total:** Sum of all entry amounts
- **Storage:** Amount fields are integers (no decimals; work in paise/cents)

### Role-Based Access Control (RBAC)
- **Master Admin:**
  - Can view all receipts from all counters
  - Can search across all receipts
  - Can manage counter admins (create, read, update, delete)
  - Can edit central rates
  - Can change own password
- **Counter Admin:**
  - Can only view/create receipts from their counter
  - Can see only their receipts in history
  - Can create receipt entries and print
  - Can change own password

### Print & PDF Export
- **Print Preview:** Generates HTML layout optimized for 58mm thermal width
- **CSS:** Uses print-specific media queries and styling
- **PDF Export:** jsPDF converts print HTML to PDF file
- **File Naming:** `receipt_{receiptNumber}_{timestamp}.pdf`
- **Print Format:** Shows receipt number, timestamp, entries with codes/amounts, total

### Search Functionality
- **Master Admin:** Can search by receipt number, heading, or admin name/username
- **Counter Admin:** Search within their own receipts only
- **Query Type:** Case-insensitive ILIKE in PostgreSQL

---

## 8. CURRENT ISSUES & KNOWN BUGS

### Issue 1: Receipt Numbering Shows "PENDING" (UI)
- **Status:** ✅ FIXED IN CODE
- **Root Cause:** Preview shows "PENDING" until receipt is actually saved to database
- **Solution:** Receipt display correctly shows actual number after save (A01, A02, etc.)
- **File:** `src/components/app-shell.tsx` - `printReceipt()` function
- **Next Steps:** Verify Vercel deployment reflects this

### Issue 2: Master Admin Receipt Filtering
- **Status:** ✅ FIXED IN CODE
- **Root Cause:** WHERE clause used `Prisma.empty` which created invalid SQL syntax
- **Previous SQL:** `SELECT ... FROM Receipt r JOIN User a WHERE  ORDER BY` (no WHERE clause)
- **Solution Applied:** Changed to explicit `WHERE 1=1` when no search filter
- **File:** `src/app/api/receipts/route.ts` - GET endpoint
- **Current Logic:**
  - Master admin + no search: `WHERE 1=1` (sees all receipts)
  - Master admin + search: `WHERE receiptNumber ILIKE ... OR heading ILIKE ... OR ...`
  - Counter admin: `WHERE r.adminId = ${session.id}`

### Issue 3: Print/Save-and-Print Button
- **Status:** ✅ VERIFIED WORKING
- **Button Label:** Correctly shows "Save and Print"
- **Functionality:** Saves receipt first, then opens print dialog
- **File:** `src/components/app-shell.tsx` - `saveAndPrint()` function
- **Implementation:** Uses `printReceipt()` after successful save

### Issue 4: Database Connectivity (Supabase)
- **Status:** ⚠️ INTERMITTENT
- **Symptoms:** Occasional "Can't reach database server" errors
- **Root Cause:** Supabase network connectivity or firewall rules
- **Check:** Verify Supabase is running and accessible from Vercel
- **Workaround:** Retry requests; check Supabase dashboard health

### Issue 5: Vercel Deployment Sync
- **Status:** 🟡 REQUIRES VERIFICATION
- **Issue:** Vercel app may not have latest code changes
- **Reason:** Code committed and pushed but deployment may need manual trigger
- **Solution:** Check Vercel dashboard; manually redeploy if needed
- **Environment:** Verify DATABASE_URL and JWT_SECRET are set in Vercel Settings

---

## 9. SETUP & LOCAL DEVELOPMENT

### Prerequisites
- Node.js 18+ (with npm)
- PostgreSQL database (or Supabase account for production)
- Git

### Initial Setup
```bash
# 1. Clone repository
git clone <repo-url>
cd billinglottery

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env

# 4. Update .env with your DATABASE_URL
# Example PostgreSQL:
# DATABASE_URL="postgresql://user:password@localhost:5432/billinglottery"
# Example Supabase:
# DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"

# 5. Generate Prisma client
npm run prisma:generate

# 6. Push schema to database (creates tables)
npm run db:push

# 7. Seed initial data (master admin + rates)
npm run db:seed

# 8. Start development server
npm run dev
```

### Development Server
```bash
npm run dev
# Runs on http://localhost:3000
# Turbopack enabled for fast reloads
```

### Default Credentials (After Seed)
- **Username:** `admin@billing.local`
- **Password:** `Admin@1234`
- **Role:** MASTER_ADMIN

---

## 10. DEPLOYMENT TO VERCEL

### Prerequisites
- GitHub repository
- Vercel account linked to GitHub
- Supabase PostgreSQL database

### Deployment Steps

#### 1. GitHub Setup
```bash
# Ensure code is committed and pushed
git add -A
git commit -m "Your message"
git push origin main
```

#### 2. Vercel Settings
- Go to [Vercel Dashboard](https://vercel.com)
- Import project from GitHub
- Add environment variables in Vercel project settings:
  ```
  DATABASE_URL=postgresql://user:password@db.xxxxx.supabase.co:5432/postgres
  JWT_SECRET=your-secret-key-here (min 32 chars)
  ```

#### 3. Build & Deploy
- Vercel automatically builds and deploys on git push
- Build command: `next build` (in package.json)
- Start command: `next start` (in package.json)

#### 4. Database Setup
- Supabase tables must already exist before deployment
- Run `npm run db:push` locally or in build command
- Verify with `npm run db:seed` if needed (or create seed task in Vercel)

#### 5. Verification
- Visit your Vercel URL (e.g., billingrcpt.vercel.app)
- Test login with master admin credentials
- Test receipt creation and filtering

### Troubleshooting Vercel Deployment
- **500 errors on API routes:** Check DATABASE_URL is set correctly
- **Stale login page:** Clear browser cache (Ctrl+Shift+Delete)
- **Tables don't exist:** Run `npm run db:push` before deploy
- **JWT errors:** Verify JWT_SECRET is set and matches local value

---

## 11. CODE PATTERNS & CONVENTIONS

### TypeScript Types
- Use explicit interface definitions for data models
- Export types from `lib/constants.ts` and `lib/types.ts`
- Use `Record<string, unknown>` for flexible query results

### API Routes
- Use `route.ts` files in Next.js app directory
- Always check authentication before processing requests
- Return `NextResponse` with appropriate status codes
- Use Zod for request validation

### Prisma Queries
- Use raw SQL (`prisma.$queryRaw`) for complex queries
- Always use parameterized queries to prevent SQL injection
- Use `Prisma.sql` for template literals
- Generate client after schema changes: `npm run prisma:generate`

### Components
- Client components use `"use client"` directive
- Use React hooks for state management (useState, useEffect)
- Separate logic from UI; use helper functions for calculations
- Use constants for magic strings/numbers

### Error Handling
- Return appropriate HTTP status codes (200, 201, 400, 401, 404, 500)
- Include error messages in response body
- Log errors to console (useful for debugging)

### Environment Variables
```env
DATABASE_URL=postgresql://...     # Required for database connection
JWT_SECRET=your-secret-key        # Required for JWT signing (32+ chars)
NEXT_PUBLIC_API_URL=http://localhost:3000  # Optional: for frontend API calls
```

---

## 12. COMMON DEVELOPMENT TASKS

### Create New Counter Admin User
```bash
node scripts/create-counter-admins.js
# Creates test accounts: counter1@billing.local, counter2@billing.local
```

### Check Database Contents
```bash
node scripts/check-db.js
# Displays Users, Rates, and Receipts from database
```

### Test Login Endpoint
```bash
node scripts/test-login.js
# Tests login with default credentials
```

### Reset Database
```bash
npm run db:push -- --force-reset  # WARNING: Deletes all data
npm run db:seed
```

### Run Build
```bash
npm run build
# Builds optimized production bundle
```

### Lint Code
```bash
npm run lint
# Checks TypeScript and ESLint rules
```

---

## 13. IMPORTANT NOTES FOR AI AGENTS

### When Making Changes
1. **Always run tests locally first:** `npm run dev` on localhost:3000
2. **Test both roles:** Log in as MASTER_ADMIN and COUNTER_ADMIN
3. **Check database state:** Use `scripts/check-db.js` to verify data
4. **Commit incrementally:** Small, focused commits with clear messages
5. **Push to GitHub:** Changes won't appear on Vercel until committed and pushed

### Common Mistakes to Avoid
- ❌ Don't use `Prisma.empty` in raw SQL queries (use `WHERE 1=1` instead)
- ❌ Don't hardcode environment variables (always use `.env`)
- ❌ Don't forget `npm run prisma:generate` after schema changes
- ❌ Don't skip authentication checks in admin endpoints
- ❌ Don't assume Supabase is always responsive (use error handling)

### Testing Checklist
- [ ] Can master admin log in?
- [ ] Can master admin see all receipts?
- [ ] Can counter admin log in?
- [ ] Can counter admin only see their receipts?
- [ ] Does receipt number generation work (A01, A02, etc.)?
- [ ] Does "Save and Print" button work?
- [ ] Can master admin create new counter admins?
- [ ] Can master admin update rates?
- [ ] Are all API endpoints protected with authentication?
- [ ] Does search filtering work for both roles?

### Database Verification
```bash
# Check connection
psql $DATABASE_URL -c "SELECT NOW();"

# View tables
psql $DATABASE_URL -c "\dt"

# Query users
psql $DATABASE_URL -c "SELECT id, name, username, role FROM \"User\";"

# Query rates
psql $DATABASE_URL -c "SELECT * FROM \"Rate\";"

# Query receipts (sample)
psql $DATABASE_URL -c "SELECT id, \"receiptNumber\", \"totalAmount\" FROM \"Receipt\" LIMIT 10;"
```

---

## 14. RESOURCES & REFERENCES

- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **jsPDF Docs:** https://github.com/parallax/jsPDF
- **Zod Validation:** https://zod.dev
- **Jose JWT:** https://github.com/panva/jose
- **Supabase:** https://supabase.com/docs

---

## 15. SUMMARY FOR AI AGENTS

**Mission:** Build and maintain a secure, role-based billing receipt application with the following requirements:

**Core Requirements:**
1. Master Admin can view all receipts and manage counter admins
2. Counter Admins can only view their own receipts
3. Receipt numbers are auto-generated with counter prefix (A01, A02, B01, etc.)
4. Print/PDF export functionality for receipts
5. JWT-based authentication with httpOnly cookies
6. PostgreSQL database (Supabase in production)

**Technology Stack:**
- Next.js 16.2.4, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL

**Critical Files to Know:**
- `src/components/app-shell.tsx` - Main UI component
- `src/app/api/receipts/route.ts` - Receipt management (GET/POST)
- `src/app/api/auth/login/route.ts` - Authentication
- `prisma/schema.prisma` - Database schema
- `.env` - Environment variables

**When you encounter issues:**
1. Check `.env` and verify DATABASE_URL/JWT_SECRET are set
2. Run `npm run db:push` if tables are missing
3. Test locally with `npm run dev` before committing
4. Use debug scripts in `scripts/` folder
5. Check Vercel dashboard for deployment issues

---

**Last Updated:** April 2026  
**Version:** 1.0  
**Repository:** https://github.com/mohd-shayan-ansari/billingrcpt
