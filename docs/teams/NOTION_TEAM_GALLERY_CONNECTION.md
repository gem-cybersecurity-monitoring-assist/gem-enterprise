# GEM Enterprise — original Notion Teams Gallery connection

## Implementation

- Platform: `gem-cybersecurity-monitoring-assist/gem-enterprise` (Next.js).
- Source: `src/lib/team-gallery-source.ts` contains the **snapshot** of ten role-linked original Notion photographs and three separate ATR presentation images.
- Preview: `/app/admin/team-gallery` uses `src/components/admin/TeamGalleryPreview.tsx`, searchable/filterable cards, original images, departmental work definitions, profile links, and a separate ATR media area.
- Entry points: Admin Center navigation and the authenticated sidebar.
- Authentication: `src/proxy.ts` already restricts `/app/admin/**` to `admin`, `super_admin` and `internal`; no authorization bypass or public route was added.
- Notion profile pages: ten dedicated professional role pages remain linked from the cards.
- Public personnel route: `/personnel` and `src/lib/notion-public-directory.ts` are unmodified. They still require `Publish Approved=true`, `Website Visibility=Public`, and existing role/audience checks.

## Source of truth and refresh semantics

- GEM/ATR source role photographs: https://bow-sunset-a14.notion.site/cec77c2d1ac58258924e01c8191c716d?v=72e77c2d1ac5821d91ac08f9104a79e2
- Edited Notion enterprise gallery: https://app.notion.com/p/393b5b56eac281a79024c9427df7480d
- Separate ATR company media: https://caramel-mallet-6dc.notion.site/25ab5b56eac28047a113e2756852c714?v=25ab5b56eac28068a6a9000ce15e950f
- ATR media profiles: https://app.notion.com/p/413b5b56eac281c6b9a3d5becb1ff5a0

The new platform preview is **linked to the original Notion pages but not auto-synchronized**: the source manifest is a reviewed content snapshot. For image updates, edit the source in Notion, review its identity/permissions and source URL, update `team-gallery-source.ts` in a new PR, then check the authenticated preview. Keep original image rights and a provenance record. External Notion images may cease to resolve; the UI displays a source-link fallback instead of fake replacement photography.

Never publish unverified names, qualifications, regulated credentials, employer affiliations, licensed real-estate claims, or client/project outcomes by inferring them from an image. The role labels are directly from the source but do not establish that the pictured person holds that role.

## Validation

1. Run `pnpm run typecheck`.
2. Run `pnpm run lint`.
3. Run `pnpm exec vitest run src/lib/team-gallery-source.test.ts` or `pnpm run test`.
4. Run `pnpm run build` with the repository's required Node 24 toolchain and reviewed environment.
5. Visit preview `/app/admin/team-gallery` as admin and verify ten role images, three ATR media items, search/filter, and all profile links.
6. Visit anonymously and with a client role to verify authorization redirects. No role should bypass the `/personnel` publication checks.
7. Inspect mobile layouts and browser console; if Notion image URLs fail, follow their original profile links and fix with reviewed source assets.

**No public release, background sync job, new Notion API token, gallery publishing, or production environment modification is part of this branch.**
