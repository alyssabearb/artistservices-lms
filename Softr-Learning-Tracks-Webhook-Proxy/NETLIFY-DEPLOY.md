# Deploy this API on Netlify (fixes 404 on Vercel)

If your Vercel project keeps returning **404** for `/api/progress` and `/api/section-view` (because of Output Directory / static-only behavior), deploy the **same API** to **Netlify** instead. Netlify Functions don’t have that limitation.

## 1. Create a Netlify site from this repo

1. Go to [netlify.com](https://netlify.com) and sign in.
2. **Add new site** → **Import an existing project**.
3. Connect **GitHub** and choose the repo: **alyssabearb/Softr-Learning-Tracks-Webhook-Proxy** (or push this folder to its own repo and import that).
4. **Build settings** (Netlify usually detects them):
   - **Build command:** `npm install` or leave default.
   - **Publish directory:** leave default or `public` (only for a small static page; the API is in functions).
5. **Deploy site.**

## 2. Add Redis env vars

1. In Netlify: **Site settings** → **Environment variables** → **Add a variable** / **Import from .env**.
2. Add (same as Upstash):
   - **UPSTASH_REDIS_REST_URL** = your Upstash REST URL  
   - **UPSTASH_REDIS_REST_TOKEN** = your Upstash REST token  
   (You can copy these from your Vercel project env or from the Upstash dashboard.)
3. **Save** and trigger a **new deploy** (Deploys → Trigger deploy → Deploy site).

## 3. Use the Netlify URL in Softr

After deploy, your API base URL will look like:

`https://softr-learning-tracks-webhook-proxy.netlify.app`

Thanks to `netlify.toml`, these paths work and behave the same as before:

- **GET** `https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=xxx`
- **POST** `https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view` (with JSON body)

In Softr, set:

- **Section Content block:**  
  `var SECTION_VIEW_WEBHOOK_URL = "https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view";`
- **Page2, Page3, My Learning Tracks List:**  
  `const PROGRESS_API_URL = "https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress";`

## 4. Test

Open in a browser:

`https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress?personId=recl3sAfLo4pnplMO`

You should get JSON (e.g. `{}` or `{"recCourseId": 0}`), not 404.

---

**Why Netlify works:** Netlify deploys anything in `netlify/functions/` as serverless functions and doesn’t require an “Output Directory” for static files. The redirects in `netlify.toml` map `/api/progress` and `/api/section-view` to those functions so your Softr app can keep using the same URLs.
