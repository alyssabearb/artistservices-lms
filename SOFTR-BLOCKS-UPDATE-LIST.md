# Softr blocks to update – copy/paste list

Use this list to update your Softr Custom Code blocks. Copy the **entire contents** of each file below into the corresponding block in Softr, then save and publish.

**Note:** Your Custom Code block for the list is already connected to the **Assignments** table. You renamed the **"Course Count"** column in Airtable to **"Total Sections"**. The code reads that field for the card denominator; no need to “add columns” in Softr.

---

## 1. My Learning Tracks page – **My Learning Tracks list** (second block)

- **Block:** The Custom Code block that shows the list of assigned tracks (data source: **Assignments**).
- **File to paste:** `Softr-Learning-Tracks-MyLearningTracksList.tsx`
- **Action:** Open the file, select all, copy. In Softr, open that Custom Code block, replace all of its code with the pasted content, save, publish.

---

## 2. Track View / Track Detail page – **Track Detail** Custom Code block

- **Block:** The Custom Code block on the Track View (or Track Detail) page that shows the track header and course cards (data source: **Learning Tracks**).
- **File to paste:** `Softr-Learning-Tracks-Page2-TrackDetail.tsx`
- **Action:** Open the file, select all, copy. In Softr, open that Custom Code block, replace all of its code with the pasted content, save, publish.

---

## 3. Course Detail page – **Course Detail** Custom Code block

- **Block:** The Custom Code block on the Course Detail page that shows the course and section list (data source: **Courses**).
- **File to paste:** `Softr-Learning-Tracks-Page3-CourseDetail.tsx`
- **Action:** Open the file, select all, copy. In Softr, open that Custom Code block, replace all of its code with the pasted content, save, publish.

---

## 4. Section Detail page – **Section Content** Custom Code block

- **Block:** The Custom Code block on the Section Detail page that shows the section body and Prev/Next (or Finish) navigation (data source: **Training Sections**).
- **File to paste:** `Softr-Learning-Tracks-Page4-SectionContent.jsx`
- **Action:** Open the file, select all, copy. In Softr, open that Custom Code block, replace all of its code with the pasted content, save, publish.

---

## Summary table

| Softr page        | Block name / description        | File to paste                              |
|-------------------|---------------------------------|--------------------------------------------|
| My Learning Tracks| My Learning Tracks list (2nd)   | `Softr-Learning-Tracks-MyLearningTracksList.tsx` |
| Track View / Track Detail | Track Detail block        | `Softr-Learning-Tracks-Page2-TrackDetail.tsx`    |
| Course Detail     | Course Detail block             | `Softr-Learning-Tracks-Page3-CourseDetail.tsx`   |
| Section Detail    | Section Content block           | `Softr-Learning-Tracks-Page4-SectionContent.jsx` |

---

## Optional blocks (if you use them)

- **Page 1 – Tracks list:** If you have a Custom Code block for the main Learning Tracks list, it would use `Softr-Learning-Tracks-Page1-TracksList.tsx`. Only update if you’ve customized that block.
- **My Learning Tracks – Profile block:** If you have a separate Profile Custom Code block, it would use `Softr-Learning-Tracks-MyLearningTracksProfile.tsx`. Only update if you’ve customized it.
- **Section Detail – Resource Library block:** If you have a Custom Code block for the resource library (with Prev/Next when the section has linked resources), it would use `Softr-Learning-Tracks-Page4-ResourceLibraryBlock.tsx`. Only update if we’ve given you a newer version for Finish/single-section behavior there.

For this round, the **four blocks above** (list, Track Detail, Course Detail, Section Content) are the ones to update with the files listed.
