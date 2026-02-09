# Sakra IKOC - Healthcare Package Cards

## Overview

Sakra IKOC is a healthcare package management system that allows customers to purchase bundled healthcare services (lab tests, consultations, physiotherapy sessions) and redeem them over time. The application has two main interfaces: a customer-facing portal for browsing, purchasing, and tracking packages, and an admin dashboard for managing packages and processing service redemptions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom healthcare-focused design tokens
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

### SMS Gateway
- **Karix (Tanla)**: SMS delivery via JSON API
  - Endpoint: `https://japi.instaalerts.zone/httpapi/JsonReceiver`
  - Auth: API key in request body (`key` field)
  - Secrets: `KARIX_API_KEY`, `KARIX_SENDER_ID`, `KARIX_ENTITY_ID`
  - Super Admin SMS page at `/superadmin` (passcode: 7999)

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development