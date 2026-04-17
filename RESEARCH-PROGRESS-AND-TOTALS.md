# Research: Progress 0% and "0 of 1" on Cards

## Note on data source and "Total Sections"

You do **not** add columns to Custom Code blocks in Softr. The Custom Code block's data source is already set to the **Assignments** table. The "Course Count" column in Airtable has been **renamed to "Total Sections"**; the code reads it for the card denominator.

---

## Best course of action (step-by-step)

1. **Ensure Assignments has "Total Sections" (renamed from Course Count)**  
   On the **My Learning Tracks** page, select the **second block** ("My Learning Tracks list"). It is connected to the **Assignments** data source. In that block’s settings, add the **"Total Sections"** column from the Assignments table so the block loads it. Save and publish.

2. **Run the diagnostic (browser console)**  
   Diagnostic logging is already added to the Custom Code in:
   - **My Learning Tracks list** (logs first assignment fields + Total Sections / Course Count + courseIds + apiProgress keys).
   - **Track Detail** (logs apiProgress keys, first course’s possibleIds, and whether any match).  
   Open the app with `?personId=...`, open **Developer Tools → Console** (F12), and look for lines starting with `[LMS Debug]`. Repeat after opening a track (Track View).

3. **Use the console output**  
   - If **Total Sections** or **Course Count** appear in the logged keys, note the exact key names and we can wire them in if needed.  
   - If **trackCourseIdsById** has course ids and **apiProgress** has keys, but Track Detail still shows 0%, compare the logged `possibleIds` with `apiProgress` keys to see why they don’t match.

4. **Remove the diagnostic code** once you’re done (search for `[LMS Debug]` and the `TEMPORARY` comments in the Custom Code blocks and delete that block).

---

## What you asked

1. **My Learning Tracks card** still shows "0 of 1 section completed" — you want the denominator tied to an Airtable field (you have "Total Sections" and "Course Count" on Assignments).
2. **Track Detail / Track View** still shows no progress (0%) and therefore no Started/Completed dates.
3. You want **deep research before more code changes** so this can be fixed quickly.

---

## 1. Where the numbers come from (intended design)

| What | Source | Purpose |
|------|--------|--------|
| **"X" (sections viewed)** | Progress API: `GET /api/progress?personId=xxx` → `{ [courseId]: lastViewedIndex }`. We sum `(lastViewedIndex + 1)` across courses. | How many sections the user has viewed. |
| **"Y" (total sections)** | **Assignments table: "Total Sections"** (e.g. 12). | Denominator for "X of Y sections" and for progress %. |
| **Course Count** | Assignments table: "Course Count" (e.g. 1). | Number of courses in the track. **Not** the right denominator for "sections" — that should be Total Sections. |

So for the card:

- **"X of Y sections completed"** → X = viewed (from API), Y = **Total Sections** from Airtable (e.g. 12).  
- If we use **Course Count** (1) as Y, we get "0 of 1" even when there are 12 sections. So "0 of 1" almost certainly means we’re either using Course Count or falling back to `courseIds.length` (also 1) instead of Total Sections.

---

## 2. Why you might be getting "0 of 1"

### 2.1 Denominator (the "1")

- The code tries many keys for Total Sections: `rec["Total Sections"]`, `rec.totalSections`, `f?.["Total Sections"]`, `f?.totalSections`, and a loop over keys containing "total" and "section".
- **If the Custom Code block never receives the "Total Sections" column**, all of those will be `undefined`. Then we fall back to `totalSectionsForTrack = courseIds.length` (1 course → 1). So you get "of 1".

**Softr behavior (from docs):**

- Records are usually `{ id, fields }`.
- `fields` is often keyed by **Airtable column names** (e.g. `fields["Total Sections"]`).
- **Important:** A block often only receives data for **columns that are actually used in that block** (e.g. visible in the List or used in the block’s configuration). If "Total Sections" (or "Course Count") is not added to the block that feeds the Custom Code, those fields may not appear in the response at all.

