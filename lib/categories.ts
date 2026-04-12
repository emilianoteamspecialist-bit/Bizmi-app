// Skill-to-category mapping for filtering jobs and freelancers
export const CATEGORIES = {
  Design: [
    "Graphic Design", "Logo Design", "Illustration", "Print Design", "Business Card Design",
    "Flyer & Brochure Design", "Poster Design", "Infographic Design", "UI/UX Design",
    "UI/UX Wireframing", "Product Design", "Industrial Design", "Fashion Design",
    "Jewelry Design", "Interior Design", "Architecture Design", "3D Modeling", "3D Rendering",
    "Animation (2D/3D)", "Motion Graphics", "Character Design", "NFT Art", "Storyboarding",
    "T-shirt Design", "Merchandise Design", "Packaging Design", "Label Design", "Tattoo Design",
    "Book Cover Design", "Album Cover Design", "Presentation Design (PowerPoint, Keynote)",
    "Architectural Visualization", "Landscape Design", "Set Design (Theater/Film)",
    "Story Illustration", "Typography Design", "Calligraphy", "Comic / Manga Art",
    "Caricature Drawing", "Figma", "Adobe XD", "Photoshop",
  ],
  Tech: [
    "Web Development", "Mobile App Development", "Frontend Development", "Backend Development",
    "Full-Stack Development", "Software Development", "Game Development", "Blockchain Development",
    "Smart Contracts", "Cybersecurity", "Cloud Computing", "DevOps", "Database Management",
    "API Development", "WordPress Development", "Shopify Development", "E-commerce Development",
    "SaaS Development", "AR/VR Development", "Machine Learning", "Artificial Intelligence",
    "Data Science", "Django", "Express.js", "MongoDB", "MySQL", "PostgreSQL", "Firebase", "AWS",
    "Docker", "Git", "Mobile Development", "Flutter", "React Native", "Data Analysis",
    "Python Programming", "JavaScript Development", "React.js Development", "Node.js Development",
    "PHP Development", "Java Development", "C++ Development", "C# Development",
    "Go (Golang) Development", "Ruby on Rails Development", "Kotlin Development",
    "Swift (iOS) Development", "Android Development", "Flutter Development", "Rust Development",
    "Penetration Testing", "Ethical Hacking", "Bug Bounty Research", "IoT Development",
    "Embedded Systems", "Firmware Development", "Robotics Programming", "MATLAB",
    "Simulations & Modeling", "QA Testing / Software Testing", "Automation Scripting",
    "Web Scraping", "Chatbot Development", "API Integration",
    "CRM Development (Salesforce, HubSpot, Zoho)", "ERP Development (SAP, Oracle, Odoo)",
    "Game Design (Unity, Unreal Engine)", "Database Optimization", "Big Data Engineering",
    "Cloud Architecture (AWS, Azure, GCP)", "Server Management", "Linux System Administration",
    "Network Administration", "IT Support",
  ],
  Marketing: [
    "Digital Marketing", "SEO (Search Engine Optimization)", "SEM (Search Engine Marketing)",
    "Social Media Marketing", "Social Media Management", "Influencer Marketing",
    "Content Marketing", "Email Marketing", "Affiliate Marketing",
    "PPC Campaigns (Google, Facebook Ads)", "Marketing Strategy", "Brand Strategy",
    "Lead Generation", "Sales Funnel Design", "PR (Public Relations)",
  ],
  Writing: [
    "Content Writing", "Copywriting", "Creative Writing", "Technical Writing", "Blog Writing",
    "Ghostwriting", "Script Writing (Film/Video)", "Resume Writing", "Cover Letter Writing",
    "White Papers", "Academic Writing", "Research Writing", "Proofreading & Editing",
    "Grant Writing", "eBook Writing", "Speech Writing", "Song Lyrics Writing",
    "Product Descriptions", "Ad Copywriting", "Case Studies", "UX Writing", "Press Releases",
    "Medical Writing", "Legal Writing", "Grant Proposals", "Business Proposals",
    "Newsletter Writing", "Review Writing (Books, Products, Movies)", "Social Media Captions",
  ],
  Media: [
    "Video Editing", "Photography", "Photo Editing / Retouching", "Image Manipulation",
    "Voice Over", "Music Production", "Audio Editing", "Podcast Editing", "Sound Design",
    "DJ Services", "Singing / Songwriting", "Video Production", "Infographic Video Creation",
  ],
  "Business & Finance": [
    "Virtual Assistance", "Data Entry", "Customer Support", "Bookkeeping", "Accounting",
    "Financial Planning", "Tax Preparation", "Business Consulting", "Project Management",
    "Human Resources", "Recruitment", "Legal Consulting",
  ],
  Education: [
    "Online Tutoring", "Test Preparation (SAT, IELTS, GRE, etc.)", "Academic Coaching",
    "Career Counseling", "Life Coaching", "Language Tutoring",
  ],
  Translation: [
    "Translation (All Languages)", "Transcription", "Subtitling / Captioning",
    "Localization Services", "Sign Language",
  ],
} as const

export type Category = keyof typeof CATEGORIES

export const ALL_CATEGORIES = Object.keys(CATEGORIES) as Category[]

// Build a reverse lookup: skill name -> category
const _skillToCategory: Record<string, Category> = {}
for (const [category, skills] of Object.entries(CATEGORIES)) {
  for (const skill of skills) {
    _skillToCategory[skill.toLowerCase()] = category as Category
  }
}

/**
 * Get the category for a given skill name.
 * Returns undefined if the skill doesn't match any category.
 */
export function getCategoryForSkill(skill: string): Category | undefined {
  return _skillToCategory[skill.toLowerCase()]
}

/**
 * Get all categories that apply to an array of skills.
 */
export function getCategoriesForSkills(skills: string[]): Category[] {
  const categories = new Set<Category>()
  for (const skill of skills) {
    const cat = getCategoryForSkill(skill)
    if (cat) categories.add(cat)
  }
  return Array.from(categories)
}

/**
 * Get all skills belonging to a category.
 */
export function getSkillsForCategory(category: Category): readonly string[] {
  return CATEGORIES[category]
}
