# Learning Tracks App – Architecture & Flow (Step-by-Step)

This document explains how the app works end-to-end, what stack and infrastructure is involved at each step, and how data flows. It starts from the "My Learning" login page where the user enters their email.

---

## Stack Overview

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend / hosting** | **Softr** | No-code app builder. Hosts the site (e.g. `lnartistservices.softr.app`). Renders pages and runs **Custom Code** blocks (React/TypeScript) that you paste in. |
| **Data source (CMS)** | **Airtable** | Backend database. Tables: **All Personnel**, **Assignments**, **Learning Tracks**, **Courses**, **Training Sections**, etc. Softr connects to Airtable via its own integration; Custom Code blocks use Softr’s **datasource** (e.g. `useRecords`, `useRecord`, `q.select()`) which reads from the block’s mapped Airtable table/view. |
| **Progress storage** | **Upstash Redis** | Key-value store for “last section viewed” and “course completed” per person. No progress tables in Airtable. |
| **Progress API** | **Netlify Functions** | Serverless HTTP API. Rewrites: `/api/progress` (GET), `/api/section-view` (POST), `/api/complete` (POST). Runs in Netlify; reads/writes Redis. Deployed from repo `Softr-Learning-Tracks-Webhook-Proxy`. |
| **Custom Code** | **React + TypeScript/JSX** | Logic and UI for: My Learning entry, My Learning Tracks list/profile, Track Detail, Course Detail, Section Content. Pasted into Softr Custom Code blocks; each block has **one** Airtable data source (table) configured in Softr. |

There is **no separate “backend” app**. Auth is “email lookup” only (no passwords). Identity is the **Airtable record ID** of the person (e.g. `recl3sAfLo4pnplMO`), passed as `personId` in the URL and used for progress and assignments.

---

## Step 1: My Learning login page (email entry)

**URL (example):** `https://yoursite.softr.app/my-learning`

**What happens**

1. User lands on the **My Learning** page. In Softr this is a page whose **slug** is `/my-learning`.
2. The page contains a **Custom Code** block. The code is from **`Softr-Learning-Tracks-MyLearningEntry.tsx`**. The block’s **data source** in Softr is set to the **All Personnel** table (or a view of it).
3. **On load:** The block uses Softr’s datasource API:
   - `useRecords({ select: personnelSelect, count: 2000 })` with a select that asks for fields like `email`, `recordId`, `Email Address`, etc.
   - Softr (under the hood) calls **Airtable** (via Softr’s Airtable connection) to fetch records from the block’s data source. The block does **not** call Airtable directly; it uses `@/lib/datasource` (Softr-provided), which returns paginated data (e.g. `pages`, `items`).
4. The block normalizes the response into an array `allPersonnel` and, in debug mode, can log sample emails. **Important:** Softr often returns only the first 100 (or first page of) records. For large bases, the block’s data source should be a **view** filtered to relevant personnel (e.g. those with assignments) so the person’s email is in the set that Softr returns.
5. User types their **email** and submits the form.
6. **Submit handler:** The block finds a personnel record whose email (after normalizing: trim, lowercase) matches the entered value. Email is read from the record using multiple possible field names: `email`, `Email`, `emailAddress`, `workEmail`, etc.
7. If **no match:** Show error (“We couldn’t find your profile…”). If **multiple matches:** Show error. If **exactly one match:** The block reads that record’s **record id** (e.g. `first.id` or `first.fields.RecordID`). This is the Airtable record ID (e.g. `recl3sAfLo4pnplMO`). No password is checked; identity is “whoever has that email in All Personnel.”
8. **Redirect:** The browser is sent to:
   - `https://yoursite.softr.app/my-learning-tracks?personId=recl3sAfLo4pnplMO`
   So the “session” is just the `personId` in the URL (and optionally in `sessionStorage` later for passing to Track View).

**Stack / infrastructure in this step**