So the most likely cause of "of 1" is:

- **Total Sections is not included in the data the block passes to the Custom Code.**  
  Fix: In Softr, edit the **My Learning Tracks list** block (the second block on the My Learning Tracks page; it is connected to the **Assignments** data source). Add the **"Total Sections"** column to that block so it’s part of the data the block loads. There is no separate "Assignments block" — the list block *is* the one tied to Assignments.

### 2.2 Numerator (the "0")

- X comes from `getTrackProgressFromApi(t.courseIds, t.totalSections, apiProgress)`.
- If **`t.courseIds` is empty**, we never find any progress in the API, so we get 0.

We build `courseIds` from:

- **trackCourseIdsById** (from fetched track records: `useRecord` for each track, with `courses: "Courses"`), or  
- **coursesFromTrack** (from the assignment’s expanded track: `trackObj?.courses`).

If the Assignments block doesn’t expand the track’s "Courses" link, `coursesFromTrack` is empty. Then we rely on **trackCourseIdsById**. That only gets filled when:

- We have `trackId0 … trackId4` (up to 5 tracks),
- and for each we run `useRecord({ recordId: trackId, select: { courses: "Courses" } })`,
- and the response actually contains a `courses` array of **record ids** (e.g. `[{ id: "recXXX" }, ...]`).

If the track record’s "Courses" field comes back as only labels (e.g. course titles) and not record ids, we won’t get valid `courseIds`, so API lookup fails and X stays 0.

**Summary for list card:**

- **"0"** → either no `personId`, empty `courseIds`, or API not returning progress for those ids.
- **"of 1"** → Total Sections not in the block data, so we fall back to course count (1).

---

## 3. Why Track Detail / Track View might show 0%

Progress on Track Detail is looked up by **course id**. The API stores progress under the **course record id** that Section Content sends when the user views a section. That value comes from the **Course Detail URL**: `recordId=...` is the course id, and the section page gets `courseId=...` from that same URL and sends it to the API. So:

- **API key** = course record id from the Course Detail / section URL (e.g. `recAMazBg1XxY7j0D`).

On Track Detail we:

- Get the track’s courses from `selectedTrack.fields.courses`.
- For each course we build a list of possible ids: linked-record id, `courseData?.id`, `recordId` / `RecordID` from course fields, etc., and look up the API with the first match.

So 0% there usually means **none of those possible ids match the key stored in the API**. That can happen if:

1. **Track’s "Courses" field doesn’t return record ids**  
   Some setups return only primary field (e.g. course title). Then our "id" might be a title string, and the API key is still `recXXX`, so no match.

2. **Course list on Track Detail is different from the list used on Course Detail**  
   If the Track Detail block gets courses from a different source or with a different shape, `courseData?.id` or the linked-record id might be missing or different.

3. **personId missing on Track View URL**  
   Progress is fetched with `personId`. If the Track View URL doesn’t have `?personId=...`, we don’t fetch progress and show 0%.

So for Track Detail we need to **ensure the same course record id** (the one in the Course Detail/section URL) is what we use for lookup. That usually means the track’s "Courses" field must expose **record ids** (e.g. `id: "recXXX"`), not just labels.

---

## 4. Clarification: "Course Count" vs "Total Sections"

You said the "of 1" should be tied to the field you set up — **Course Count** on Assignments.

- **Course Count** = number of courses (e.g. 1). Using it as the denominator gives "0 of 1".
- **Total Sections** = total sections across the track (e.g. 12). Using it gives "0 of 12" and correct progress %.

So:

- For **"X of Y sections completed"**, the denominator **Y should be Total Sections**, not Course Count.
- We can still **read Course Count** from Airtable and use it (e.g. for display like "1 course" or as a fallback only when Total Sections is missing), but if we use it as the only denominator we will keep seeing "0 of 1" even when there are 12 sections.

