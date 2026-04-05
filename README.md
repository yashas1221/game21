# 🥊 KNOCKOUT — Pavan vs Yashas Boxing Game

A fully playable 3D browser boxing game built with Three.js.

---

## 🎮 HOW TO PLAY

### Desktop Controls
| Key | Action |
|-----|--------|
| `A / D` | Move left / right |
| `W / S` | Move forward / back |
| `J` | Jab (fast, low damage) |
| `K` | Cross (slow, high damage) |
| `L` | Block (hold) |
| `Shift` | Dodge right |
| `P` or `Esc` | Pause |

### Mobile Controls
- **Left joystick** → Move your fighter
- **JAB** button → Fast punch
- **CROSS** button → Power punch
- **BLOCK** button → Hold to block
- **DODGE** button → Dodge sideways

---

## ⚡ FEATURES
- 🥊 Jab, Cross, Block, Dodge
- 🔄 Combo system (3+ hits = COMBO!)
- 💪 Stamina system (punching drains stamina)
- 🧠 AI with 3 difficulty levels (Easy / Medium / Hard)
- 📷 Dynamic camera follow + camera shake on hits
- 🎬 Slow-motion KO effect
- 💢 Health bars + stamina bars
- ⏱ Round timer (3 rounds × 3 minutes)
- 📱 Mobile-friendly with virtual joystick
- 🎵 Procedural audio (jab, cross, block, KO sounds)

---

## 📁 FILE STRUCTURE

```
boxing-game/
├── index.html    ← Main HTML + game layout
├── style.css     ← All visual styles
├── script.js     ← Full game engine (Three.js)
└── README.md     ← This file
```

No build step required. Open `index.html` in any modern browser.

---

## 🚀 DEPLOYMENT GUIDE

---

### 🐙 METHOD 1 — GitHub Pages (Free Hosting)

#### Step 1: Create a GitHub Account
- Go to [github.com](https://github.com) → Sign up (free)

#### Step 2: Create a New Repository
1. Click the **+** button (top right) → **New repository**
2. Name it: `boxing-game` (or anything you like)
3. Set it to **Public**
4. ✅ Check **"Add a README file"**
5. Click **Create repository**

#### Step 3: Upload Your Files
**Option A — Using the GitHub website (easiest):**
1. Open your new repository
2. Click **"uploading an existing file"** (or drag & drop)
3. Upload all 3 files: `index.html`, `style.css`, `script.js`
4. Scroll down → Click **"Commit changes"**

**Option B — Using Git (command line):**
```bash
# 1. Clone your new empty repo
git clone https://github.com/YOUR_USERNAME/boxing-game.git

# 2. Copy your game files into the folder
# 3. Then:
cd boxing-game
git add .
git commit -m "Add boxing game files"
git push origin main
```

#### Step 4: Enable GitHub Pages
1. In your repository, click **Settings** (top tab)
2. Scroll down to **Pages** (left sidebar)
3. Under **Source**, select **"Deploy from a branch"**
4. Branch: **main** | Folder: **/ (root)**
5. Click **Save**
6. Wait ~60 seconds
7. Your game is live at:  
   `https://YOUR_USERNAME.github.io/boxing-game/`

#### Step 5: Update Your Game
1. Make changes to your files locally
2. Re-upload on GitHub (drag & drop again, or use git push)
3. GitHub Pages auto-updates within ~30 seconds

---

### ⚡ METHOD 2 — Netlify (Fastest + Free)

#### Option A: Drag & Drop (No account setup needed)

1. Go to [netlify.com](https://netlify.com) → Sign up (free)
2. Go to your **Netlify dashboard**
3. Look for the drag & drop zone that says:  
   **"Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"**
4. Create a folder called `boxing-game/` containing your 3 files
5. **Drag the entire folder** onto that zone
6. Done! Netlify gives you a URL like:  
   `https://random-name-123.netlify.app`
7. You can rename it in **Site settings → Change site name**

#### Option B: Netlify + GitHub Integration (Best for updates)

1. Push your game to GitHub (follow Step 1–3 above)
2. Go to [netlify.com](https://netlify.com) → Log in
3. Click **"Add new site"** → **"Import an existing project"**
4. Choose **"Deploy with GitHub"**
5. Authorize Netlify to access your GitHub
6. Select your `boxing-game` repository
7. Settings:
   - **Branch to deploy:** `main`
   - **Base directory:** *(leave empty)*
   - **Build command:** *(leave empty)*
   - **Publish directory:** *(leave empty or `.`)*
8. Click **"Deploy site"**
9. Your site goes live in ~10 seconds at a Netlify URL

#### Updating Your Netlify Site After Changes

**If using GitHub integration:**
```bash
git add .
git commit -m "Update game"
git push origin main
# Netlify auto-deploys within seconds!
```

**If using drag & drop:**
- Go to your site in Netlify dashboard
- Click **Deploys** tab
- Drag your updated folder onto the deploy zone again

---

## 🌐 CUSTOM DOMAIN (Optional)

Both GitHub Pages and Netlify support free custom domains:
- **GitHub:** Settings → Pages → Custom domain
- **Netlify:** Site settings → Domain management → Add custom domain

---

## 🛠 LOCAL TESTING

Because Three.js loads scripts, you may need a local server to test:

**Using Python (easiest):**
```bash
cd boxing-game
python3 -m http.server 8080
# Open: http://localhost:8080
```

**Using Node.js:**
```bash
npx serve .
# Open the URL shown
```

**Or just use VS Code with the "Live Server" extension.**

---

## 📱 MOBILE PERFORMANCE TIPS
- The game auto-detects mobile and shows virtual controls
- Runs well on mid-range phones (tested on Chrome/Safari)
- Pixel ratio is capped at 2x for performance
- Shadows are low-resolution for speed

---

## 🎨 CUSTOMIZATION

To change player names, edit `index.html`:
```html
<div class="fighter-name">PAVAN</div>   <!-- Change this -->
<div class="fighter-name">YASHAS</div>  <!-- Change this -->
```

To change AI difficulty defaults or damage values, edit `script.js`:
```javascript
const CONFIG = {
  PUNCH_JAB_DAMAGE: 8,    // Jab damage
  PUNCH_CROSS_DAMAGE: 18, // Cross damage
  ROUND_TIME: 180,        // Seconds per round
  ROUNDS: 3,              // Number of rounds
  ...
};
```