- **Softr:** Serves the page and runs the Custom Code block.
- **Airtable:** Source of All Personnel records (email, RecordID). Softr fetches data; the block only sees what Softr’s `useRecords` returns.
- **Browser:** Form state and redirect; no separate auth server.

---

## Step 2: My Learning Tracks page (list of assigned tracks)

**URL:** `https://yoursite.softr.app/my-learning-tracks?personId=recl3sAfLo4pnplMO`

**What happens**

1. The **My Learning Tracks** page in Softr typically has **two** Custom Code blocks:
   - **Profile block** (e.g. `Softr-Learning-Tracks-MyLearningTracksProfile.tsx`): Data source = **All Personnel**. It uses `useRecord({ recordId: personId })` so Softr fetches the **single** personnel record for the current `personId` (from the URL). It displays name, photo, title, etc., and a “Back” that goes to `/my-learning`.
   - **List block** (e.g. `Softr-Learning-Tracks-MyLearningTracksList.tsx`): Data source = **Assignments**. It uses `useRecords({ select: assignmentsSelect, count: 500 })` so Softr fetches **Assignments** records. The block then filters these in memory to assignments where the **Personnel** link matches the current `personId`, and groups by **Track** to show one card per track.
2. **Progress for the list:** So that each card can show “X of Y courses complete” and a progress bar, the list block:
   - Reads `personId` from the URL (and optionally from `sessionStorage`).
   - Calls the **progress API**: `GET https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=recl3sAfLo4pnplMO` (or whatever `PROGRESS_API_URL` is set in the block). This is a **direct HTTP request from the browser** to the Netlify-hosted API.
   - The progress API (see below) returns JSON whose **keys are Airtable Course record IDs** (e.g. `recAMazBg1XxY7j0D`), not placeholder names. Example: `{ "recAMazBg1XxY7j0D": { "lastViewedIndex": 10, "startedAt": "...", "completedAt": null }, "recWjP429S5DUjiUx": { "lastViewedIndex": 2, ... } }`. The block matches these keys to the course IDs from the track’s Courses link / Assignments to compute “X of Y courses complete” and per-course %.
3. For each track card the block may also call `useRecord({ recordId: trackId, select: trackCoursesSelect })` (one per visible track) to get that track’s **Courses** link so it can match progress keys to courses and show “Continue” or “Start.”
4. **Continue / Start / Review:** Clicking a button builds a URL to **Track View** (e.g. `/track-view?recordId=recTrackId&personId=recl3sAfLo4pnplMO`) and optionally writes progress to `sessionStorage` before navigating, so the next page can show progress even before the progress API response arrives.

**Stack / infrastructure**

- **Softr:** Page + both blocks; runs React and datasource calls.
- **Airtable:** All Personnel (profile), Assignments (list). Assignments has links to Personnel, Course, Track; optional lookups like Learning Track Title, Total Sections.
- **Browser:** `personId` from URL; optional `sessionStorage` for `lms_progress_data`, `lms_track_personId`, `lms_track_recordId`.
- **Netlify (progress API):** GET `/api/progress?personId=...` → reads from Redis and returns progress JSON.

---

## Step 3: Track View / Track Detail page

**URL:** `https://yoursite.softr.app/track-view?recordId=rec5SlxfYgT2Aw88d&personId=recl3sAfLo4pnplMO`

**What happens**

