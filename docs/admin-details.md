# Admin Experience Guide

This document provides a comprehensive overview of the Admin role within the Bizmi platform, covering oversight features, technical routes, and core moderation workflows.

---

## 1. Core Features

### 📊 Platform Oversight
*   **System Analytics:** Real-time visibility into total users, new signups, active jobs, and platform revenue.
*   **Global Metrics:** Tracking of agency vs. freelancer growth and platform-wide engagement.

### 👥 User Management
*   **Unified CRM:** A searchable directory of all registered users (Agencies and Freelancers).
*   **Account Control:** Ability to view detailed user profiles, monitor wallet balances, and manually disable accounts if violations occur.
*   **Verification Oversight:** Monitoring the identity verification status of users to ensure platform integrity.

### ⚖️ Dispute Resolution (The Verdict)
*   **Case Investigation:** Access to original job scopes, project descriptions, and transaction histories for disputed projects.
*   **Administrative Intervention:** Manual control over escrowed funds when a project conflict is escalated.
*   **Financial Verdicts:** 
    *   **Full Release:** Awarding the full escrow amount to the freelancer.
    *   **Full Refund:** Returning the full amount to the agency.
    *   **Partial Release:** Splitting the funds between both parties based on work delivered.

### 💳 Virtual Economy (Credits)
*   **Credit Monitoring:** Oversight of how virtual credits are purchased, spent, and circulated within the freelancer marketplace.
*   **Transaction Ledger:** A global log of all credit-related transactions and Paystack references.

---

## 2. Routing Map

| Route | Purpose | Component / Page |
| :--- | :--- | :--- |
| `/admin/dashboard` | High-level overview and quick user management | `AdminDashboard` |
| `/admin/users` | Detailed user directory and moderation | `AdminUsers` |
| `/admin/transactions` | Global financial ledger of all movements | `AdminTransactions` |
| `/admin/disputes` | Moderation queue for escalated project conflicts | `AdminDisputes` |
| `/admin/credits` | Management of the credit purchase system | `AdminCreditsPage` |
| `/admin/analytics` | Deep-dive business intelligence and charts | `AdminAnalytics` |
| `/admin/login` | Secure staff-only authentication portal | `AdminLogin` |

---

## 3. The Admin Workflow

### Workflow 1: Conflict Resolution (Disputes)
1.  **Notification:** An admin is alerted when a dispute moves to "Admin Intervention."
2.  **Review:** The admin opens `/admin/disputes` to read the case description and project details.
3.  **Verdict:** After analysis, the admin selects a resolution outcome (Release, Refund, or Partial).
4.  **Execution:** The system automatically moves funds between the agency's wallet and the freelancer's balance based on the admin's action.

### Workflow 2: User Moderation
1.  **Monitoring:** Use the dashboard to see spikes in new users or suspicious activity.
2.  **Lookup:** Use the search feature in `/admin/users` to find specific individuals by email or name.
3.  **Action:** Disable accounts that violate platform policies (e.g., misrepresentation of identity).

---

## 4. Technical Implementation Details

*   **Database Tables:** `profiles`, `disputes`, `purchase_credits`, `Funded_jobs101`.
*   **Resolution API:** Uses `/api/admin/disputes/[id]/resolve` to handle the complex logic of fund redistribution.
*   **Security:** Routes are protected by checking `account_type: 'admin'` and utilizing Supabase Auth session validation.
*   **UI Components:** Built using a dedicated `AdminSidebar` and SidebarProvider for a consistent, staff-centric layout.
