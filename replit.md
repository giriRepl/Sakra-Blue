# Sakra IKOC - Healthcare Package Cards

## Overview

Sakra IKOC is a healthcare package management system that allows customers to purchase bundled healthcare services (lab tests, consultations, physiotherapy sessions) and redeem them over time. The application has three main interfaces: a customer-facing portal for browsing, purchasing, and tracking packages; an admin dashboard for managing packages, processing service redemptions, and corporate onboarding; and a super admin interface for SMS management.

### Package Lifecycle
- Packages have a `status` field: `draft`, `published`, or `deleted`
- **Draft**: Editable, can be published, cloned, or deleted
- **Published**: Visible to customers, editable until a purchase is made, can be cloned or deleted
- **Published with purchases**: Locked by default (not editable), can only be cloned or deleted. Unlockable via "Edit after publish" toggle in Super Admin Configuration
- **Deleted**: Soft-deleted, shown in "Deleted" tab, not visible to customers
- Only published packages are purchasable by customers
- The `isActive` field is kept for backward compatibility but `status` is the primary lifecycle driver
- Clone creates a new draft package with "(Copy)" appended to the title
- Edit lock is based on purchases (paid), not publish status

### Package Badges
- Packages can have a `badge` field: `null`, `"most_popular"`, or `"best_value"`
- Only published, non-enterprise packages can have badges set
- Only one package can be "Most Popular" and one "Best Value" at any time (auto-unmark previous holder)
- Badge is automatically cleared when a package is soft-deleted
- Badge removal (setting to null) is always allowed regardless of package status
- Badges are shown on customer landing page as prominent ribbon banners and on package details page
- Admin can set/remove badges from the packages list page (published non-enterprise only)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with Sakra brand design tokens (Pink/Purple/Green/Blue palette)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON API under `/api/*` routes
- **Authentication**: 
  - Customer auth: Mobile number + OTP verification (demo uses dummy OTP "79")
  - Admin auth: Email + OTP with Bearer token sessions
- **Session Storage**: In-memory stores (suitable for development/demo)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit (`db:push` for schema sync)
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── lib/             # Utilities, auth context, query client
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database operations interface
│   └── db.ts            # Database connection
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
└── migrations/          # Database migrations
```

### Key Design Patterns
- **Monorepo structure**: Client and server in single repository with shared types
- **Type safety**: End-to-end TypeScript with shared schema definitions
- **Component composition**: shadcn/ui pattern with composable primitives
- **Healthcare UX**: Mobile-first design with large touch targets and clear information hierarchy

## External Dependencies

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database abstraction and migrations

### UI Component Libraries
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **shadcn/ui**: Pre-built component styling on Radix primitives
- **Lucide React**: Icon library

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation (shared between client and server)
- **input-otp**: OTP input component

### Utilities
- **date-fns**: Date manipulation and formatting
- **class-variance-authority**: Component variant styling
- **clsx/tailwind-merge**: Conditional class utilities

### Payment Gateway
- **Razorpay**: Payment processing via Razorpay Checkout
  - Server SDK: `razorpay` npm package for order creation
  - Client: Razorpay Checkout.js loaded in `client/index.html`
  - Flow: Create order (backend) -> Open Razorpay Checkout (frontend) -> Verify signature (backend) -> Create purchase
  - Secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
  - Payment fields on purchases table: `razorpayOrderId`, `razorpayPaymentId`, `paymentStatus`
  - Signature verification uses HMAC SHA256 with `order_id|payment_id`

### SMS Gateway
- **Sakra SMS (napses.in)**: SMS delivery via JSON API
  - Endpoint: `https://sakrasms-prod.napses.in/send-sms`
  - Auth: `SMS_API_SECRET` in request body (`secret` field)
  - Utility: `server/sms.ts` — `sendSms()`, `sendTemplatedSms()`, `generateNumericOtp()`
  - Templates stored in DB (`sms_templates` table), looked up by `name`
  - Four SMS use cases integrated:
    1. **OTP** (Nap_Otp): Login & purchase verification — placeholder `{#1#}`
    2. **Purchase Success** (Nap_Purchase): After payment — placeholders `{#Package_Name#}`, `{#Amount#}`
    3. **Redemption OTP** (Nap_Redeem): Before service redemption — placeholder `{#1#}`
    4. **Redemption Confirmation** (Nap_Redeemed): After services redeemed — placeholders `{#Service_Name#}`, `{#Package_Name#}`
  - Redemption OTP: Generated server-side, stored in-memory, sent via SMS, verified via `/api/admin/redeem/verify-otp`
  - Failure logging: All SMS failures logged to `sms_failure_logs` table
  - Super Admin SMS page at `/superadmin` (passcode: 7999)

