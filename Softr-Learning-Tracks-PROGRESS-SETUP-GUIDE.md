# Step-by-Step: Webhook (Write) + Progress API (Read)

This guide sets up **cross-device progress**. You can do it in one place (recommended) or split write/read across Airtable, Zapier, or Power Automate.

---

## Recommended: Vercel-only (one place, no Airtable for progress)

Store section-view progress **on Vercel** so you don’t need Airtable Section Views, webhooks to Airtable, or a separate progress API.

1. Use the **`Softr-Learning-Tracks-Webhook-Proxy`** project in this repo (it’s now a small progress backend, not just a proxy).
2. Deploy it to **Vercel** and add **Upstash Redis** from the Vercel Marketplace (free tier).
3. Set **one base URL** in Softr:
   - **Section Content:** `SECTION_VIEW_WEBHOOK_URL = "https://your-project.vercel.app/api/section-view"`
   - **Page2, Page3, My Learning Tracks List:** `PROGRESS_API_URL = "https://your-project.vercel.app/api/progress"`
4. No Airtable automations or Section Views are required for progress. See **Softr-Learning-Tracks-Webhook-Proxy/README.md** for full deploy steps.

If you prefer to keep progress in Airtable (Section Views + automation + separate read API), follow the sections below.

---

## Alternative: Airtable Section Views + webhook + progress API

Section views are sent to Airtable via a webhook; the app reads progress from an API that derives it from Section Views (no separate Progress table).

**Options covered:** Airtable automation (write), Zapier, Microsoft Power Automate. Using **Airtable or Power Automate for the write** saves Zapier tasks (see task usage below).

---

## Task usage (Zapier / Power Automate)

- **Write (section view):** Each time a user views a section, the app sends **one POST** to your webhook.  
  - If that webhook is **Zapier:** 1 Zapier task per section view. With 50 people each viewing 20 sections, that’s **1,000 tasks** just for writes.  
  - If that webhook is **Airtable “Webhook received”** or **Power Automate:** **no Zapier tasks** for writes.

- **Read (progress API):** Each time a user loads Track Detail, Course Detail, or My Learning Tracks list, the app sends **one GET** to your progress URL.  
  - If the progress URL is **Zapier:** 1 task per page load. 50 people × 3 page loads ≈ **150 tasks** per “round” of usage.

**Recommendation:** Use **Airtable automation** or **Power Automate** for the **write** (section views). Use **Zapier** only for the **GET progress** endpoint if you like; that keeps Zapier usage low (hundreds of tasks per month, not thousands).

---

## Part A: Airtable – Section Views table

You already have **Section Views**. Add one field so progress can be derived without a separate Progress table:

1. In **Section Views**, add a **Number** field named **Section Index** (or **Last Viewed Index**).
2. When you create a record from the webhook, store the payload’s **lastViewedIndex** (0-based section index in that course) in this field.

Your Section Views table should have:

| Field name    | Type              | Notes |
|---------------|-------------------|--------|
| Personnel     | Link to another record → **All Personnel** | Who viewed. |
| Section       | Link to another record → **Training Sections** | Section that was viewed. |
| Course        | Link to another record → **Courses** | Course context. |
| Viewed At     | Date (with time) or **Created time** | When viewed. |
| **Section Index** | **Number**    | **Add this.** 0-based index of that section in the course (from webhook `lastViewedIndex`). |

No separate Progress table is required. The progress API will use Section Views and take the **max Section Index per person per course** to build the response.

---

## Part B: Webhook (write) – when a section is viewed

The app sends a **POST** with this JSON body:

```json
{
  "personId": "recl3sAfLo4pnplMO",
  "sectionId": "recXXXXXXXXXXXXXX",
  "courseId": "recAMazBg1XxY7j0D",
  "viewedAt": "2025-02-06T18:30:00.000Z",
  "lastViewedIndex": 2
}
```

Choose **one** of the options below. **Option 1 (Airtable)** or **Option 3 (Power Automate)** avoids using Zapier tasks for every section view.

---

### Option 1: Airtable “Webhook received” (recommended for write – no Zapier tasks)

