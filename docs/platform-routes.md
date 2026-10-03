# Bizimi Platform Routes

This document outlines the entire routing structure of the Bizimi platform, organized by user role. Paths are the legacy Next.js app's; the new React SPA (`client/`) uses the same paths — see `docs/react-node-migration-parity-checklist.md` for what is ported and what is blocked on escrow (Phase 4).

## 🌍 Public / General Routes (Unauthenticated)

These routes are accessible to anyone visiting the site.

*   `/`
    *   **Landing Page:** The main homepage highlighting the platform's value proposition, featuring trust badges, key benefits, and calls to action for both agencies and freelancers.
*   `/login`
    *   **Sign In:** The authentication portal where users (Freelancers, Agencies, Admins) enter their credentials to access their respective dashboards.
*   `/signup`
    *   **Registration Wizard:** A multi-step stepper where new users select their account type (Agency or Freelancer), provide personal details, select skills (if applicable), and set up their security credentials.
*   `/reset-password`
    *   **Password Recovery:** Where the emailed recovery link lands to set a new password. The reset email is requested from the "Forgot?" link on `/login`.
*   `/contact`
    *   **Support/Contact Us:** A general form for visitors or users to reach out to the platform administration.

---

## 👨‍💻 Freelancer Routes (Authenticated)

These routes are restricted to users with the `account_type: 'freelancer'`.

*   `/freelancer/dashboard`
    *   **Freelancer Hub:** Briefs matched to the freelancer's skills, their available credits, and high-level earning stats. (The bare `/dashboard` redirects here.)
*   `/freelancer/marketplace`
    *   **Job Marketplace:** Browse all open projects with search and filters (category, budget, job type), Smart Match, and bookmarking.
*   `/freelancer/profile`
    *   **Public Profile Editor:** Where freelancers manage the information agencies see when reviewing proposals (bio, skills, hourly rate, portfolio links, and profile picture).
*   `/freelancer/proposals`
    *   **Bid Management:** A list of all proposals the freelancer has submitted, showing the current status of each (Pending, Accepted, Rejected).
*   `/freelancer/funded-jobs`
    *   **Active Contracts & Wallet:** Shows jobs where the agency has deposited funds into escrow. From here, freelancers can initiate payouts (withdrawals) for completed jobs or open disputes.
*   `/freelancer/saved-jobs`
    *   **Watchlist:** A dedicated view for jobs the freelancer has bookmarked to review or apply to later.
*   `/freelancer/messages`
    *   **Inbox:** A real-time chat interface to communicate directly with agencies regarding proposals or ongoing projects.
*   `/freelancer/bizpal`
    *   **Credit Store:** The portal where freelancers purchase additional "credits" (using Paystack) to continue bidding on new projects.
*   `/freelancer/identity`
    *   **Verification:** The required KYC (Know Your Customer) step where freelancers submit their NIN (National Identity Number). Verification itself is done by an external service; this page submits the NIN and shows the resulting status (pending, verified, or unsuccessful — a rejected NIN can be resubmitted).
*   `/freelancer/settings`
    *   **Account Configuration:** Manage account-level settings, notification preferences, and password changes.
*   `/freelancer/tutorial`
    *   **Onboarding:** Educational content/videos explaining how to succeed on the Bizimi platform.
