# Agency Experience Guide

This document provides a comprehensive overview of the agency (business) role within the Bizmi platform, covering features, technical routes, and the end-to-end hiring journey.

---

## 1. Core Features

### 📢 Job Postings & Management
*   **Job Creation:** Detailed wizard to define project scope, budget (min/max), skills, and duration.
*   **Listing Control:** Ability to pause, edit, or close job postings based on recruitment progress.
*   **Status Tracking:** Real-time visibility into the number of proposals received for each post.

### 🔍 Talent Discovery
*   **Freelancer Search:** A searchable directory of vetted talent with advanced keyword and skill filters.
*   **Trust Badges:** Visual indicators of a freelancer's reliability (e.g., "Verified", "Fully Verified" based on identity and job history).
*   **Profile Review:** Access to detailed freelancer bios, portfolio highlights, and historical ratings.

### 💰 Wallet & Escrow (Hiring Security)
*   **Job Funding:** Integrated payment flow (Paystack) to deposit funds into escrow before work begins.
*   **Transaction Ledger:** Detailed history of all deposits, successful payouts, and pending verifications.
*   **Milestone Approval:** Agencies control the release of funds; payment is only released to the freelancer once the "Job Done" button is clicked.

### 💬 Communication & Workspace
*   **In-app Chat:** Real-time messaging to interview candidates and coordinate with active hires.
*   **Shared Workspace:** A central room at `/workspace/[job_id]` for reviewing deliverables, requesting revisions, and final approvals.

---

## 2. Routing Map

| Route | Purpose | Component / Page |
| :--- | :--- | :--- |
| `/agency/dashboard` | Main command center for job management | `AgencyDashboard` |
| `/agency/profile` | Company branding, logo, and bio editor | `AgencyProfile` |
| `/agency/find-freelancers` | Proactive talent search and filtering | `FindFreelancers` |
| `/agency/wallet` | Fund management and transaction history | `AgencyWalletPage` |
| `/agency/messages` | Real-time chat with talent | `AgencyMessages` |
| `/agency/posts` | Management of all job listings | `AgencyPosts` |
| `/workspace/[job_id]` | Collaboration and milestone approval room | `ProjectWorkspace` |
| `/agency/tutorial` | Hiring guides and platform onboarding | `AgencyTutorial` |

---

## 3. The Agency User Journey

### Phase 1: Setup
1.  **Signup:** Register as an "Agency" and provide business details.
2.  **Branding:** Upload a company logo and bio to attract high-quality freelancers.

### Phase 2: Posting & Sourcing
3.  **Job Post:** Create a new project listing at `/agency/dashboard`.
4.  **Discovery:** Use `/agency/find-freelancers` to proactively invite top-rated talent to apply.
5.  **Review:** Analyze incoming bids on the dashboard, comparing proposals and freelancer portfolios.

### Phase 3: Selection & Hiring
6.  **Interview:** Use `/agency/messages` to discuss technical details and culture fit.
7.  **Hire & Fund:** Select the winning candidate and deposit the project budget into escrow via `/agency/wallet`.

### Phase 4: Project Management
8.  **Collaborate:** Use the dedicated `/workspace/[job_id]` for file exchange and feedback.
9.  **Approve:** Once the work meets requirements, mark the job as "Completed" in the wallet or workspace to release funds to the freelancer.

---

## 4. Technical Implementation Details

*   **Database Tables:** `profiles`, `jobs`, `proposals`, `agency_fundings`, `Funded_jobs101`, `agency_image`.
*   **Funding Flow:** Uses `agency_fundings` to track deposits and `Funded_jobs101` as the active escrow ledger.
*   **Verification:** Leverages trust badges derived from `Freelancer_identitie` and historical project completion data.
*   **Role Protection:** Enforced by checking `account_type: 'agency'` in layouts and server actions.
