# ☁️ Deploying BioLens AI to Cloudflare Pages

This project is fully configured for seamless, zero-friction deployment to **Cloudflare Pages**. 

We have implemented a dual-mode backend architecture:
1. **Local Development / Cloud Run (Express)**: Powers the active preview on Google AI Studio.
2. **Production Serverless (Cloudflare Pages Functions)**: Automatically powers your backend API routes (`/api/*`) on Cloudflare's ultra-fast Edge Network completely free of charge.

---

## 🚀 Step-by-Step Deployment Guide

### Option A: Direct Upload (No Git Required)

1. **Build the Project locally**:
   - Install dependencies: `npm install`
   - Build the production assets: `npm run build`
   - This creates a static `dist` directory.

2. **Upload to Cloudflare**:
   - Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
   - Click **Create** -> **Pages** -> **Upload assets**.
   - Name your project (e.g., `biolens-ai`).
   - Drag and drop or upload the generated `dist` folder.
   - **Important**: Cloudflare will automatically detect the `/functions` directory in your root folder and compile them into serverless Edge Workers!

---

### Option B: Connect to GitHub (Continuous Deployment)

1. Create a new GitHub repository and push your extracted ZIP contents to it.
2. Go to the Cloudflare Dashboard and navigate to **Workers & Pages**.
3. Click **Create** -> **Pages** -> **Connect to Git**.
4. Select your repository.
5. In the **Build settings** section, use the following configuration:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)
6. Click **Save and Deploy**.

---

## 🔑 Environment Variables Configuration

Since this app uses Gemini AI for chemical and ingredient analysis, you **MUST** set your Gemini API Key in the Cloudflare Pages settings:

1. In the Cloudflare Pages dashboard, select your deployed project.
2. Go to the **Settings** tab -> **Environment variables**.
3. Click **Add variables** under the **Production** (and optionally **Preview**) section.
4. Add the following variable:
   - **Variable name**: `GEMINI_API_KEY`
   - **Value**: *Your Gemini API Key from Google AI Studio*
5. Click **Save**.
6. **Redeploy** your latest build (under the **Deployments** tab, click the three dots next to the active deployment and select **Rollback** or build a new deployment) so that the environment variable becomes active.

---

## 🛠️ Architecture Highlights

- **Edge Performance**: The `/functions` directory implements Pages Functions. Cloudflare compiles these automatically into V8-isolated Workers, serving API requests with sub-millisecond cold starts.
- **Zero-Dependency Gemini API**: The Pages Functions call Gemini using a lightweight, standard `fetch` pipeline. This bypasses heavy Node.js libraries, ensuring full compatibility with the Cloudflare Workers runtime.
- **Failover Mechanism**: If a 429 (Rate Limit) or 503 (Busy) occurs on Gemini, the serverless functions automatically failover and retry with exponential backoff and dynamic model selection.
