# Airtable Setup for My Learning Tracks, Progress, and Assignments

Use this in your **Artist Services Surveys** base. Create these tables and fields so the My Learning Tracks flow, progress tracking, and assignments work.

---

## 1. All Personnel (existing)

Ensure the table has:

| Field name | Type | Notes |
|------------|------|--------|
| Email | Email or Single line text | Used to look up the person on the "Enter your email" entry page. |
| RecordID | Formula or Single line text | **Use the current base’s record ID** (e.g. Airtable’s built-in Record ID or a formula). Do not use a synced field from another base (those IDs may not match). The app uses this (or the record id `recXXX`) as `personId` in URLs. |

For the **My Learning Tracks profile** (name, photo, title, venues), ensure All Personnel also has: **Name**, **Photo**, **Title**, and **BEC Venue** (see table above; add those rows if needed).

The app uses the **Airtable record id** (e.g. `recXXXXXXXXXXXXXX`) as `personId` in URLs. Expose it in a **RecordID** field in this base so the block can read it.

**If you have more than 100 personnel:** Softr often returns only the first 100 records to the block. Point the My Learning Entry block’s data source to a **view** that either (a) filters to personnel who have at least one assignment, or (b) is sorted so the first 100 rows include everyone who may log in. Otherwise some users will get “We couldn’t find your profile” even with a correct email.

---

## 2. Assignments (new table)

Create a table **Assignments** with:

| Field name | Type | Purpose |
|------------|------|--------|
| Personnel | Link to another record → **All Personnel** | Who is assigned. |
| Course | Link to another record → **Courses** | Which course. |
| Track | Link to another record → **Learning Tracks** (optional) | Filled manually or by automation so "My" track list can filter by track without joining through Courses. |
| Due Date | Date | When the assignment is due. |
| Status | Single select | e.g. `Not Started`, `In Progress`, `Completed`. Used for progress and to show "Completion Date" when completed. |
| Completion Date | Date (optional) | When the assignment was completed. If present and Status = Completed, the app shows "Completion Date" instead of "Due" on the track card. |
| Assigned At | Created time (or Date) | When the assignment was created; use in automations for Due Date. |

- One row per person per course (Personnel + Course should be unique).
- **Track** can be set by an Airtable Automation: when a record is created, look up the Course’s parent track (if Courses is linked to Learning Tracks) and set Track.
- **Due Date** can be set by automation, e.g. "When record is created in Assignments, set Due Date = Assigned At + 30 days."
- **Track title on My Learning Tracks:** If the Assigned Tracks list shows "Untitled Track", add a **Lookup** field on Assignments: look up from **Track** the field **Learning Track Title**, and name the lookup field **Learning Track Title**. The app will then show the track name on the card.
- **Section count (e.g. "0 of 12"):** Add one **Lookup** on Assignments: from **Track**, look up a field that has the track’s total course/section count, and name the lookup **Total Sections**. On Learning Tracks you can add a formula or rollup that counts courses (or sections). Then the Assigned Tracks card will show "0 of 12 sections" instead of "0 of 1".

### Optional: Automate Due Date

- **Airtable Automation:** Trigger = "When record is created in Assignments." Action = "Update record" in Assignments: set Due Date to a formula or to "Assigned At + 30 days" (use a formula field or a script extension if you need dynamic days).

### Optional: Auto-create assignments

- **Airtable Automation:** Trigger = e.g. "When record is added to All Personnel" or "When [Role/Venue] = X." Action = "Create record in Assignments" for a fixed list of courses (or use a "Required courses" table linked to Personnel/Role).

---

## 3. Section Views (for cross-device progress)

Create a table **Section Views** and a way to **read** progress (see below). The app sends each section view to a webhook so progress can sync across devices (e.g. start on phone, continue on computer).

| Field name | Type | Purpose |
|------------|------|--------|
| Personnel | Link to another record → **All Personnel** | Who viewed. |
| Section | Link to another record → **Training Sections** | Section that was viewed. |
| Course | Link to another record → **Courses** | Course context. |
| Viewed At | Date with time (or Created time) | When the section was viewed. |
| **Section Index** | **Number** | 0-based index of that section in the course (from webhook `lastViewedIndex`). Required so the progress API can derive progress from Section Views. |

**Webhook (write):** In the **Section Content** block, set `SECTION_VIEW_WEBHOOK_URL` to a URL that receives POSTs with:
`{ personId, sectionId, courseId, viewedAt, lastViewedIndex }`. Use Make.com, Zapier, or an Airtable automation to create a Section Views record. Use **Airtable** (Webhook received), **Zapier**, or **Power Automate** – see **PROGRESS-SETUP-GUIDE.md**. No separate Progress table is required.

