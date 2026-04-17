# Connect your Desktop folder to Git + Vercel auto-deploy

You have the project on your Desktop and uploaded files to a repo; you want pushes from this folder to auto-update the repo and trigger Vercel deploys.

---

## Option A: This folder is already the real project (recommended)

Do this **once** in the project folder on your Desktop.

### 1. Find your GitHub repo URL

- In **Vercel**: Project → **Settings** → **Git** → note the **Connected Git Repository** (e.g. `https://github.com/yourusername/softr-learning-tracks-webhook-proxy` or `git@github.com:...`).
- Or open the repo on **GitHub** and click **Code** → copy the URL.

### 2. In Terminal, go to your project folder

```bash
cd /Users/alyssabuzzello/Desktop/Softr-Learning-Tracks-Webhook-Proxy
```

### 3. Connect to the existing repo

If this folder **does not** have a `.git` folder yet:

```bash
git init
git remote add origin PASTE_YOUR_REPO_URL_HERE
```

Example:

```bash
git remote add origin https://github.com/yourusername/softr-learning-tracks-webhook-proxy.git
```

If this folder **already** has a `.git` and a different remote (or none), check first:

```bash
git remote -v
```

- If `origin` points to the wrong repo:  
  `git remote set-url origin https://github.com/yourusername/your-repo-name.git`
- If there is no `origin`:  
  `git remote add origin https://github.com/yourusername/your-repo-name.git`

### 4. Sync with the repo (first time)

The repo on GitHub might have different history (e.g. from the upload). To make your Desktop folder the source of truth and match the repo:

```bash
git add -A
git commit -m "Sync local project with repo"
git branch -M main
git pull origin main --allow-unrelated-histories
```

If you get “refusing to merge unrelated histories”, that’s expected; the merge may open an editor. Save and close. If you prefer to **overwrite** the repo with only your local files (and you’re okay losing whatever was only on GitHub):

```bash
git push origin main --force
```

Otherwise, after a successful pull/merge:

```bash
git push origin main
```

### 5. From now on: commit and push to auto-deploy

Whenever you change the project:

```bash
cd /Users/alyssabuzzello/Desktop/Softr-Learning-Tracks-Webhook-Proxy
git add -A
git commit -m "Describe what you changed"
git push origin main
```

Vercel will deploy automatically when you push to `main`.

### 6. (Optional) Link Vercel to this folder for env vars

If you want to pull env vars (e.g. Redis) to this machine for local runs:

```bash
npm i -g vercel
vercel link
```

Pick the right Vercel account and project. Then:

```bash
vercel env pull .env.local
```

Use `.env.local` for local testing; don’t commit it. The Redis-related steps on the Redis page (connect project, pull env) are for this—linking the project and getting env vars locally. You do **not** need to install `redis` or use `createClient()`; see the note below.

---

## Option B: You prefer to work inside a clone of the repo

1. On GitHub, copy the repo URL.
2. On your Desktop (or wherever you want the project):

   ```bash
   cd /Users/alyssabuzzello/Desktop
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

3. Copy the contents of your current `Softr-Learning-Tracks-Webhook-Proxy` folder into this clone (overwrite files as needed).
4. Then:

   ```bash
   git add -A
   git commit -m "Use Desktop project files"
   git push origin main
   ```

5. From then on, work and commit inside this clone; push to trigger Vercel deploys.

---

## Summary

| Goal                         | Command / step                                      |
|-----------------------------|-----------------------------------------------------|
| Connect folder to repo      | `git remote add origin <repo-url>` (or set-url)    |
| First-time sync / overwrite | `git add -A` → `commit` → `git push origin main` (or `--force` if you want to replace repo history) |
| Every update + deploy       | `git add -A` → `git commit -m "..."` → `git push origin main` |
| Get env vars locally        | `vercel link` then `vercel env pull .env.local`     |
