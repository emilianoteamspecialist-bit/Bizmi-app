# Bizimi Platform Routes

This document outlines the entire routing structure of the Bizimi platform, organized by user role.

## 🌍 Public / General Routes (Unauthenticated)

These routes are accessible to anyone visiting the site.

*   `/`
    *   **Landing Page:** The main homepage highlighting the platform's value proposition, featuring trust badges, key benefits, and calls to action for both agencies and freelancers.
*   `/login`
    *   **Sign In:** The authentication portal where users (Freelancers, Agencies, Admins) enter their credentials to access their respective dashboards.
*   `/signup`
    *   **Registration Wizard:** A multi-step stepper where new users select their account type (Agency or Freelancer), provide personal details, select skills (if applicable), and set up their security credentials.
*   `/reset-password`
    *   **Password Recovery:** Allows users to reset their forgotten passwords via email verification.
*   `/contact`
    *   **Support/Contact Us:** A general form for visitors or users to reach out to the platform administration.

---

## 👨‍💻 Freelancer Routes (Authenticated)

These routes are restricted to users with the `account_type: 'freelancer'`.

*   `/dashboard`
    *   **Freelancer Hub:** The main marketplace view. Freelancers can browse active jobs, filter by category/budget, view their available credits, and see high-level earning stats.
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
    *   **Verification:** The required KYC (Know Your Customer) step where freelancers submit their NIN (National Identity Number) for platform approval.
*   `/freelancer/settings`
    *   **Account Configuration:** Manage account-level settings, notification preferences, and password changes.
*   `/freelancer/tutorial`
    *   **Onboarding:** Educational content/videos explaining how to succeed on the Bizimi platform.

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
    *   **User Management:** A CRM-style view of all registered freelancers and agencies, allowing admins to verify identities, ban users, or manually adjust trust scores.
*   `/admin/transactions`
    *   **Financial Ledger:** A global log of all money movements across the platform, including credit purchases, escrow deposits, and successful payouts.
*   `/admin/disputes`
    *   **Moderation Queue:** The dashboard where admins review escalated conflicts. Admins analyze the original job scope, submitted work, and chat logs to issue a final financial verdict (Full Release, Partial Release, or Refund).
*   `/admin/analytics`
    *   **Business Intelligence:** Deeper charts and graphs analyzing user behavior, popular job categories, and platform retention.
*   `/admin/credits`
    *   **Credit System Management:** Oversight of the virtual economy, tracking how many credits are being bought vs. spent, and adjusting pricing or welcome bonuses.
