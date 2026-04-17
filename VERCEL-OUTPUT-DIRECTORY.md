# Vercel: Output Directory locked to "public"

**You're not missing anything.** On many projects the Output Directory field is locked (grayed out), or when you turn "Override" on, the UI won't accept a blank value. That's a Vercel limitation on that project.

**What we're doing instead:** The repo's `vercel.json` (in Softr-Learning-Tracks-Webhook-Proxy) now sets `"framework": null` (Other) and **`"outputDirectory": null`**. In Vercel's config, `null` can override the dashboard and mean "no output directory." Push the latest code and redeploy; if the build accepts it, the API routes should deploy. If the build fails or you still get 404, use a **new** Vercel project (leave Output Directory blank when you create it) or deploy the same repo to **Netlify** (see NETLIFY-DEPLOY.md in the Webhook-Proxy folder).

---

**If the UI ever lets you edit it:** Production Overrides are read-only. You'd change the **default** in **Project Settings** (expand that section, clear Output Directory there, Save). Then redeploy.

## Steps (when Project Settings are editable)

1. Stay on **Settings** → **Framework Settings** (or **Build & Development Settings**).
2. Find the **Project Settings** section (below **Production Overrides**).
3. **Expand** **Project Settings** (click the row or the chevron so it opens).
4. In **Project Settings**:
   - Set **Output Directory** to **empty** (delete `public` or any value so the field is blank).
   - Set **Framework Preset** to **Other** if needed.
   - **Build Command** can be `npm install` or empty.
5. Click **Save** (for Project Settings).
6. **Trigger a new production deployment** so the next build uses these settings.