### Email System
- **Dual-route architecture**: SMTP primary with EWS (Exchange Web Services) fallback
  - Utility: `server/email.ts` — `sendEmail()`, `sendEmailSmtp()`, `sendEmailEws()`, `checkEmailHealth()`
  - `sendEmail()` tries SMTP first, falls back to EWS on failure; if SMTP not configured, goes straight to EWS
  - SMTP config: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` (default 587), `SMTP_FROM`, `SMTP_SECURE`, `SMTP_REJECT_UNAUTHORIZED`
  - EWS config: `EWS_URL`, `EWS_USERNAME`, `EWS_PASSWORD`, `EWS_DOMAIN`, `EWS_AUTH_TYPE` (auto/ntlm/basic/cookie), `EWS_REJECT_UNAUTHORIZED`, `EWS_EXCHANGE_VERSION`
  - EWS auto-retry: On 401, cycles through auth modes (ntlm → basic → cookie) and username variants (plain, domain\\user, email format)
  - Packages: `nodemailer`, `ews-javascript-api`, `httpntlm`, `xhr2`
  - Super Admin email test page: method selector (Auto/SMTP/EWS), health status panel
  - API: `POST /api/superadmin/send-test-email` (with optional `method` field), `GET /api/superadmin/email-health`
  - **Invoice Email**: Sent automatically after successful Razorpay payment
    - Template: `server/invoice-email.ts` — `generateInvoiceNumber()`, `buildInvoiceEmailHtml()`, `buildInvoiceEmailSubject()`
    - PDF generation: `server/invoice-pdf.ts` — `generateInvoicePdf()` using pdfkit
    - Invoice number format: `SIKOC-YYYYMMDD-XXXX` (random 4-digit suffix)
    - Content: Patient name, package name, amount paid, date, hospital name & address
    - Two trigger points: (1) immediately after payment verification if customer has email on file, (2) deferred after profile update for first-time customers
    - Tracking: `invoiceNumber` and `invoiceEmailSent` fields on purchases table
    - Hospital details in footer: Takshasila Hospitals Operating Private Limited, Sy No 52/2 and 52/3, Sakra World Hospital, Outer Ring Road, Marathahalli, Devarabeesanahalli, Varthur Hobli, Bengaluru Urban, Karnataka, 560103
    - **Invoice PDF attachment**: PDF is attached via SMTP (nodemailer attachments); EWS sends email without PDF attachment (library limitation with Exchange server schema validation). `SendEmailResult` includes `attachmentsSkipped` flag when EWS skips attachments.
    - **EWS HTML constraint**: Invoice HTML must use XHTML-compatible self-closing tags (e.g., `<br/>` not `<br>`) to avoid EWS XML schema validation errors
    - **Admin invoice actions** (in redeem page when purchase is selected):
      - Download PDF: `GET /api/admin/purchases/:purchaseId/invoice-pdf`
      - Send invoice email: `POST /api/admin/purchases/:purchaseId/send-invoice` (body: `{ email }`)
      - If admin provides an email, it's saved to the customer's profile automatically

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development