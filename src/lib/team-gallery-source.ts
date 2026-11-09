/**
 * Editorial source manifest for GEM's authenticated team-gallery preview.
 * These are original public Notion media references, NOT approved personnel records.
 * This snapshot is maintained separately from the publication-gated /personnel API.
 * Do not use this manifest for public directory output or infer identities/licences.
 */

export type TeamGalleryCategory = "governance" | "technology" | "operations" | "finance" | "unassigned";

export interface TeamGalleryEntry {
  slug: string;
  title: string;
  department: string;
  category: TeamGalleryCategory;
  summary: string;
  responsibilities: readonly string[];
  imageUrl: string;
  notionProfileUrl: string;
  identityVerified: false;
}

export const NOTION_STAFF_SOURCE_URL = "https://bow-sunset-a14.notion.site/cec77c2d1ac58258924e01c8191c716d?v=72e77c2d1ac5821d91ac08f9104a79e2";
export const NOTION_TEAM_GALLERY_URL = "https://app.notion.com/p/393b5b56eac281a79024c9427df7480d";
export const NOTION_ATR_SOURCE_URL = "https://caramel-mallet-6dc.notion.site/25ab5b56eac28047a113e2756852c714?v=25ab5b56eac28068a6a9000ce15e950f";
export const NOTION_ATR_MEDIA_PAGE_URL = "https://app.notion.com/p/413b5b56eac281c6b9a3d5becb1ff5a0";

