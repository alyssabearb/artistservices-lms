# Exact steps to fix 0% progress on Track Detail and My Learning Tracks list

## Root cause (what was wrong)

1. **Early return on Track Detail**  
   `getProgressFromApi` returned `0` when `totalSections <= 0` **before** looking up progress in the API. So when `courseData` was missing (e.g. course not found in `allCoursesList`), `sectionCount` was 0 and we never tried any API keys.

2. **Same on the list**  
   The list’s `getTrackProgressFromApi` also returned 0 when `totalSections <= 0`, so it never used the “1 key” or “N keys = N courses” fallbacks when total sections was 0.

3. **Course not found by id**  
   When the track’s “Courses” field doesn’t expose record ids the same way (e.g. different Softr/Airtable shape), `findRecordById` returns `undefined`, so we had no `idForNav` and no `sectionCount`. We now fall back to the course at the same index when `allCoursesList.length === courses.length`.

## Code changes made

### Track Detail (`Softr-Learning-Tracks-Page2-TrackDetail.tsx`)

1. **`getProgressFromApi`**  
   - Removed the `totalSections <= 0` early return.  
   - Lookup is always done.  
   - If `totalSections <= 0` but we have progress (`lastIdx >= 0`), we use `effectiveTotal = lastIdx + 1` so the bar shows 100% for that course.

2. **`trackRollup`**  
   - When we have progress (`lastIdx >= 0`) but `sectionCount === 0`, we still add `lastIdx + 1` to `totalViewed` and use it as the section count for that course so the rollup percent is correct.

3. **Course data by index**  
   - If `findRecordById(allCoursesList, courseAirtableId)` is undefined and `allCoursesList.length === courses.length`, we use `allCoursesList[i]` as `courseData` so we still get `idForNav`, `sectionCount`, and progress.

4. **`getLinkedRecordId`**  
   - Handles linked value as an array (e.g. `[record]`) and checks `RecordID` so we can get the course id from more Softr/Airtable shapes.

### My Learning Tracks list (`Softr-Learning-Tracks-MyLearningTracksList.tsx`)

1. **`getTrackProgressFromApi`**  
   - No longer returns 0 when `totalSections <= 0`; it still runs the lookup and fallbacks.  
   - Denominator is `totalSections > 0 ? totalSections : (viewedCount || 1)` so we can show a percentage even when total sections is missing.

## What you need to do

1. **Copy the updated blocks into Softr**
   - Replace the **Track Detail / Track View** Custom Code block with the full contents of `Softr-Learning-Tracks-Page2-TrackDetail.tsx`.
   - Replace the **My Learning Tracks list** Custom Code block with the full contents of `Softr-Learning-Tracks-MyLearningTracksList.tsx`.

2. **Confirm progress API and URL**
   - Track Detail and list both use `personId` from the URL.  
   - Ensure the Track Detail URL includes `personId`, e.g.  
     `.../track-view?recordId=TRACK_RECORD_ID&personId=PERSON_RECORD_ID`  
   - Same for My Learning Tracks: `.../my-learning-tracks?personId=PERSON_RECORD_ID`.

3. **Confirm progress API returns data**
   - In the browser, open:  
     `https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=YOUR_PERSON_RECORD_ID`  
   - You should see JSON like `{ "recCourseId123": { "lastViewedIndex": 2 }, ... }` (or numeric values).  
   - If you see `{}` or an error, progress is not stored for that person or the API/Redis setup is wrong.

4. **Softr block data sources**
   - **Track Detail page**  
     - Main block data source: **Learning Tracks**.  
     - The block uses `useRecords` for **Courses** (separate data source). Ensure the app has a Courses data source and that the block can load course records (e.g. same base as Course Detail).
   - **My Learning Tracks list**  
     - Block data source: **Assignments**.  
     - Assignments should link to **Track** and optionally **Course**, and have a “Total Sections” (or similar) field.

5. **Re-test**
   - Open My Learning Tracks with `?personId=...`.
   - Open a track that already has progress (sections completed earlier).
   - Track Detail should show non-zero progress on course cards and the rollup.
   - The list should show “X of Y sections completed” and a non-zero bar when the track’s course count matches the number of keys in the progress API (or when course ids match).

## If it still shows 0%

1. **Check progress API response**  
   Call the progress URL in step 3 and confirm the keys (e.g. `recXXXXXXXXXXXXX`). Those are the course record ids stored when the user completed sections.

2. **Check Course Detail URL when opening a course**  
   From Track Detail, click “Start” or “Continue” on a course and look at the address bar. You should see `recordId=recXXXXXXXXXXXXX`. That `recordId` is the key under which progress is stored. If the Track Detail “Start” link uses a different id, fix the link so it uses the same `recordId` as Course Detail.

3. **Ensure `personId` is consistent**  
   The same `personId` must be used on: My Learning Tracks list, Track Detail, Course Detail, and Section Content. If any of these pages lack `personId` or use a different value, progress will not load or will be stored under a different user.

4. **Courses list on Track Detail**  
   If `allCoursesList` is empty or doesn’t contain the track’s courses, we can’t get `sectionCount` or a reliable `idForNav`. In Softr, ensure the block that loads courses (e.g. `useRecords` for Courses) is configured to load the same Courses table/base that Course Detail uses, and that the track’s “Courses” field is expanded or linked so we can resolve course records.
