# Bizimi Project Context

Bizimi is a premier Nigerian freelancer marketplace designed to connect businesses (agencies) with vetted professional talent. The platform features a robust credit-based application system and an escrow-based payment workflow to ensure secure and efficient collaborations.

## Project Overview

- **Purpose:** A marketplace for freelancers and agencies in Nigeria.
- **Key Features:**
  - **Freelancer Portal:** Profile management, identity verification, job discovery, and proposal submission.
  - **Agency Portal:** Job posting, candidate review, milestone-based escrow funding, and workspace management.
  - **Admin Dashboard:** System-wide analytics, transaction monitoring, and dispute resolution.
  - **Payments & Credits:** Integration with Paystack/Flutterwave for credit purchases and job funding.
  - **Real-time Messaging:** Direct communication between agencies and freelancers.

## Technical Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database & Auth:** Supabase (Auth, PostgreSQL, Realtime, Storage)
- **UI & Styling:** Tailwind CSS, Shadcn UI (Radix UI), Lucide Icons, Framer Motion
- **Form Handling:** React Hook Form, Zod
- **Payments:** Paystack (Inline & API), Flutterwave

## Directory Structure

- `app/`: Next.js App Router pages and layouts.
  - `admin/`, `agency/`, `freelancer/`: Role-specific portals.
  - `actions/`: Server actions for data mutations and fetching.
  - `api/`: Backend API routes for payment verification and webhooks.
- `components/`: Shared UI components (mostly Shadcn-based).
- `contexts/`: React Context providers (e.g., `AuthContext`).
- `lib/`: Shared utilities and client initializations (Supabase, Paystack).
- `scripts/`: SQL migration and setup scripts for Supabase.
- `styles/`: Global CSS and Tailwind configurations.
- `utils/`: Helper functions.

## Core Workflows & Data Models

### 1. Authentication & Profiles
Uses Supabase Auth with a custom `profiles` table. User roles (`agency`, `freelancer`, `admin`) are defined in the profile metadata.

### 2. Jobs & Proposals
- Jobs are created by agencies and stored in the `jobs` table.
- Freelancers apply using credits (monitored via `purchase_credits`).
- Proposals are linked to jobs and freelancers, managed through the `proposals` table.

### 3. Escrow & Payouts
- Jobs are "funded" by agencies using Paystack/Flutterwave.
- Funds are tracked in `Funded_jobs101` (escrow).
- Freelancers can request payouts after successful job delivery and agency approval.

### 4. Messaging
Real-time messaging is enabled via Supabase Realtime, with data stored in `conversations` and `messages` tables.

## Key Commands

- `pnpm dev`: Start the development server.
- `pnpm build`: Build the application for production.
- `pnpm start`: Start the production server.
- `pnpm lint`: Run linting checks.

## Development Conventions

- **Server Actions:** Prefer Next.js Server Actions (`app/actions/`) for database operations over API routes where possible.
- **Database Policies:** Rely on Supabase Row Level Security (RLS) for data protection. SQL scripts for these are located in `scripts/`.
- **Styling:** Follow the existing Tailwind and Shadcn patterns. Use the `orange-500` primary color for consistent branding.
- **Types:** Ensure all new data models are typed in TypeScript and validated with Zod in forms.
- **Components:** Reuse existing Shadcn UI components located in `components/ui/`.

## Important Files for Reference

- `contexts/AuthContext.tsx`: Core authentication logic.
- `app/actions/jobs.ts` & `app/actions/user.ts`: Primary data access patterns.
- `scripts/get_jobs_with_details.sql`: Main job fetching logic (PostgreSQL function).
- `app/agency/dashboard/page.tsx`: Complex state management for the agency workflow.
- `app/freelancer/bizpal/page.tsx`: Financial management interface for freelancers.
