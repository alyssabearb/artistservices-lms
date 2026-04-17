# Fix "No GitHub account matching commit author" / "Commit author is required"

Your commits were made with an email Git made up from your computer (`...@Alyssas-MacBook-Pro.local`), which GitHub and Vercel don’t recognize.

## 1. Set your Git identity (one-time)

In **Terminal**, run **one** of these:

**Option A – Use GitHub’s private noreply email (recommended)**  
(Replace `alyssabearb` with your GitHub username if different.)

```bash
git config --global user.email "alyssabearb@users.noreply.github.com"
git config --global user.name "alyssabearb"
```

**Option B – Use the same email you use to log in to GitHub**

```bash
git config --global user.email "your-email@example.com"
git config --global user.name "alyssabearb"
```

To see your GitHub noreply address: GitHub → **Settings** → **Emails** → under “Keep my email addresses private” you’ll see `username@users.noreply.github.com`.

## 2. Fix the last commit in this project

From the project folder:

```bash
cd /Users/alyssabuzzello/Desktop/Softr-Learning-Tracks-Webhook-Proxy
git commit --amend --reset-author --no-edit
git push origin main --force
```

That rewrites the last commit to use the new author and updates GitHub. Vercel will then see a valid commit author and can deploy.

## 3. From now on

All new commits will use the identity you set in step 1, so you shouldn’t see this error again.