Recommendation: **Use Total Sections for the "sections" denominator.** Ensure the Assignments block passes "Total Sections" to the Custom Code (see above). Optionally use Course Count for something else (e.g. label or fallback), but not as the main sections denominator.

---

## 5. Minimal diagnostic (no commitment to logic changes)

Before changing logic again, you can add a **one-time log** in the My Learning Tracks block to see what the block actually receives. That will tell us whether Total Sections and course ids are present.

In **My Learning Tracks** Custom Code, inside the `tracksForPerson` useMemo (or right after you build `assignmentRecords`), add something like:

```javascript
// TEMPORARY: remove after debugging
if (assignmentRecords?.length > 0 && typeof window !== "undefined") {
  const rec = assignmentRecords[0];
  const f = rec?.fields || {};
  window.console?.log("[LMS Debug] First assignment record keys:", Object.keys(rec));
  window.console?.log("[LMS Debug] First assignment fields keys:", Object.keys(f));
  window.console?.log("[LMS Debug] Total Sections (fields):", f["Total Sections"], f.totalSections, (rec && (rec as any)["Total Sections"]);
  window.console?.log("[LMS Debug] Course Count (fields):", f["Course Count"], f.courseCount);
  window.console?.log("[LMS Debug] trackCourseIdsById size:", trackCourseIdsById?.size, "sample:", trackCourseIdsById && trackId0 ? trackCourseIdsById.get(trackId0) : null);
}
```

Then:

1. Open My Learning Tracks with `?personId=...` in the URL.
2. Open the browser dev tools (F12) → Console.
3. Look for `[LMS Debug]` lines.

From that we can see:

- Whether **Total Sections** and **Course Count** exist and under what keys.
- Whether **trackCourseIdsById** has course ids for the first track.

You can do the same idea on Track Detail: log `apiProgress`, `courses.map(c => getLinkedRecordId(c))`, and one course’s `collectCourseIdsForProgress` result to confirm whether any id matches a key in `apiProgress`.

---

## 6. Recommended next steps (in order)

### Step 1: Softr block configuration

- **My Learning Tracks page → My Learning Tracks list block** (the second block; its data source is **Assignments**):
  1. Click the **My Learning Tracks list** block to select it.
  2. In the block settings / content configuration, find where you choose which **columns** (fields) from the Assignments table are loaded or displayed.
  3. Add the **"Total Sections"** column so it’s included in the data the block loads. Optionally add **"Course Count"** if you use it elsewhere.
  4. Save and publish the page.

- **Track View / Track Detail:** When you open a track from My Learning Tracks, the URL should include `personId` (e.g. `?recordId=...&personId=...`). If it doesn’t, the "Go to track" link in the list block must pass `personId` (the code already does; just confirm in the browser).

### Step 2: Run the diagnostic

- Diagnostic code is added below to the **My Learning Tracks list** and **Track Detail** Custom Code blocks. They log to the browser console with a `[LMS Debug]` prefix.
- **What to do:** Open My Learning Tracks (with `?personId=...` in the URL), open the browser **Developer Tools → Console** (F12), and look for `[LMS Debug]` lines. Then open a track (Track View) and check the console again for Track Detail logs.
- **What to check:**
  - **My Learning Tracks:** Do you see `Total Sections` and `Course Count` in the logged keys? What are their values? Is `trackCourseIdsById` populated with an array of course ids?
  - **Track Detail:** What are the `apiProgress` keys? What `possibleIds` do we have for the first course? Does any id match an `apiProgress` key?

### Step 3: Change code only if needed

- If Total Sections appears under a **different key** in the log, we add that key to the code.
- If **course ids are empty**, we need the track’s "Courses" (or the block that feeds courses) to return record ids.
- If **Track Detail** has the right ids but still 0%, we can add a fallback (e.g. try every key in `apiProgress` when we have one course).

This way we fix the root cause (data shape and block config) instead of guessing again in code.