**Progress API (read):** Expose a **GET** endpoint that accepts `?personId=recXXX` and returns JSON `{ "recCourseId1": 2 }` (max Section Index per course from Section Views). Set `PROGRESS_API_URL` in Page2, Page3, and My Learning Tracks List. See **PROGRESS-SETUP-GUIDE.md**. If `PROGRESS_API_URL` is empty, the app uses **localStorage** (same device only).

---

## 4. Survey / completion tables and form setup (completion requirements)

For each course that has a **Submission** (survey) section, the form must identify the person so completions can be tied to their record.

### 4.1 Response table

- Add a **Link to All Personnel** (or a single-line field **Personnel Record ID** or **Email**) so each submission is tied to a person.
- Optional: **Course** (link) or **Section** (link) so the app can query “has this person completed this course’s survey?”

### 4.2 Form pre-fill (hidden field)

- In the **form** (Softr form or Airtable form), add a **hidden field** that stores the current user’s Personnel record id (or email).
- The Section Detail block opens the survey URL with query params so the form can pre-fill that field:
  - `personId=<All Personnel record id>` (e.g. `recXXXXXXXXXXXXXX`)
  - `prefill_Personnel%20Record%20ID=<same id>` (for Softr/Airtable form pre-fill if the field name is “Personnel Record ID”)
- In your form settings, map the hidden field to the URL parameter (e.g. `personId` or the prefill parameter your platform uses). Then submissions will have the correct link to All Personnel.
- Document which form (and response table) maps to which course/section so you can query “has this person completed this section?” for progress and completion logic.

**Placeholder:** Until survey response tables are set up, the app only pre-fills the survey URL with `personId` (and optional prefill params). Completion checks and progress that depend on "survey submitted" are not yet wired; add those once each course's response table exists and links to All Personnel.

---

## 5. Summary

| Table | Action |
|-------|--------|
| All Personnel | Ensure **Email** (and optional RecordID) exists. |
| Assignments | **Create** with Personnel, Course, optional Track, Due Date, Status, optional Completion Date, Assigned At. |
| Section Views | **Create** if you use webhook-based progress (optional). |
| Survey response tables | Add **link to All Personnel** (or Personnel Record ID / Email) and optional Course/Section. |

After this setup, use the Softr pages and Custom Code blocks as described below.

---

## 6. Softr pages and blocks (implementation summary)

| Page | Slug (example) | Block data source | What to paste |
|------|-----------------|-------------------|----------------|
| My Learning (entry) | `/my-learning` | **All Personnel** | `Softr-Learning-Tracks-MyLearningEntry.tsx` |
| My Learning Tracks | `/my-learning-tracks` | **All Personnel** (1st block) | `Softr-Learning-Tracks-MyLearningTracksProfile.tsx` – name, photo, title, venues, Back button. |
| My Learning Tracks | `/my-learning-tracks` | **Assignments** (2nd block) | `Softr-Learning-Tracks-MyLearningTracksList.tsx` – assigned tracks, due/completion date, progress, Start/Continue/Review. |
| Learning Tracks (management) | `/learning-tracks` | Learning Tracks | Existing Page1 – unchanged. |
| Track Detail | `/track-detail` | Learning Tracks | `Page2-TrackDetail.tsx` – for when user clicks from Learning Tracks list. |
| **Track View** | **`/track-view`** | **Learning Tracks** | **Same `Page2-TrackDetail.tsx`**. For "Start" from My Learning Tracks. Add a **List** block (Learning Tracks, can hide with CSS or show all) so the page has data context; then add the **Custom Code** block below it, data source Learning Tracks. |
| Course Detail | `/course-detail` | Courses | Updated `Page3-CourseDetail.tsx` – reads `personId`, progress and Continue from localStorage. |
| Section Detail | `/section-detail` | Training Sections + Resource Library | Updated `Page4-SectionContent.jsx` and `Page4-ResourceLibraryBlock.tsx` – record section view (localStorage), pass `personId`, survey URL with pre-fill params. |

- **Progress:** Set `SECTION_VIEW_WEBHOOK_URL` in the **Section Content** block so each section view is POSTed to your webhook (payload includes `personId`, `sectionId`, `courseId`, `viewedAt`, `lastViewedIndex`). Create the **Section Views** table and wire the webhook to it. For progress to show on Track Detail, Course Detail, and My Learning Tracks (and across devices), set `PROGRESS_API_URL` in those blocks to a GET API that returns `{ [courseId]: lastViewedIndex }` for the given `personId`. If `PROGRESS_API_URL` is not set, the app uses **localStorage** (same browser only).- **Assignments filter:** My Learning Tracks list shows tracks that have at least one assignment for the person. Track Detail and Course Detail do not filter courses by assignment (all courses in the track are shown); pass `personId` so progress is still tracked.