1. The **Track View** page in Softr uses a **Custom Code** block whose data source is **Learning Tracks**. The code is **`Softr-Learning-Tracks-Page2-TrackDetail.tsx`**.
2. **Params:** The block reads `recordId` and `personId` from the URL (and optionally from `sessionStorage` or `window.parent.location` if embedded). `recordId` is the Learning Track record; `personId` is the same as on My Learning Tracks.
3. **Track data:** It uses `useRecord({ recordId: selectedTrackId, select: trackDetailSelect })` so Softr fetches that **one** Learning Track record (title, description, image, **Courses** link, Course Count, etc.). It also uses `useRecords({ select: trackDetailSelect, count: 200 })` and finds the selected track in the result as a fallback. **Important:** In Softr you can only set **one** data source per block; this block’s source is **Learning Tracks**. So all `useRecord` / `useRecords` in this block are backed by the same Learning Tracks table (or the same view). There is no separate “Courses table” data source on this page; course lists come from the track’s **Courses** link (and optionally from another `useRecords` that still runs against the same base and may return tracks if the block only has Learning Tracks as source).
4. **Progress:** The block calls `GET PROGRESS_API_URL?personId=...` (same Netlify progress API). It may also read `sessionStorage` for `lms_progress_data` so that progress appears immediately when coming from “Continue” on My Learning Tracks. Progress is keyed by **course record id**; each course card shows a percentage derived from `lastViewedIndex` and (when available) section count or `completedAt`.
5. **Overall bar:** “X of Y courses complete” and the big progress % are computed from how many courses have `completedAt` (or are 100% by section count) out of the track’s courses.
6. Clicking a course goes to **Course Detail** with `recordId` (course), `trackId`, and `personId` in the URL.

**Stack / infrastructure**

- **Softr:** Page + block; data source = Learning Tracks.
- **Airtable:** Learning Tracks (and linked Courses for the track). No Courses table as a separate block data source here.
- **Browser:** URL params; `sessionStorage` for passing progress to this page.
- **Netlify:** GET `/api/progress` for progress read.

---

## Step 4: Course Detail page

**URL:** `https://yoursite.softr.app/course-detail?recordId=recAMazBg1XxY7j0D&trackId=rec5SlxfYgT2Aw88d&personId=recl3sAfLo4pnplMO` (recordId = Course record ID, trackId = Learning Track record ID)

**What happens**

1. The **Course Detail** page uses a Custom Code block (e.g. **`Softr-Learning-Tracks-Page3-CourseDetail.tsx`**) with data source **Courses**.
2. The block reads `recordId` (course), `trackId`, and `personId` from the URL (once, e.g. with `useMemo(getParamsFromUrl, [])`).
3. It uses `useRecord({ recordId: courseIdFromUrl, select: coursesSelect })` so Softr fetches that **one** Course record (title, Training Sections link, etc.). Section list is built from the course’s **Training Sections** link; section order and IDs are used to compute “last viewed” and “Continue from Section X.”
4. It fetches progress with `GET PROGRESS_API_URL?personId=...` and maps the result to this course’s `recordId` to get `lastViewedIndex`. Progress % = (lastViewedIndex + 1) / totalSections * 100.
5. Clicking a section goes to **Section Detail** with `recordId` (section), `courseId`, `trackId`, `personId`, and optionally `sectionIds` in the URL.

**Stack / infrastructure**

- **Softr:** Page + block; data source = Courses.
- **Airtable:** Courses (and linked Training Sections).
- **Netlify:** GET `/api/progress` for progress.

---

## Step 5: Section Content (viewing a section and recording progress)

**URL (example):** Section detail page with `recordId`, `courseId`, `trackId`, `personId`, `sectionIds` in the query string.

**What happens**

1. The **Section Content** block (e.g. **`Softr-Learning-Tracks-Page4-SectionContent.jsx`**) has data source **Training Sections**. It uses `useRecord({ recordId: sectionIdFromUrl, select: sectionSelect })` to load the current section (title, body, video, survey link, etc.).
2. **Recording a view:** When the user is on a section, the block calls `recordSectionView(personId, courseId, sectionIds, viewedSectionId)`:
   - It builds a payload `{ personId, sectionId, courseId, viewedAt, lastViewedIndex }` where `lastViewedIndex` is the 0-based index of the viewed section in the course’s section list.
   - It **POSTs** to `SECTION_VIEW_WEBHOOK_URL`, i.e. `https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view`. So the **browser** sends the POST to Netlify.
