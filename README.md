# 🏠 Ghar Ghar (Dots & Boxes) - Multiplayer Web Game

A nostalgic, modern web recreation of the classic paper-and-pencil game **"Ghar Ghar"** (Dots & Boxes) for **2 to 5 players**, playable seamlessly across **LAN (Local Wi-Fi)** and **WAN (Internet)**, as well as offline **Pass & Play** and **Solo vs AI**.

Optimized for **both mobile smartphones and desktop computers**, and pre-configured for instant **Cloudflare Pages** static deployment with zero backend hosting costs.

---

## ✨ Features

- 🎮 **2 to 5 Players**: Enter your name and pick from 5 distinctive ink colors (Crimson, Ocean Blue, Emerald, Amber, Royal Purple).
- 🏷️ **Initial Stamp on Claimed Homes**: When you close the 4th side of any $1 \times 1$ square, that "Ghar" (home) is claimed with your ink color and permanently stamped with the **first letter of your name** (e.g. **"A"** for Asad)!
- 🔄 **Bonus Turns**: Complete a box to immediately earn an extra turn — chain multiple homes in a single sequence!
- 📐 **Multiple Grid Sizes & Custom Grid Builder**:
  - **Casual**: `4 × 4` dots (9 homes)
  - **Classic**: `6 × 6` dots (25 homes)
  - **Medium**: `10 × 5` dots (36 homes)
  - **Large**: `15 × 8` dots (98 homes)
  - **Epic**: `20 × 10` dots (171 homes)
  - **Custom**: Configure your own custom columns (3–25) and rows (3–20) with live home calculation!
- 🌐 **LAN & WAN Multiplayer (WebRTC DataChannels)**:
  - **LAN Auto-Discovery**: When hosted on your local network, any player opening the game on the same Wi-Fi sees the running server under **"Nearby LAN Games"** and can join with a single tap!
  - **Instant QR Code**: Point any mobile phone camera at the on-screen QR code to join the game immediately.
  - **Room Codes & Direct Links**: Share a 6-character room code (e.g. `GHAR-7X2`) or copy a direct 1-click link (`?room=GHAR-7X2`).
  - **Direct P2P**: Ultra-low latency (<5ms on LAN; direct STUN traversal on WAN).
- 📱 **Mobile & Desktop Friendly**:
  - **Generous Touch Targets**: 34px invisible touch hit-boxes make drawing lines with thumbs effortless without misclicks.
  - **Pinch-to-Zoom & Pan**: Smooth multi-touch pinch zoom and drag pan for large grids, plus on-screen floating `+`, `-`, and `Fit Screen` buttons.
- 🎨 **Authentic School Notebook Aesthetics**: Realistic exercise book grid paper background with red margin line, tactile graphite dots, hand-drawn ink lines, and synthesized pencil scratching & box claim chimes via the Web Audio API.
- 🏆 **Celebration & Rematch**: Winner fanfare, celebratory confetti, complete player ranking scoreboard, and 1-click rematch.

---

## 🚀 Quick Start

### 1. Development Mode (with LAN access)
To run the hot-reloading dev server accessible by all devices on your Wi-Fi:
```bash
npm run dev
```
Vite will output your local network address (e.g., `http://192.168.1.X:5173`). Any phone or laptop on the same Wi-Fi can open that URL to play!

### 2. Standalone LAN Production Server
To run the built production server with automatic LAN discovery:
```bash
npm run build
npm run lan
```
The console will display your LAN IP and announce active rooms to nearby players.

---

## ☁️ Deploying to Cloudflare Pages

The game UI is deployed as Cloudflare Pages, and its multiplayer rooms are
coordinated by a small Cloudflare Durable Object Worker. This is what makes
room discovery and live moves work between different devices, networks, and
browsers. A Pages-only static deployment cannot provide that shared state.

### Deployment Steps:
1. Deploy the room coordinator once from the `worker` directory:
   ```bash
   cd worker
   npm install
   npm run deploy
   ```
   Keep its default name, `ghar-ghar-rendezvous`, or update the same name in
   the root `wrangler.jsonc` if you choose another name.
2. Push this repository to **GitHub** or **GitLab**.
3. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
4. Select your repository and configure the build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Before deploying, open the Pages project’s **Settings > Bindings** and add
   a Durable Object binding named `GAME_ROOMS`. Select the `GameRoom`
   namespace from the `ghar-ghar-rendezvous` Worker. (The included root
   `wrangler.jsonc` records this binding for Wrangler-based deployments.)
6. Click **Save and Deploy**.

Cloudflare Pages will build and deploy the game to a global CDN (for example,
`https://your-game.pages.dev`). Active public rooms are listed for all players
who open that deployment, and live game traffic uses a Durable Object
WebSocket, with an HTTP relay fallback when a WebSocket is unavailable.

---

## 🎯 Game Modes

1. **Online (LAN & WAN)**: Host or join multiplayer rooms with 2 to 5 human players or AI filler bots.
2. **Pass & Play**: Play on the same screen (hotseat) passing the phone/laptop between 2 to 5 players.
3. **Solo vs AI**: Play against 1 to 4 smart computer opponents.
