# Learning Tracks Progress API (Vercel or Netlify)

**If you get 404 on Vercel** for `/api/progress` or `/api/section-view`, use **Netlify** instead: see **[NETLIFY-DEPLOY.md](./NETLIFY-DEPLOY.md)**. The same repo works on both; Netlify doesn’t have the Output Directory limitation.

---

# Learning Tracks Progress on Vercel

One Vercel project handles **both** saving section views and serving progress. No Airtable webhooks, no Section Views records for progress, no CORS issues.

- **POST /api/section-view** – Softr app sends section views here; we store them in Redis.
- **GET /api/progress?personId=xxx** – Returns `{ [courseId]: lastViewedIndex }` for Track Detail, Course Detail, and My Learning Tracks.

Data lives in **Upstash Redis** (free tier), connected via the Vercel Marketplace.

---

## Deploy on Vercel

1. **Sign up / log in** at [vercel.com](https://vercel.com).

2. **Add Redis** (required for storage):
   - Use the **Upstash integration**: Vercel **Marketplace** → search **Upstash** → install and connect a Redis database to this project (sets full `https://` URLs in env). Avoid adding Redis only via **Storage**; that can set a relative URL and cause "Failed to parse URL from /pipeline". If you still see "Failed to parse URL from /pipeline", add **`REDIS_REST_URL`** and **`REDIS_REST_TOKEN`** (same values from [Upstash Console](https://console.upstash.com/))—Vercel won't override those names.
   - Create/link a Redis database. Vercel will add env vars like `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your project.
   - **Ignore** any Redis docs that say “install `redis`” and use `createClient()`. This project uses **Upstash** and the `@upstash/redis` package (already in the code). You only need to connect the store in Vercel and redeploy.

3. **Create the project** from this folder:
   - Push this folder to a GitHub repo, then in Vercel: **Add New** → **Project** → **Import** that repo; **or**
   - From this folder in a terminal: `npm install` then `vercel` and follow the prompts.

4. **Deploy.** Your base URL will be something like:
   ```text
   https://softr-learning-tracks-webhook-proxy.netlify.app
   ```
   (Or use Vercel; see below if you prefer Vercel.)

5. **Set URLs in Softr** (same base URL for both). **Netlify example:**

   - **Section Content** block – section views (write):
     ```javascript
     var SECTION_VIEW_WEBHOOK_URL = "https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view";
     ```

   - **Page2 (Track Detail), Page3 (Course Detail), My Learning Tracks List** – progress (read):
     ```javascript
     const PROGRESS_API_URL = "https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress";
     ```
     (Use `var` in blocks that use `var` elsewhere.)

   Save and publish each block. If you use a different host (e.g. Vercel), replace the base URL with yours.

### If you get 404 on /api/progress or /api/section-view

In the **Vercel dashboard** → your project → **Settings**:

1. **General** → **Root Directory**  
   Leave **empty** (or `.`) so the repo root is the project root. If your repo has the code inside a subfolder, set Root Directory to that folder (e.g. `Softr-Learning-Tracks-Webhook-Proxy`).

2. **General** → **Build & Development Settings**  
   - **Framework Preset:** **Other**.  
   - **Build Command:** `npm install` (or leave empty).  
   - **Output Directory:** **Must be empty.** If you see `public` or anything here, delete it and leave the field blank. Otherwise only static files are deployed and `/api/progress` and `/api/section-view` will 404. Save after changing.

3. **Redeploy:** **Deployments** tab → click **⋯** on the latest deployment → **Redeploy**. Or push a small change to GitHub to trigger a new deploy.

---

## How to check it's working

Do these in order after you’ve deployed, connected Redis, and set the URLs in Softr.

### 1. Test the progress API (read)

In a browser or with curl, open (use a real person record ID from your Airtable **All Personnel** table):

```text
https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=REC_PERSON_ID
```

Example: `https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=recl3sAfLo4pnplMO`

- **Working:** You see JSON, e.g. `{}` (no progress yet) or `{"recCourseId1":2,"recCourseId2":0}`.
- **Not working:** 500 or “Progress fetch failed” → check that Upstash Redis is connected to the Vercel project and env vars are set; redeploy if you just added Redis.

### 2. Test in the app (write + read)

1. **Open My Learning Tracks** as a user (URL must include `personId=...`, e.g. from your usual entry flow).
2. **Open a track** → **Start** or **Continue** a course → open **Section 1** (first section).
3. **Confirm the section view was sent:**
   - Add **`&debug=1`** to the current section URL in the address bar and press Enter.
   - Open **Developer Tools** (F12 or right‑click → Inspect) → **Console**.
   - You should see a line like: `[Section View] Sending webhook to Airtable` (or “Sending webhook…”). If you see `[Section View] Webhook error`, the POST failed (check CORS/URL).
4. **Check that progress was stored:**
   - In a new tab, open the progress URL from step 1 (same `personId`).
   - You should see that course’s ID with `lastViewedIndex` at least `0`, e.g. `{"rec2pQaUyC0OOMb3Y":0}`.
5. **Click to Section 2** (or 3), then reload the progress URL. The number for that course should increase (e.g. `1` or `2`).

### 3. Check the UI

- **My Learning Tracks list:** Cards for assigned tracks should show a **percentage** or “Continue” (not stuck at 0% if you’ve viewed sections).
- **Track Detail:** Course rows should show progress % or “Continue” / “Review”.
- **Course Detail:** Progress bar and “Continue from Section X” (or “Review” when 100%) should match the section you last viewed.

If step 1 works but the app still shows 0%, confirm that **Page2, Page3, and My Learning Tracks List** all have `PROGRESS_API_URL` set to your `/api/progress` URL and that the Section Detail URL includes **personId** (and courseId) when you open sections.

### 4. Quick checklist

| Check | What to do |
|-------|------------|
| GET progress returns JSON | Open `/api/progress?personId=recXXX` in browser. |
| POST section view runs | View a section with `&debug=1` in URL; see `[Section View] Sending webhook…` in console. |
| Progress persists | View section 1, then open progress URL; view section 2, refresh progress URL — value increases. |
| UI shows progress | My Learning Tracks, Track Detail, and Course Detail show correct % or Continue/Review. |

---

## What gets stored

- **Key:** `progress:{personId}`
- **Value:** `{ [courseId]: lastViewedIndex, ... }` (JSON object)

Each time the user views a section, the app POSTs to `/api/section-view`; we update the stored `lastViewedIndex` for that person/course only if the new value is higher. No Airtable tables or automations are used for progress.

---

## Wipe progress

- **This browser:** Use the app’s wipe URL (e.g. My Learning Tracks with `?wipeProgress=1&personId=recXXX`) to clear **localStorage**.
- **Server (Redis):** There is no wipe endpoint yet. To reset a user’s progress in Redis, use the Upstash dashboard or add a small DELETE handler that calls `redis.del('progress:' + personId)`.

---

## Optional: Airtable Section Views

If you still want Section Views in Airtable (e.g. for reporting), you can add a second step: when your app calls this Vercel API, also call Airtable (e.g. from a Vercel function that forwards to an Airtable webhook). The default setup here does **not** write to Airtable; progress is read only from Redis.
