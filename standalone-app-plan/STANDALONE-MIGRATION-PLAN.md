# Standalone LMS App Migration Plan (Keep Softr Intact)

## Goal

Move the LMS experience out of Softr Custom Code blocks into a standalone web app, while:

- keeping Airtable as the data source
- keeping progress tracking on the existing Vercel/Netlify webhook proxy
- preserving current visual style and behavior
- leaving the Softr implementation untouched as a fallback

## Assumptions

- "Move from Softr blocks" means building a separate app (recommended: Next.js on Vercel).
- Airtable schema remains as currently updated:
  - Contacts is the person source
  - Assignments properly links to Contact(s)
- Existing progress API endpoints remain:
  - `GET /api/progress?personId=...`
  - `POST /api/section-view`
  - `POST /api/complete`

## Non-Destructive Repository Layout

Create a new app area and do not alter current Softr files:

- `standalone-app/` - new production app code
- `standalone-app-plan/` - planning docs (this file)

Keep all `Softr-Learning-Tracks-*.tsx/jsx` files as reference and rollback path.

## High-Level Architecture

1. **Frontend app** (Next.js + React + Tailwind + shadcn-style components)
   - Routes mirror existing Softr page slugs.
   - UI components ported from current block code with minimal style changes.
2. **Data layer**
   - Server-side Airtable client for reads (using Airtable PAT + base IDs).
   - Normalize Airtable response shapes once in a shared mapper layer.
3. **Progress layer**
   - Keep using current webhook proxy endpoints for progress read/write.
   - Preserve legacy merge behavior for old/new person IDs.
4. **Identity model**
   - Continue using `personId` query param initially to preserve behavior.
   - Add signed session token later (phase 2 hardening).

## Page and Block Migration Map

## 1) `/my-learning` (Entry / Email lookup)

Source: `Softr-Learning-Tracks-MyLearningEntry.tsx`

- Keep same flow:
  - user enters email
  - query Contacts
  - exact single match required
  - redirect to `/my-learning-tracks?personId={rec...}`
- Keep identical validation and error text unless intentionally revised.

## 2) `/my-learning-tracks` (Profile + Assigned tracks list)

Sources:

- `Softr-Learning-Tracks-MyLearningTracksProfile.tsx`
- `Softr-Learning-Tracks-MyLearningTracksList.tsx`

Combine both Softr blocks into one page with two sections:

- top profile strip (photo/name/title/venue/back)
- tracks grid with progress, due/completion, Start/Continue/Review

Data inputs:

- Contact record by `personId`
- Assignments filtered by `Contact` / `Contacts` / legacy `Personnel` link support
- Progress API response keyed by course IDs

## 3) `/track-view`

Source: `Softr-Learning-Tracks-Page2-TrackDetail.tsx`

- Keep route contract: `?recordId={trackId}&personId={personId}`
- Preserve progress calculations and Continue behavior.

## 4) `/course-detail`

Source: `Softr-Learning-Tracks-Page3-CourseDetail.tsx`

- Keep route contract: `?recordId={courseId}&trackId={trackId}&personId={personId}`
- Preserve "continue from section index" and progress display.

## 5) `/section-detail`

Sources:

- `Softr-Learning-Tracks-Page4-SectionContent.jsx`
- `Softr-Learning-Tracks-Page4-ResourceLibraryBlock.tsx`

In standalone app, make this one cohesive page component:

- section content area
- linked resources cards
- prev/next section navigation
- survey embed with prefill params

Keep current tracking behavior:

- send section view payload to `/api/section-view`
- send completion payload to `/api/complete`
- include both `personnelRecordIds` and `contactRecordIds` arrays for compatibility

## Styling Preservation Strategy

To keep the current look:

1. Port existing class names and structure directly from current files.
2. Reuse same icon package (`lucide-react`).
3. Create a component compatibility layer for Softr UI imports:
   - `Card`, `Button`, `Progress`, `Checkbox`, `cn`
4. Validate page-by-page against screenshots from current Softr pages.

This avoids a redesign and keeps user muscle memory intact.

## Data Access Plan (Airtable)

Use server-side functions (Next.js route handlers or server actions):

- `getContactByEmail(email)`
- `getContactById(personId)`
- `getAssignmentsForPerson(personId)`
- `getTrackById(trackId)`
- `getCourseById(courseId)`
- `getSectionById(sectionId)`

Normalize linked record fields in one place:

- handle object or array link shapes
- handle optional field naming drift (`Contact`, `Contacts`, `Personnel`)
- return predictable app models

## Progress API Integration Plan

Continue calling existing deployed proxy URL from app server or client (as needed):

- Read: `GET /api/progress?personId=...`
- Write: `POST /api/section-view`
- Complete: `POST /api/complete`

Retain current legacy key merge behavior for:

- old: `recl3sAfLo4pnplMO`
- new: `recOvUU9hnSiqpjgU`

and future mappings via env var:

- `PROGRESS_LEGACY_MERGE_JSON`

## Phased Delivery Plan

## Phase 0 - Bootstrap (1-2 days)

- Initialize `standalone-app/` (Next.js, TypeScript, Tailwind).
- Create shared UI primitives matching current block styling.
- Add `.env.local.example` with Airtable + progress API vars.

Exit criteria:

- App boots locally with base layout and route shell pages.

## Phase 1 - Functional Parity (3-5 days)

- Port routes in this order:
  1. `/my-learning`
  2. `/my-learning-tracks`
  3. `/track-view`
  4. `/course-detail`
  5. `/section-detail`
- Match current behavior exactly (including query params).

Exit criteria:

- Alyssa test path works end-to-end in standalone app.

## Phase 2 - Hardening (2-4 days)

- Add runtime validation and robust error boundaries.
- Add loading skeletons and empty states where Softr previously handled timing.
- Add analytics and structured logging.
- Optional: replace raw `personId` in URL with signed short-lived session token.

Exit criteria:

- Stable QA pass + no regressions in progress tracking.

## Phase 3 - Soft Launch / Cutover (1-2 days)

- Deploy standalone app under a new subdomain (example: `learn.lnartistservices.app`).
- Keep Softr app live.
- Switch a small pilot group first.
- Keep one-click rollback to Softr URL.

Exit criteria:

- Pilot users complete courses without blockers.

## QA Matrix (Must Pass Before Cutover)

Use Alyssa as baseline test user:

- old person ID: `recl3sAfLo4pnplMO` (legacy)
- new Contacts ID: `recOvUU9hnSiqpjgU` (current)
- assignment sample: `recM212nS82qMZd10`

Test flows:

1. Email login resolves to new Contacts `personId`.
2. Assigned tracks appear and are filtered correctly.
3. Existing legacy progress appears after merge.
4. Continue opens correct next section.
5. Section view increments progress.
6. Completion sets `completedAt`.
7. Survey prefill includes both Personnel and Contact params.

## Risks and Mitigations

- **Airtable field drift** -> centralize field mapping constants and fallback names.
- **Progress key mismatch** -> keep legacy merge map in API and config env.
- **UX regressions from CSS differences** -> snapshot compare key pages before go-live.
- **Auth exposure via raw `personId` URL** -> phase 2 signed-session hardening.

## What This Means for Softr Right Now

No immediate Softr page changes are required for this plan. Softr remains your intact fallback while the standalone app is built in parallel.

## Recommended Immediate Next Step

If you approve this plan, next action is scaffolding `standalone-app/` with route shells and shared UI primitives, then porting `/my-learning` and `/my-learning-tracks` first for a visible parity checkpoint.