*   `/freelancer/contact`
    *   **Freelancer Support:** Email, WhatsApp and community-group support channels plus social links (linked from the navbar's Support item).
*   `/freelancer/policy`
    *   **Duplicates & Verification Policy:** The single-account, authenticity, profile-image and NIN-verification rules, and the consequences of violating them.
*   `/freelancer/reset-password`
    *   **Legacy Recovery Target:** Older password-reset emails link here; it serves the same page as `/reset-password`.

---

## 🏢 Agency Routes (Authenticated)

These routes are restricted to users with the `account_type: 'agency'`.

*   `/agency/dashboard`
    *   **Agency Hub:** The command center for managing job postings. Agencies can post new jobs, pause/close existing ones, review incoming proposals, and monitor overall hiring metrics.
*   `/agency/profile`
    *   **Company Profile Editor:** Where the agency updates their public-facing information (company size, bio, website, and logo) visible to freelancers.
*   `/agency/find-freelancers`
    *   **Talent Search:** A directory to proactively search for, filter, and invite specific freelancers to apply for jobs based on their skills and ratings.
*   `/agency/messages`
    *   **Inbox:** A real-time chat interface to communicate with freelancers during the interview phase or throughout an active project.
*   `/agency/wallet`
    *   **Financial Overview:** Tracks the agency's total spend, funds currently locked in escrow, and overall transaction history.
*   `/agency/posts`
    *   **Listing Management:** A detailed view of all historical and active job postings created by the agency.
*   `/agency/settings`
    *   **Account Configuration:** Manage company settings, billing details, and password changes.
*   `/agency/tutorial`
    *   **Onboarding:** Educational content on how to effectively hire and manage talent on the platform.

---

## 🛠 Shared Workspaces & Escrow (Authenticated)

These routes are accessible to both the specific Agency and Freelancer involved in a contract.

*   `/workspace/[job_id]`
    *   **Project Delivery Room:** The dedicated collaboration space for an active contract. Freelancers submit their final work (via GitHub links, Figma links, or file uploads) here. Agencies review the work, request revisions via the comment thread, or approve the submission to release escrow funds.
*   `/disputes/[id]`
    *   **Dispute Resolution Room:** The moderation space activated when an issue arises. The involved parties have a 3-7 day window to chat and upload evidence to resolve the issue themselves before an Admin intervenes.

---

## 👑 Admin Routes (High-Level Authentication)

These routes are restricted to platform administrators for oversight and moderation.

*   `/admin/login`
    *   **Secure Admin Portal:** A separate login gate specifically for administrative staff.
*   `/admin/dashboard`
    *   **Platform Overview:** High-level metrics showing total user growth, active jobs, platform revenue (from credit sales and the 15% payout fee), and system health.
*   `/admin/users`
    *   **User Management:** All registered freelancers and agencies, grouped by account type, with per-user details and the ability to disable an account. (Identity verification is handled by the external KYC service, not here.)
*   `/admin/transactions`
    *   **Financial Ledger:** A global log of all money movements across the platform, including credit purchases, escrow deposits, and successful payouts.
*   `/admin/disputes`
    *   **Moderation Queue:** The dashboard where admins review escalated conflicts. Admins analyze the original job scope, submitted work, and chat logs to issue a final financial verdict (Full Release, Partial Release, or Refund).
*   `/admin/analytics`
    *   **Business Intelligence:** Deeper charts and graphs analyzing user behavior, popular job categories, and platform retention.
*   `/admin/credits`
    *   **Credit System Management:** Oversight of the virtual economy, tracking how many credits are being bought vs. spent, and adjusting pricing or welcome bonuses.
*   `/admin/jobs`
    *   **Job Moderation:** Review job postings and remove fraudulent or policy-violating ones from the marketplace.
*   `/admin/audit`
    *   **Audit Log:** A record of consequential admin actions (money movement, account changes).
*   `/admin/influencers`
    *   **Influencer Program:** Referral performance and user acquisition per influencer, program settings, and recording influencer payouts.

---

## 📣 Influencer Routes (Authenticated)

These routes are restricted to referral partners — signed-in users with an `influencer_profiles` record.

*   `/influencer/dashboard`
    *   **Influencer Hub:** The influencer's referral link (anyone who signs up through it is attributed to them), their unpaid commission balance, and recent referrals.
*   `/influencer/referrals`
    *   **Referrals:** Everyone who signed up through the influencer's link — user type, status, commission and join date.
*   `/influencer/earnings`
    *   **Earnings:** Commission earnings and payout history. Payouts are processed by the Bizimi team.