1. In your Airtable base, go to **Automations** and create a new automation.
2. **Trigger:** **Webhook received** (under “When something happens” or “Trigger”).
   - Airtable will show a **Webhook URL** and optionally a **Request body JSON schema**. Copy the Webhook URL; this will be your `SECTION_VIEW_WEBHOOK_URL`.
   - If there’s a body schema, you can leave it flexible or add the fields you need (e.g. `personId`, `sectionId`, `courseId`, `viewedAt`, `lastViewedIndex`).
3. **Action:** **Create record**.
   - **Table:** Section Views.
   - Map the webhook body to fields:
     - **Personnel:** Link to record – use the **record ID** from the trigger’s request body. In Airtable’s automation UI this is often something like `{{trigger.body.personId}}` or the equivalent for “link to All Personnel” (you may need to pass it as an array of one ID, e.g. `[trigger.body.personId]`, depending how Airtable exposes it).
     - **Section:** same idea with `trigger.body.sectionId`.
     - **Course:** same with `trigger.body.courseId`.
     - **Viewed At:** `trigger.body.viewedAt` (if the field accepts date/time; otherwise use “Created time” and leave Viewed At as Created time).
     - **Section Index:** `trigger.body.lastViewedIndex`.
4. **Fix "Could not find matching rows for string":** Do not use a "Find record" step. Use only **Create record** in Section Views. Map **Personnel** to `trigger.body.personnelRecordIds`, **Section** to `trigger.body.sectionRecordIds`, **Course** to `trigger.body.courseRecordIds`, **Viewed At** to `trigger.body.viewedAt`, **Section Index** to `trigger.body.lastViewedIndex`. The app sends those array fields for link fields. **Note:** Airtable’s “Link to another record” in automations sometimes expects the record ID in a specific format. If the automation doesn’t accept the raw ID, check Airtable’s docs for “Webhook” + “Create record” and use the format they show for linked records (often an array of record IDs).
5. Turn the automation **On**. Test by opening a section in your app and confirming a new row in Section Views with Section Index filled.

---

### Option 2: Zapier (write) – uses 1 task per section view

1. In Zapier, create a **Zap**.
2. **Trigger:** **Webhooks by Zapier** → **Catch Hook**.
   - Choose **Catch Raw Hook** or **Catch Hook** and set the trigger to fire on **POST**.
   - Copy the **Webhook URL** Zapier gives you → this is `SECTION_VIEW_WEBHOOK_URL`.
3. **Action:** **Airtable** → **Create Record**.
   - Base and table: the one that contains **Section Views**.
   - Map:
     - Personnel (link): from trigger body `personId` (Zapier may want an array, e.g. `[personId]`).
     - Section (link): `sectionId`.
     - Course (link): `courseId`.
     - Viewed At: `viewedAt`.
     - Section Index: `lastViewedIndex`.
4. Save and turn the Zap **On**. Test with a section view; check Section Views in Airtable.

---

### Option 3: Microsoft Power Automate (write) – no Zapier tasks

1. In Power Automate, create a **new flow** (Automated cloud flow).
2. **Trigger:** **When a HTTP request is received**.
   - Method: **POST**.
   - Optional: add a **Request Body JSON Schema** so the trigger parses the body. Example:
     ```json
     {
       "type": "object",
       "properties": {
                         "personId": { "type": "string" },
                         "sectionId": { "type": "string" },
                         "courseId": { "type": "string" },
                         "viewedAt": { "type": "string" },
                         "lastViewedIndex": { "type": "number" }
       }
     }
     ```
   - Save the flow once; Power Automate will show the **HTTP POST URL**. That URL is your `SECTION_VIEW_WEBHOOK_URL`.
3. **Action:** **Airtable** → **Create a record** (or “Create record” in the Airtable connector).
   - Connection: your Airtable connection.
   - Base and table: **Section Views**.
   - Map:
     - **Personnel:** pass the person record ID from `personId` in the request body. For “Link to another record” in Airtable’s API you often send an array of record IDs, e.g. `["recl3sAfLo4pnplMO"]` – use the dynamic content for `personId` in that format if required.
     - **Section:** `sectionId` (same link format if needed).
     - **Course:** `courseId`.
     - **Viewed At:** `viewedAt`.
     - **Section Index:** `lastViewedIndex`.
