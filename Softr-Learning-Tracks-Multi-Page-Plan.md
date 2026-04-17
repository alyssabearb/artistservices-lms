# Softr Learning Tracks: Multi-Page Custom Code Plan

Same UI and behavior as the original single-block design (filters, cards, progress bars, section-by-section with prev/next, resource cards by type), but **split into three pages**. Each page has **one Custom Code block** and no native List/Item Details/Linked List blocks.

---

## URL pattern (Softr record detail)

- Detail pages use: **`?recordId=XXXXX`** (e.g. `https://yourapp.softr.app/track-detail?recordId=recABC123`).
- In custom code, navigate by setting `window.location.href` to the target page slug + query string, e.g. `/track-detail?recordId=${trackId}`.
- Read the current record on load:  
  `const recordId = new URLSearchParams(window.location.search).get('recordId');`

---

## Page structure (3 pages, 3 custom code blocks)

| Page | Slug (example) | URL | Block data source | What the custom code does |
|------|----------------|-----|-------------------|----------------------------|
| **1. Learning Tracks** | `/learning-tracks` | No query params | **Learning Tracks** | Tracks list, filters (venue, audience, year), track cards. "Start" → go to Track Detail with `?recordId={trackId}`. |
| **2. Track Detail** | `/track-detail` | `?recordId={trackId}` | **Learning Tracks** | Read `recordId` from URL → load that track. Same layout: back link, track header, image, description, duration, progress, **course cards**. "Start/Continue Course" → go to Course Detail with `?recordId={courseId}&trackId={trackId}`. |
| **3. Course Detail** | `/course-detail` | `?recordId={courseId}&trackId={trackId}` | **Courses** | Read `recordId` (course) and `trackId` from URL. Load course (useRecord). Same layout: back to track, course header, progress, **sections** (one at a time, prev/next), section content by type, resource cards. "Back" → go to Track Detail with `?recordId={trackId}`. |

**Important:** Page 3’s Custom Code block must be connected to the **Courses** table (not Learning Tracks) so `useRecord(recordId)` returns the course and linked **Training Sections** are available (e.g. `course.fields.trainingSections`). That fixes “No training sections” on the course page.

---

## 1) Page 1: Learning Tracks (list)

**URL:** `/learning-tracks` (or your chosen slug)

**Custom Code block:** Connect to **Learning Tracks** table.

**UI (same as original):**
- Title: “Backstage Learning Tracks Home”, subtitle.
- Filters: Venue Type (All Venues, Amphitheater, Club & Theater), Audience (All, New, Returning), Year (All, 2025, 2026, Evergreen).
- Grid of track cards: image, title, description, section count, **Start** button.

**Behavior:**
- `useRecords` with your tracks select (title, description, image, audiences, venueType, courses, recordId, year). Filter client-side by selected venue, audience, year.
- **Start** click: navigate to Track Detail and pass the track’s id in the URL.  
  Use the **exact URL of your Track Detail page** in Softr, e.g.:  
  `window.location.href = '/track-detail?recordId=' + encodeURIComponent(trackId);`  
  or, if Softr uses full paths:  
  `window.location.href = window.location.origin + '/track-detail?recordId=' + encodeURIComponent(trackId);`  
  Use whichever id your block has for the track (e.g. `track.id` or `track.fields.recordId`), and use the same when reading on Page 2.

**Code to extract from original:** Only the “main tracks listing view”: state for filters, `useRecords` for tracks, filter logic, venue/audience/year options, track grid and card UI, and the click handler that navigates to Track Detail with `?recordId=...`.

---

## 2) Page 2: Track Detail (one track + course cards)

**URL:** `/track-detail?recordId={trackId}`

**Custom Code block:** Connect to **Learning Tracks** table.

**UI (same as original):**
- “Back to Learning Tracks” link → goes to `/learning-tracks`.
- Track: title, image, description, estimated duration, overall progress bar.
- “Courses (N)” list: each course card (image, title, description, duration, progress, “Start Course” / “Continue Course” / “Review Course”).

**Behavior:**
- On mount (or when URL changes), read `recordId` from query:  
  `const recordId = new URLSearchParams(window.location.search).get('recordId');`
- Use that as `selectedTrackId`: `useRecord({ recordId, select: trackDetailSelect })` to load the track.
- `courseIds` from `selectedTrack.fields.courses` (linked record ids).  
  `useRecords({ select: coursesSelect, where: courseIds.length > 0 ? q.text("recordId").isOneOf(courseIds) : undefined })` to load courses for this track (same as original).
- Match course cards to the track’s course list; each card’s button navigates to Course Detail with **both** course id and track id:  
  `window.location.href = '/course-detail?recordId=' + encodeURIComponent(courseId) + '&trackId=' + encodeURIComponent(recordId);`  
  so the Course page can show “Back to Learning Track” linking to this track.

