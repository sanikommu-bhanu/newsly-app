# Newsly Deployment Guide

## Quick Summary

- **Backend:** Deploy to [Render.com](https://render.com) (free tier)
- **Frontend:** Deploy to [Vercel](https://vercel.com) (free tier)
- **Database:** PostgreSQL on Render.com (free tier)

---

## Backend Deployment (Render.com)

### Step 1: Create PostgreSQL Database on Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **+ New** → **PostgreSQL**
3. Fill in:
   - **Name:** `newsly-db`
   - **Region:** Choose closest to you
   - **PostgreSQL Version:** 15
   - **Plan:** Free
4. Click **Create Database**
5. Copy the **Internal Database URL** (looks like: `postgresql+asyncpg://user:password@host:5432/dbname`)

### Step 2: Deploy Backend Service

1. In Render dashboard, click **+ New** → **Web Service**
2. Connect your GitHub repository
3. Fill in:
   - **Name:** `newsly-api`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Under **Environment**, add these variables:
   ```
   DATABASE_URL = postgresql+asyncpg://...  (paste from Step 1)
   SECRET_KEY = (auto-generate or use: openssl rand -hex 32)
   ALGORITHM = HS256
   ACCESS_TOKEN_EXPIRE_MINUTES = 60
   OLLAMA_ENABLED = false
   NEWS_CACHE_TTL = 900
   CORS_ORIGINS = https://yourdomain.vercel.app
   ```
5. Click **Create Web Service**

**Note:** On free tier, services spin down after 15 minutes of inactivity. Upgrade to Hobby ($7/month) for always-on service.

### Step 3: Migrate Database Schema

After deployment starts, the database will auto-initialize on first request.

---

## Frontend Deployment (Vercel)

### Step 1: Connect Repository

1. Go to [https://vercel.com](https://vercel.com)
2. Click **+ Add New** → **Project**
3. Select your GitHub repository
4. Click **Import**

### Step 2: Configure Environment

1. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL = https://newsly-api.onrender.com
   ```
   (Replace with your actual Render backend URL)

2. Make sure:
   - **Build Command:** `next build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
   - **Node.js Version:** 18.x or higher

### Step 3: Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)

---

## Free Backend Alternatives to Render

| Platform | Tier | Pros | Cons |
|----------|------|------|------|
| **Render** | Free | Easy, PostgreSQL included, 750 free hours/month | Spins down after 15 min inactivity |
| **Railway.app** | $5 credit/month | Faster, better uptime, Python support | Credit runs out, paid after |
| **PythonAnywhere** | Free | Always-on, Python-first | Limited free tier (100MB) |
| **Fly.io** | Free + paid | Global deployment, good performance | More complex setup |
| **AWS Free Tier** | Free 12 months | EC2 + RDS included | Complex configuration |
| **Oracle Cloud** | Free forever | Generous free tier (2 VMs + DB) | Less beginner-friendly |
| **Heroku** | Paid only | Was free, now $7+/month | No longer free option |

### Recommendation: **Railway.app**
- Better uptime than Render (no spin-down)
- $5 monthly credit (usually covers your app)
- Simple deployment: `railway link` + `railway up`
- Same deployment steps as Render

---

## Environment Variables Setup

### Backend (.env for local, Render dashboard for production)

```
# Security
SECRET_KEY=your-secure-key-here  # Run: openssl rand -hex 32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Database (Render auto-sets this from PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

# AI Features (disable on Render)
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi

# Cache
NEWS_CACHE_TTL=900

# CORS (set your frontend domain)
CORS_ORIGINS=https://yourdomain.vercel.app,http://localhost:3000
```

### Frontend (.env.production for Vercel)

```
NEXT_PUBLIC_API_URL=https://newsly-api.onrender.com
```

---

## Troubleshooting

### Backend won't start
- Check logs: Render dashboard → Service → Logs
- Verify `DATABASE_URL` format is correct
- Ensure `SECRET_KEY` is set

### Frontend can't reach API
- Check `NEXT_PUBLIC_API_URL` is correct
- Test API manually: `curl https://your-api-url/health`
- Check browser console for CORS errors

### Database migration failed
- SSH into Render backend: `render logs`
- Run manually: `alembic upgrade head` (if migrations exist)
- Currently uses auto-schema-creation, so tables are created on startup

### Cold start is slow (>30s)
- Normal on free tier — service wakes up, loads RSS feeds
- Upgrade to Hobby plan to eliminate spin-down

---

## Next Steps

1. ✅ Fix all errors in code (done in this session)
2. Push to GitHub
3. Create PostgreSQL database on Render
4. Deploy backend to Render
5. Update `NEXT_PUBLIC_API_URL` in Vercel
6. Deploy frontend to Vercel
7. Test login/signup flow
8. Monitor logs for errors

---

## Security Checklist

- [ ] Change `SECRET_KEY` to something secure (`openssl rand -hex 32`)
- [ ] Update `CORS_ORIGINS` to your actual frontend domain
- [ ] Set `OLLAMA_ENABLED=false` on production
- [ ] Enable HTTPS (automatic on Vercel/Render)
- [ ] Review `.env` secrets are not committed to Git
- [ ] Set up error tracking (Sentry integration optional)

---

## Monitoring & Maintenance

### Render Dashboard
- View real-time logs
- Monitor CPU/memory usage
- Set up email notifications for deployment failures

### Vercel Dashboard
- Monitor build times and errors
- Check real user analytics
- Set up deployment notifications

---

Generated by Newsly Deployment Assistant