4. Save and test. Trigger by loading a section in your app and confirm a new Section Views record with Section Index.

---

### After you choose a write option: set the URL in the app

1. Open the **Section Content** block in Softr (Section Detail page – `Page4-SectionContent.jsx`).
2. Find:  
   `var SECTION_VIEW_WEBHOOK_URL = "";`
3. Set it to the webhook URL you got from Airtable, Zapier, or Power Automate. Example:  
   `var SECTION_VIEW_WEBHOOK_URL = "https://hooks.airtable.com/...";`  
   or  
   `var SECTION_VIEW_WEBHOOK_URL = "https://hooks.zapier.com/...";`
4. Save/publish the block.

**Webhook not firing?** The app only sends the webhook when the Section Detail URL includes **personId**, **courseId**, and **recordId** (section). If you open a section via a link from **Course Detail** (with personId in the URL), it should fire. Add **`&debug=1`** to any section URL, open the browser **Developer Tools → Console**, and reload: you’ll see `[Section View] Sending webhook to Airtable` and the response (or an error) if the block is running. If you see nothing, the Section Detail page may be loading without personId/courseId (e.g. direct link without query params). Use the links from **My Learning Tracks → Start → Course → section** so personId and courseId are in the URL.

**"Blocked by CORS policy" / webhook never hits Airtable:** Browsers block direct `fetch()` from your Softr site to Airtable’s webhook because Airtable does not send CORS headers. The **recommended** fix is to use **Vercel-only progress** (see top of this guide): deploy **Softr-Learning-Tracks-Webhook-Proxy** and point the app at it; that backend stores progress in Redis and does not call Airtable. If you still want to write to Airtable, you’d need a proxy that sends CORS and forwards to Airtable (the same folder can be adapted; see the proxy README).

---

## Part C: Progress API (read) – GET progress from Section Views

The app needs a **GET** endpoint that:

- Accepts **?personId=recXXX**.
- Returns JSON: **`{ "recCourseId1": 2, "recCourseId2": 0 }`**  
  where each value is the **maximum Section Index** for that course for that person (from Section Views). No separate Progress table is used.

You can build this with **Zapier** (one task per page load) or **Power Automate**.

---

### Option 1: Zapier (GET progress)

1. **New Zap**.
2. **Trigger:** **Webhooks by Zapier** → **Catch Hook**.
   - Set to **GET** (or “Custom request” and allow GET).
   - Copy the **Webhook URL** (with query string support). This will be your `PROGRESS_API_URL` (the app will append `?personId=...`).
3. **Action:** **Airtable** → **Find Records** (or **List records**).
   - Base and table: **Section Views**.
   - Filter: **Personnel** is (link to) the person record. In Zapier you’ll pass the `personId` from the trigger’s query parameters (e.g. from “Query String” or “Query” in the Catch Hook output). Airtable’s “Find records” often filters by a linked record ID – use that `personId` value.
4. **Action:** **Code by Zapier** → **Run Python** (or **Run JavaScript**).
   - **Input Data:** e.g. `records` = the array of Section Views records from step 3.
   - **Code:** For each record, read the Course (record ID) and Section Index. Group by course ID and keep the **max** Section Index per course. Output a single object, e.g. `result`: `{ "recCourseId1": 2, "recCourseId2": 0 }`.
   - Example (Python) – adjust key names to match your Airtable field names:
     ```python
     records = input_data.get('records', [])
     by_course = {}
     for r in records:
         course_id = r.get('fields', {}).get('Course', [None])[0] if isinstance(r.get('fields', {}).get('Course'), list) else r.get('fields', {}).get('Course')
         if not course_id:
             continue
         idx = r.get('fields', {}).get('Section Index')
         if idx is None:
             continue
         if course_id not in by_course or (by_course[course_id] is not None and idx > by_course[course_id]):
             by_course[course_id] = idx
     output = {'result': by_course}
     ```
   - Or in JavaScript:
     ```javascript
     const records = inputData.records || [];
     const byCourse = {};
     for (const r of records) {
       const courseField = r.fields && r.fields.Course;
       const courseId = Array.isArray(courseField) ? courseField[0] : courseField;
       if (!courseId) continue;
       const idx = r.fields && r.fields['Section Index'];
       if (idx == null) continue;
       if (byCourse[courseId] == null || idx > byCourse[courseId]) byCourse[courseId] = idx;
     }
     return { result: byCourse };
     ```
