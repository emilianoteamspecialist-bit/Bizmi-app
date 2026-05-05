# Freelancer Experience Guide

This document provides a comprehensive overview of the freelancer role within the Bizmi platform, covering features, technical routes, and the end-to-end user journey.

---

## 1. Core Features

### 🏢 Job Marketplace
*   **Search & Discovery:** A high-performance feed of open projects with real-time updates.
*   **Advanced Filtering:** Filter by category (Programming, Design, Writing, Marketing), budget (₦), duration, and credit cost.
*   **Watchlist:** A bookmarking system to save high-interest projects for later review.

### 📝 Bidding & Proposals
*   **Credit System:** A "pay-to-play" model where freelancers spend platform credits to submit proposals, ensuring quality and reducing spam.
*   **Custom Bids:** Ability to propose unique budgets and timelines that differ from the job's initial estimate.
*   **Rich Proposals:** Support for detailed cover letters and file attachments (portfolios, plans).

### 💳 Financial Management (BizPal)
*   **Credit Store:** Seamless credit purchases integrated with Paystack.
*   **Earnings Tracking:** Real-time visibility into total earnings, pending milestones, and available balance.
*   **Local Payouts:** Direct withdrawal functionality to Nigerian bank accounts.

### 🛡️ Trust & Security
*   **NIN Verification:** Mandatory identity verification via National Identification Number to unlock bidding.
*   **Escrow Protection:** Payment security where funds are locked in escrow (`Funded_jobs101`) before work begins.
*   **Agency Transparency:** Access to agency history, ratings, and company size before applying.

### 💬 Real-time Communication
*   **Direct Messaging:** Integrated chat system for interviews and project coordination.
*   **Collaborative Workspaces:** Dedicated project rooms for file sharing and milestone approvals.

---

## 2. Routing Map

| Route | Purpose | Component / Page |
| :--- | :--- | :--- |
| `/dashboard` | Main marketplace & job feed | `FreelancerDashboard` |
| `/freelancer/profile` | Public bio, skills, and portfolio editor | `ProfileEditor` |
| `/freelancer/proposals` | Status tracking for all submitted bids | `ProposalsPage` |
| `/freelancer/funded-jobs` | Active contracts and escrow status | `FundedJobsPage` |
| `/freelancer/bizpal` | Credit purchases and payout management | `BizPalPage` |
| `/freelancer/identity` | KYC/NIN verification portal | `IdentityPage` |
| `/freelancer/saved-jobs` | Personal watchlist of bookmarked jobs | `SavedJobsPage` |
| `/freelancer/messages` | Real-time chat inbox | `MessagesPage` |
| `/workspace/[job_id]` | Active project delivery & review room | `ProjectWorkspace` |

---

## 3. The Freelancer User Journey

### Phase 1: Onboarding
1.  **Signup:** Create an account and select "Freelancer" as the role.
2.  **Profile Creation:** Complete the professional profile with skills, bio, and portfolio.
3.  **Tutorial:** Watch the onboarding videos at `/freelancer/tutorial` to understand platform mechanics.

### Phase 2: Verification & Credits
4.  **Identity Check:** Submit NIN via `/freelancer/identity`. Access is restricted until admin approval.
5.  **Top-up:** Purchase credits via `/freelancer/bizpal` to enable bidding.

### Phase 3: Finding Work
6.  **Search:** Browse the `/dashboard` for suitable projects.
7.  **Proposal:** Submit a bid, consuming 1–5 credits depending on the project size.
8.  **Interview:** Coordinate with agencies via `/freelancer/messages`.

### Phase 4: Delivery & Payout
9.  **Funding:** Once hired, ensure the agency has funded the escrow.
10. **Delivery:** Submit work through the `/workspace/[job_id]`.
11. **Payout:** Upon approval, funds move to the wallet. Withdraw via `/freelancer/bizpal` to a bank account.

---

## 4. Technical Implementation Details

*   **Database Tables:** `profiles`, `jobs`, `proposals`, `purchase_credits`, `Funded_jobs101`, `freelancer_verification`.
*   **Authentication:** Managed via Supabase Auth with custom role-based redirects.
*   **Real-time:** Proposals and messages use Supabase Realtime for instant updates.
*   **Validation:** All bids and profile updates are validated via Zod schemas and enforced by Supabase RLS (Row Level Security) policies.