**Code to extract from original:** “Track Detail View” only: back button, track header/image/description/duration, progress, course list from `useRecords` + courseIds, course cards, and navigation to Course Detail with `recordId` (course) and `trackId` (current track).

---

## 3) Page 3: Course Detail (one course + sections + resources)

**URL:** `/course-detail?recordId={courseId}&trackId={trackId}`

**Custom Code block:** Connect to **Courses** table (so the block can load the course and its linked Training Sections).

**UI (same as original):**
- “Back to Learning Track” link → `/track-detail?recordId=${trackId}` (use `trackId` from URL).
- Course: title, estimated duration, section count, course progress bar, section list (current section highlighted).
- Current section: title and content by Section Type (Text, Text + Links, Video, Checklist, Survey) with same layout as before; Previous Section / Next Section.
- Resource Library: same resource card layouts by Resource Type (Text, Contact, Video, PDF/Image, etc.) and Webinar RSVP date filter.

**Behavior:**
- Read from URL:  
  `const courseId = new URLSearchParams(window.location.search).get('recordId');`  
  `const trackId = new URLSearchParams(window.location.search).get('trackId');`
- Use `courseId` as `selectedCourseId`: `useRecord({ recordId: courseId, select: coursesSelect })` to load the **course**. Because the block is connected to **Courses**, this returns the course and its linked **Training Sections** (e.g. `course.fields.trainingSections`).
- Build `orderedSections` from `selectedCourse.fields.trainingSections` (normalize to `{ id, fields: { title, body, type, video, surveyLink, linkedResources } }` like in the original). No separate `useRecords` for sections needed if the API expands the link.
- Current section index in state; prev/next only change state (same page). Optionally sync to URL for deep link: `?recordId=...&trackId=...&section=0`.
- Resources: from current section’s `linkedResources`. If the block can query Resource Library by those ids, use that; otherwise use whatever the Courses block exposes for linked resources.

**Code to extract from original:** “Course Detail View” only: back button (using `trackId` from URL), course header, progress, section list, current section content by type, prev/next, resource cards. Replace any “selectedTrackId”/“selectedCourseId” state with values read from the URL on load.

---

## Data source per page (critical)

| Page | Block data source | Why |
|------|-------------------|-----|
| Learning Tracks | **Learning Tracks** | List and filter tracks. |
| Track Detail | **Learning Tracks** | `useRecord(recordId)` loads the track; `useRecords` for courses filtered by track’s course ids works in the same base. |
| Course Detail | **Courses** | `useRecord(recordId)` loads the course; linked **Training Sections** come from that course record so sections and resources can render without a separate block on another table. |

---

## Navigation summary

- **Learning Tracks** → “Start” on a track →  
  `/track-detail?recordId={trackId}`
- **Track Detail** → “Back to Learning Tracks” →  
  `/learning-tracks`
- **Track Detail** → “Start/Continue/Review Course” on a course →  
  `/course-detail?recordId={courseId}&trackId={trackId}`
- **Course Detail** → “Back to Learning Track” →  
  `/track-detail?recordId={trackId}`

Use your real Softr page slugs and origin if needed (e.g. `window.location.origin + '/track-detail?recordId=' + ...`).

---

## Implementation checklist

- [ ] In Softr: Create 3 pages (e.g. Learning Tracks, Track Detail, Course Detail) and set their slugs.
- [ ] Page 1: Add one Custom Code block; connect data source to **Learning Tracks**. Paste code for tracks list + filters + track cards; links to Track Detail use `?recordId=`.
- [ ] Page 2: Add one Custom Code block; connect data source to **Learning Tracks**. Paste code that reads `recordId` from URL, loads track + courses, renders track detail and course cards; links to Course Detail use `?recordId={courseId}&trackId={trackId}`; Back links to Learning Tracks.
- [ ] Page 3: Add one Custom Code block; connect data source to **Courses**. Paste code that reads `recordId` and `trackId` from URL, loads course, builds sections from `course.fields.trainingSections`, renders course detail + section-by-section UI + resources; Back links to Track Detail with `?recordId={trackId}`.
- [ ] Test: Tracks list → Track Detail (one track, courses) → Course Detail (one course, sections and resources).

---

## Next step: split the original code into three blocks

The original `Softr-Learning-Tracks-Block.tsx` can be split into three files (one per page):

1. **LearningTracksPage.tsx** – tracks list view only + navigation to track detail.
2. **TrackDetailPage.tsx** – track detail view only + read `recordId` from URL + navigation to course detail (and back to list).
3. **CourseDetailPage.tsx** – course detail view only + read `recordId` and `trackId` from URL + navigation back to track detail.

If you want, the next step is to produce these three code blocks so you can paste each into the corresponding Softr Custom Code block.