3. **Netlify `section-view` function:** Receives the POST, reads `personId`, `courseId`, `lastViewedIndex`. It loads from **Redis** the key `progress:{personId}` (value = object of courseId → `{ lastViewedIndex, startedAt, completedAt }`). It updates only that course’s entry if the new `lastViewedIndex` is greater, then writes the object back to Redis. No Airtable write.
4. **Marking course complete:** When the user completes the course (e.g. last section or a “Mark complete” action), the block can POST to `COMPLETE_API_URL` (`/api/complete`) with `{ personId, courseId }`. The **Netlify `complete` function** sets `completedAt: new Date().toISOString()` for that course in the same Redis key and saves. That drives “100% complete” and “X of Y courses complete” elsewhere.
5. Prev/Next and “Back to course” use the same URL params so the user can navigate without losing `personId`/`courseId`.

**Stack / infrastructure**

- **Softr:** Section page + block; data source = Training Sections.
- **Airtable:** Training Sections (section content only; progress is not stored here).
- **Browser:** Sends POST to Netlify for section-view and complete.
- **Netlify:** POST `/api/section-view`, POST `/api/complete` → read/update **Redis** (Upstash).

---

## Progress API and Redis (infrastructure detail)

**Redis key format (one key per person):**

- **Redis key:** `progress:{personId}` where `personId` is the Airtable **Personnel** record ID (e.g. `recl3sAfLo4pnplMO`).
- **Redis value:** A single JSON object. **Property names inside that object are Airtable Course record IDs** (e.g. `recAMazBg1XxY7j0D`), not generic labels like “recCourseId1”. The front end and the section-view/complete APIs all use the real course `recordId` from Airtable when reading/writing.

Example value for one person (what you’ll see in Redis):

```json
{
  "recAMazBg1XxY7j0D": {
    "lastViewedIndex": 10,
    "startedAt": "2026-02-13T18:46:03.650Z",
    "completedAt": null
  },
  "recWjP429S5DUjiUx": {
    "lastViewedIndex": 2,
    "startedAt": "2026-02-13T19:23:30.587Z",
    "completedAt": null
  },
  "recE994DGOUVNwR0L": {
    "lastViewedIndex": 0,
    "startedAt": "2026-02-14T05:17:03.932Z"
  }
}
```

So: **there is no naming bug.** The keys in that object are the actual Course record IDs. The app matches them to the course IDs from the Learning Track’s Courses link (and from Assignments) to show progress.

**Netlify project:** `Softr-Learning-Tracks-Webhook-Proxy` (or similar). Repo contains:

- **`netlify/functions/progress.mjs`** – GET handler.
  - Query: `?personId=recXXX` (optional `wipe=1` to delete).
  - Uses **Upstash Redis**: `Redis.fromEnv()` (env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
  - Key: `progress:{personId}`. Value: JSON object `{ [courseRecordId]: { lastViewedIndex, startedAt?, completedAt? } }` where each key is an Airtable Course record ID.
  - Returns that object as JSON; CORS allows `*` so the Softr app (different origin) can call it.
- **`netlify/functions/section-view.mjs`** – POST handler.
  - Body: `{ personId, courseId, lastViewedIndex }`.
  - Loads `progress:{personId}` from Redis, updates the entry for `courseId` if the new `lastViewedIndex` is higher, sets `startedAt` if not set, writes back to Redis.
- **`netlify/functions/complete.mjs`** – POST handler.
  - Body: `{ personId, courseId }`.
  - Sets `completedAt` for that course in `progress:{personId}` and saves.

**`netlify.toml`** rewrites:

- `/api/progress` → `/.netlify/functions/progress`
- `/api/section-view` → `/.netlify/functions/section-view`
- `/api/complete` → `/.netlify/functions/complete`

So the Softr blocks use a single base URL (e.g. `https://softr-learning-tracks-webhook-proxy.netlify.app`) and paths `/api/progress`, `/api/section-view`, `/api/complete`.

**No Airtable webhooks** are required for progress. Progress is stored only in Redis and read/written via this Netlify API.

---

## Data flow summary

```
[User] → My Learning (Softr) → enter email
         ↓
         Softr useRecords(All Personnel) ← Airtable (All Personnel)
         ↓
         Match email → get record id (personId)
         ↓
         Redirect to /my-learning-tracks?personId=...
         ↓
[User] → My Learning Tracks (Softr)
         ↓
         useRecords(Assignments) ← Airtable (Assignments)
         GET /api/progress?personId=... → Netlify → Redis (read)
         ↓
         Show track cards + “X of Y courses complete”, progress %
         ↓
         Click Continue → /track-view?recordId=...&personId=...
         ↓
[User] → Track View (Softr)
         ↓
         useRecord(Learning Tracks) ← Airtable (Learning Tracks)
         GET /api/progress?personId=... → Netlify → Redis (read)
         ↓
         Show course cards + overall “X of Y courses complete”
         ↓
         Click course → /course-detail?recordId=...&trackId=...&personId=...
         ↓
[User] → Course Detail (Softr)
         ↓
         useRecord(Courses) ← Airtable (Courses + Training Sections)
         GET /api/progress?personId=... → Netlify → Redis (read)
         ↓
         Click section → Section detail URL with personId, courseId, sectionIds...
         ↓
[User] → Section Content (Softr)
         ↓
         useRecord(Training Sections) ← Airtable (Training Sections)
         POST /api/section-view { personId, courseId, lastViewedIndex } → Netlify → Redis (write)
         (Optional) POST /api/complete { personId, courseId } → Netlify → Redis (write)
```

---

## File-to-page mapping (for your dev)

| Step / page | Softr slug | Block data source | Code file |
|-------------|------------|-------------------|-----------|
| Login | `/my-learning` | All Personnel | `Softr-Learning-Tracks-MyLearningEntry.tsx` |
| My Learning Tracks (profile) | `/my-learning-tracks` | All Personnel | `Softr-Learning-Tracks-MyLearningTracksProfile.tsx` |
| My Learning Tracks (list) | `/my-learning-tracks` | Assignments | `Softr-Learning-Tracks-MyLearningTracksList.tsx` |
| Track View / Detail | `/track-view` | Learning Tracks | `Softr-Learning-Tracks-Page2-TrackDetail.tsx` |
| Course Detail | `/course-detail` | Courses | `Softr-Learning-Tracks-Page3-CourseDetail.tsx` |
| Section Content | (section detail page) | Training Sections | `Softr-Learning-Tracks-Page4-SectionContent.jsx` |

Progress API (separate repo/deploy): `Softr-Learning-Tracks-Webhook-Proxy` (Netlify + Redis).

---

## Where to check course IDs

Course IDs are **Airtable Course record IDs** (e.g. `recAMazBg1XxY7j0D`). They must match between Airtable, the app, and Redis. Here’s where they come from and where to verify them.

### 1. Airtable (source of truth)

- **Learning Tracks table** – Field **Courses** (linked to Courses). Each linked record has an Airtable record ID. Those IDs are the course IDs used for the track’s progress.
- **Assignments table** – Field **Course** (or **Course ID**) linked to Courses. The linked record’s ID is the course ID for that assignment.
- **Courses table** – Each row has a record ID (visible in the UI or via API). That same ID is what gets stored in Redis when the user views sections.

**How to see them in Airtable:** Open the Courses table and note the record IDs (e.g. from the record URL or an “Record ID” field if you added one). Then in Learning Tracks, open a track and look at the Courses link – those linked records should be the same IDs. Compare that list to the keys in Redis for that person.

### 2. In the app (where the code gets course IDs)

| Place | File | How course IDs are obtained |
|-------|------|-----------------------------|
| **Track Detail** | `Softr-Learning-Tracks-Page2-TrackDetail.tsx` | From the **selected Learning Track** record: `selectedTrack?.fields?.courses` (or `fields?.Courses`). Each linked record is turned into an ID via `getLinkedRecordId(c)` (around lines 416–418). So the IDs come from the track’s **Courses** link in Airtable. |
| **My Learning Tracks list** | `Softr-Learning-Tracks-MyLearningTracksList.tsx` | From **Assignments** and **Track** records: (1) Track’s `courses` / `Courses` link → `getLinkedRecordId(c)` (lines 286–288, 326–328). (2) Assignment’s `course` / `Course` link → `getLinkedRecordId(...)` (line 329). Merged per track into `courseIds` (lines 330–336). |
| **Course Detail** | `Softr-Learning-Tracks-Page3-CourseDetail.tsx` | From the **URL**: `recordId` on the course-detail page *is* the course ID (`courseIdFromUrl` at line 80). So whatever is in `?recordId=...` on `/course-detail` is the course ID used for progress lookup and for building section links. |
| **Section Content** | `Softr-Learning-Tracks-Page4-SectionContent.jsx` | From the **URL**: `courseId = params.get("courseId")` (around line 40). That value is passed to `recordSectionView(personId, courseId, ...)` and `recordCourseComplete(personId, courseId)`, and is the same ID sent in the POST body to `/api/section-view` and `/api/complete`. So the course ID that gets written to Redis is exactly the `courseId` query param on the section page. |

**Chain:** Track Detail builds links to Course Detail with `recordId={courseId}` (course Airtable id). Course Detail builds links to Section Content with `courseId={courseIdFromUrl}`. Section Content reads `courseId` from the URL and sends it to the progress API. So the ID that lands in Redis is the same Airtable Course record ID that came from the track’s Courses link (or assignment’s Course link) and was put in the URLs.

### 3. In the browser (quick checks)

- **Course Detail URL:** When you open a course, the URL should look like  
  `.../course-detail?recordId=recAMazBg1XxY7j0D&trackId=...&personId=...`  
  The `recordId` value is the course ID. Compare it to the keys in Redis.
- **Section page URL:** Should include `courseId=recAMazBg1XxY7j0D` (same ID). That’s the value sent when recording a section view.
- **Network tab:** When viewing a section, find the POST to `.../api/section-view`. In the request payload you should see `personId`, `courseId`, `lastViewedIndex`. The `courseId` there must match an Airtable Course record ID and will appear as a key in Redis under `progress:{personId}`.
- **Console (Track Detail):** The block logs a warning with `courseIdsSample: courseIds.slice(0, 3)` when the filter matches 0 records (lines 454–458). That shows the first few course IDs the block is using for progress lookup; they should match the keys in the progress API response and in Redis.

If progress shows 0% or the wrong course, compare: (1) Learning Track’s Courses link IDs in Airtable, (2) `recordId` on the course-detail URL and `courseId` on the section URL, (3) keys in the progress API response for that `personId`, (4) keys in Redis for that person. They should all be the same set of Course record IDs.

---

## Important constraints (for your dev)

1. **One data source per block:** In Softr, each Custom Code block is bound to **one** Airtable table (or view). So the Track Detail block cannot have a “Courses” table as a second source; it only has Learning Tracks. Course list there comes from the track’s **Courses** link and from the same base’s APIs as Softr provides.
2. **Identity = person record id:** There is no login server or JWT. The app treats “current user” as the `personId` in the URL (and sometimes in `sessionStorage`). Anyone with the link can act as that user; the app is for internal/trusted use.
3. **Progress only in Redis:** Section views and completion are written to Redis via the Netlify API. Airtable has no “Section Views” or “Progress” table used by this flow (optional reporting can be added separately).
4. **CORS:** The progress API sends `Access-Control-Allow-Origin: *` so the Softr app (different origin) can call it from the browser.

This should give your dev a clear, step-by-step picture of the stack and data flow from the My Learning email screen through to section views and progress.