export const teamGalleryEntries: readonly TeamGalleryEntry[] = [
  {
    "slug": "legal-consultant",
    "title": "Consultant / Lawyer",
    "department": "Legal & governance",
    "category": "governance",
    "summary": "Corporate legal coordination, contracts, governance and professional consultation within confirmed scope.",
    "responsibilities": [
      "Organize legal and contractual review",
      "Coordinate governance and policy questions",
      "Route regulated matters to appropriately qualified counsel"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F491b65c9-cdab-44cc-9cc8-8de8be266206%2FIMG_2335.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac28166994ed9c7c4cbbfdc",
    "identityVerified": false
  },
  {
    "slug": "public-speaker-attorney",
    "title": "Public Speaker / Attorney",
    "department": "Legal communications",
    "category": "governance",
    "summary": "Public education, speaking engagements and stakeholder discussions about legal and governance issues.",
    "responsibilities": [
      "Prepare educational presentations and briefings",
      "Support stakeholder and event discussions",
      "Document and clarify approved public information"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F8b323abe-8fab-4d95-ae38-6b0729963a4d%2FIMG_2334.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac281f78b09c2a813f18bdb",
    "identityVerified": false
  },
  {
    "slug": "regional-hr-sales",
    "title": "Regional HR / Sales Manager",
    "department": "People & sales",
    "category": "operations",
    "summary": "Workforce coordination, regional team development and commercial service operations.",
    "responsibilities": [
      "Coordinate staff onboarding and training",
      "Support regional sales planning and reporting",
      "Review service standards and client follow-up"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2Fa16a774b-06bc-4429-824d-d4cac4e0ce19%2F423B2803-FC8C-4E72-90FA-55317D16AB3A.png/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac2810db352de835576d496",
    "identityVerified": false
  },
  {
    "slug": "data-analyst-cybersecurity",
    "title": "Data Analysts / Cybersecurity",
    "department": "Security & intelligence",
    "category": "technology",
    "summary": "Evidence-based analytics, defensive security monitoring and authorized risk assessment.",
    "responsibilities": [
      "Analyze documented events and operational data",
      "Review authorized security observations",
      "Prepare risk findings and monitoring summaries"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F44ba531e-b3d7-4196-9a49-cf039ee65343%2F2EEE85FA-C823-4948-9322-CA43F51019B9.png/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac28115b42bfe301bc6293a",
    "identityVerified": false
  },
  {
    "slug": "international-compliance",
    "title": "International Compliance",
    "department": "Compliance",
    "category": "governance",
    "summary": "Cross-border regulatory research, due diligence, evidence and governance coordination.",
    "responsibilities": [
      "Monitor relevant compliance questions",
      "Organize due-diligence documentation",
      "Escalate jurisdictional issues for specialist review"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F926fc98f-ad07-4b31-9f17-8c8aab46a910%2FIMG_2319.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac28115bf18d2b2fb12dd5e",
    "identityVerified": false
  },
  {
    "slug": "attorney-it-consultant",
    "title": "Attorney / IT Consultant",
    "department": "Technology governance",
    "category": "governance",
    "summary": "Technology contracts, information governance and collaboration between legal and technical teams.",
    "responsibilities": [
      "Coordinate technology contract questions",
      "Review policy and privacy process requirements",
      "Document technical risks for authorized advisers"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F0860c8ff-9dc6-450d-9e49-3723a7cf5832%2FIMG_2321.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac281babebcc5d3d8ceb348",
    "identityVerified": false
  },
  {
    "slug": "software-engineer",
    "title": "Professional Software Engineer",
    "department": "Software engineering",
    "category": "technology",
    "summary": "Enterprise software architecture, implementation, testing and maintenance.",
    "responsibilities": [
      "Design and document application components",
      "Review code, tests and release readiness",
      "Coordinate engineering and security follow-up"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F26962775-0c7e-4eeb-9a80-57004f0723b2%2FIMG_2430.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac281028a64dda6acafc4d2",
    "identityVerified": false
  },
  {
    "slug": "financial-tech-markets",
    "title": "Tech / Commercial Stocks-ETFs Manager",
    "department": "Financial technology",
    "category": "finance",
    "summary": "Research, market-data operations and financial-technology risk reporting, subject to applicable authority.",
    "responsibilities": [
      "Review market and operating information",
      "Prepare data and risk summaries",
      "Route regulated advisory activity to authorized professionals"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F1a43ca9e-3552-4c5d-ac83-a59256a5e8e5%2Fd1bf8539-08e7-4d12-aeeb-fbfa1084e762.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac28116b7a5c6c6feac73b5",
    "identityVerified": false
  },
  {
    "slug": "advertising",
    "title": "Advertising",
    "department": "Marketing & communications",
    "category": "operations",
    "summary": "Editorial storytelling, creative production, campaign planning and measurement.",
    "responsibilities": [
      "Develop campaign briefs and visual assets",
      "Coordinate marketing content review",
      "Track creative and engagement performance"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F8991bfa9-bc1d-4b89-aae1-18ebf86b2f6a%2FIMG_0340.jpeg/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac281a684bff4cf11c5b49a",
    "identityVerified": false
  },
  {
    "slug": "unassigned-photo",
    "title": "Additional staff photo — role pending",
    "department": "Unassigned",
    "category": "unassigned",
    "summary": "This original image has no confirmed name or occupational label in the source.",
    "responsibilities": [
      "Preserve the source and provenance",
      "Confirm person-to-role mapping before attribution",
      "Approve the portrait and profile before public publication"
    ],
    "imageUrl": "https://img.notionusercontent.com/s3/prod-files-secure%2F07277c2d-1ac5-81a6-9388-0003656615a4%2F4a7a0411-808a-4dc7-8538-0efcefa83f81%2F79573ED8-E1FE-4B4A-9D30-33E0DD8D7B0B.png/size/w=2000",
    "notionProfileUrl": "https://app.notion.com/p/413b5b56eac281ae8c1cde8b0200427b",
    "identityVerified": false
  }
];

export const atrGalleryMedia: readonly { title: string; caption: string; url: string }[] = [
  {
    "title": "ATR corporate presentation",
    "caption": "Company presentation concept — the presenter is not identified in the source.",
    "url": "https://caramel-mallet-6dc.notion.site/image/attachment%3Ab2f5feea-d621-4db7-a62a-ce1317bf0d10%3Aexported_2CC5D84D-837E-492F-A898-79F87D71ADE3.jpeg?table=block&id=25ab5b56-eac2-8018-9204-db23efd4debd&spaceId=f36b5b56-eac2-81d0-9481-000328c16e80&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"
  },
  {
    "title": "Architectural rendering I",
    "caption": "Architectural concept, not evidence of a completed development.",
    "url": "https://caramel-mallet-6dc.notion.site/image/attachment%3A6f25ce4c-6460-4ad4-9f02-2e09eb987d7d%3AIMG_4625.jpeg?table=block&id=25ab5b56-eac2-807b-81b5-f7b90a1363ea&spaceId=f36b5b56-eac2-81d0-9481-000328c16e80&width=2000&userId=&cache=v2"
  },
  {
    "title": "Architectural rendering II",
    "caption": "Property-design concept with project status unverified.",
    "url": "https://caramel-mallet-6dc.notion.site/image/attachment%3A7a35423d-fe28-4bce-9e02-548ea15c0eb1%3AIMG_4621.jpeg?table=block&id=25ab5b56-eac2-80c7-889b-cb3aecae3098&spaceId=f36b5b56-eac2-81d0-9481-000328c16e80&width=2000&userId=&cache=v2"
  }
];