5. **Action:** **Webhooks by Zapier** → **Return Response**.
   - **Status:** 200.
   - **Body:** the object you built (e.g. `result` from the Code step).  
   - **Headers:** Content-Type: `application/json`.
6. Save and turn the Zap **On**. Test:  
   `https://hooks.zapier.com/...?personId=recl3sAfLo4pnplMO`  
   You should get JSON like `{ "recAMazBg1XxY7j0D": 2 }`.

---

### Option 2: Power Automate (GET progress)

1. **New flow** → **When a HTTP request is received**.
   - Method: **GET** (or “Any” and handle GET in the flow).
   - Save once to get the **HTTP request URL** → this is your `PROGRESS_API_URL`. The app will call this URL with `?personId=recXXX`.
2. **Action:** **Airtable** → **List records** (or **Get records**) for **Section Views**.
   - Filter by **Personnel** = the person ID from the request. In “When a HTTP request is received” the query parameters are often under something like `triggerOutputs()?['queries']?['personId']` or `triggerOutputs()?['queryParameters']?['personId']` – use that to filter.
3. **Build the JSON object:** Use **Apply to each** over the Section Views records, then **Compose** or **Variables** to:
   - For each record, get Course (record ID) and Section Index.
   - Keep the maximum Section Index per course (e.g. use a variable object and update it in the loop).
4. **Response:** **Response** action.
   - Status: 200.
   - Body: the object you built (e.g. `{ "recCourseId1": 2 }`).
   - Headers: Content-Type = application/json.
5. Save and test with a GET request including `?personId=...`.

---

### Set the Progress API URL in the app

1. In **Softr**, open the Custom Code for:
   - **Page2 (Track Detail)** – `Page2-TrackDetail.tsx`
   - **Page3 (Course Detail)** – `Page3-CourseDetail.tsx`
   - **My Learning Tracks List** – `MyLearningTracksList.tsx`
2. In each file, find:  
   `const PROGRESS_API_URL = "";`  
   (or `var PROGRESS_API_URL = "";` in the list block)
3. Set it to your **GET** progress URL **without** `?personId=` (the app adds that). Examples:
   - Zapier: `const PROGRESS_API_URL = "https://hooks.zapier.com/xxxxx";`
   - Power Automate: `const PROGRESS_API_URL = "https://prod-00.westus.logic.azure.com/...";`
4. Save/publish each block.

---

## Wipe progress (start over)

To let someone **start over** on a device (clear **localStorage** progress):

- **Easiest:** Open **My Learning Tracks** with **`wipeProgress=1`** and **`personId`** (their All Personnel record ID). Example:  
  `https://yoursite.softr.app/my-learning-tracks?personId=recl3sAfLo4pnplMO&wipeProgress=1`  
  That wipes all progress for that person in this browser and then removes the query params from the URL. To wipe only one course, add **`&wipeCourse=recCourseId`**.
- **Alternatively:** Open any **Section Detail** URL with **`&wipeProgress=1&personId=recXXX`** (same effect).
- **Airtable (Section Views):** To reset server-side progress, delete that person’s rows in **Section Views** (filter by Personnel), or add an automation that runs when you need it.

---

## Checklist

- [ ] **Section Views** has a **Section Index** (Number) field.
- [ ] **Write:** One of: Airtable “Webhook received”, Zapier POST hook, or Power Automate POST flow. Each creates a Section Views row with Personnel, Section, Course, Viewed At, **Section Index**.
- [ ] **Section Content** block: `SECTION_VIEW_WEBHOOK_URL` set to that write webhook URL.
- [ ] **Read:** Zapier or Power Automate GET flow that finds Section Views by person, groups by course, returns max Section Index per course as `{ "recCourseId": number }`.
- [ ] **Page2, Page3, My Learning Tracks List:** `PROGRESS_API_URL` set to the GET progress URL.

Using **Airtable** or **Power Automate** for the write keeps Zapier usage to the progress reads only (one task per Track/Course/My Learning Tracks page load), so 2,000 tasks/month is plenty even with 50+ people.
