import { Shield, CheckCircle, AlertTriangle, FileText } from "lucide-react"

export default function FreelancerPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Shield className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-primaryxl font-bold text-slate-900 mb-2">
              Bizimi Freelancer Duplicates & Verification Policy
            </h1>
            <p className="text-slate-600">
              At Bizimi, we are committed to maintaining a safe, authentic, and trustworthy platform for freelancers and
              clients.
            </p>
          </div>

          {/* Policy Sections */}
          <div className="space-y-8">
            {/* Single Account Rule */}
            <div className="border-l-4 border-primary pl-6">
              <div className="flex items-center mb-3">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">1. Single Account Rule</h2>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li>• Each freelancer is permitted to maintain only one account on Bizimi.</li>
                <li>• Creating, attempting to create, or maintaining duplicate accounts is strictly prohibited.</li>
                <li>
                  • If any freelancer is found with duplicate accounts, all related accounts will be permanently banned.
                </li>
              </ul>
            </div>

            {/* Authenticity Requirement */}
            <div className="border-l-4 border-primary pl-6">
              <div className="flex items-center mb-3">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">2. Authenticity Requirement</h2>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li>• Freelancers must provide accurate and truthful information when creating their profiles.</li>
                <li>• Misrepresentation of identity, skills, or credentials is not allowed.</li>
                <li>
                  • All freelancers must be authentic and genuine individuals; impersonation of another person or entity
                  will lead to account termination.
                </li>
              </ul>
            </div>

            {/* Profile Image Policy */}
            <div className="border-l-4 border-primary pl-6">
              <div className="flex items-center mb-3">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">3. Profile Image Policy</h2>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li>• Every freelancer must upload a clear and real photo of themselves as their profile avatar.</li>
                <li>
                  • Use of logos, cartoons, celebrities, AI-generated images, or any other non-personal images as a
                  profile avatar is prohibited.
                </li>
                <li>• This ensures proper visibility, transparency, and trust between freelancers and clients.</li>
              </ul>
            </div>

            {/* NIN Verification Requirement */}
            <div className="border-l-4 border-primary pl-6">
              <div className="flex items-center mb-3">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">4. NIN Verification Requirement</h2>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li>
                  • To enhance security and trust, every freelancer is required to complete NIN (National Identification
                  Number) verification within 30 days of creating an account.
                </li>
                <li>
                  • Freelancers who fail to complete NIN verification within this timeframe will have their accounts
                  suspended or permanently banned.
                </li>
                <li>
                  • Any freelancer found to have provided false or invalid NIN information will be removed from the
                  platform.
                </li>
              </ul>
            </div>

            {/* Consequences of Violation */}
            <div className="border-l-4 border-red-500 pl-6">
              <div className="flex items-center mb-3">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">5. Consequences of Violation</h2>
              </div>
              <p className="text-slate-700 mb-2">
                Violation of any part of this policy will result in one or more of the following actions:
              </p>
              <ul className="space-y-2 text-slate-700">
                <li>• Immediate suspension of the freelancer's account.</li>
                <li>• Permanent ban from the Bizimi platform.</li>
                <li>
                  • Loss of access to ongoing projects and withdrawal of pending payments (subject to Bizimi's Terms of
                  Service).
                </li>
              </ul>
            </div>

            {/* Right to Review */}
            <div className="border-l-4 border-primary pl-6">
              <div className="flex items-center mb-3">
                <FileText className="h-6 w-6 text-primary mr-2" />
                <h2 className="text-xl font-semibold text-slate-900">6. Right to Review</h2>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li>
                  • Bizimi reserves the right to review, investigate, and take action on any freelancer account
                  suspected of violating this policy.
                </li>
                <li>
                  • Decisions made by Bizimi regarding duplicate accounts, authenticity, and verification are final and
                  binding.
                </li>
              </ul>
            </div>
          </div>

          {/* Approval Section */}
          {/* <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="text-center">
              <p className="text-slate-600 mb-2">Approved by:</p>
              <p className="text-lg font-semibold text-primary">Emiliano & Mubarak</p>
              <p className="text-slate-600">Founders, Bizimi</p>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  )
}
