# PULSE — Animated Realtime WebSocket Chat Application

A complete, production-ready full-stack real-time chat application built with **Node.js**, **Express**, **WebSockets (`ws`)**, **JWT Authentication**, and an interactive **Animated Glassmorphism Frontend**.

---

## ✨ Features

- **Authentication System**: User Registration & Login with password hashing (`bcryptjs`) and secure JWT session tokens (`jsonwebtoken`).
- **Real-Time WebSockets**: Instant message broadcast, presence indicators (Online/Offline status), and live dancing-dot typing indicators ("Alice is typing...").
- **Animated UI/UX**:
  - Dark glassmorphism interface with floating background radial gradients.
  - Smooth card transitions between Login & Register views.
  - Avatar selection picker.
  - Keyframe entrance animations for message bubbles.
  - Audio SFX synthesis using Web Audio API (subtle incoming/outgoing message chimes).
  - Emoji picker with animation.
- **Message Persistence**: SQLite database storage for users & messages history.
- **Responsive Design**: Optimized for Desktop, Tablet, and Mobile devices.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, WebSockets (`ws`), SQLite3 / File-backed DB, JWT, Bcrypt
- **Frontend**: HTML5, CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism, Keyframe Animations), Vanilla ES6 JavaScript (Fetch API, WebSockets API, Web Audio API)

---

## 🚀 Quick Start (Local Run)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:3000`

---

## 🐙 Publishing to GitHub

To push this project to your GitHub repository:

1. **Initialize Git Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Pulse Realtime Chat WebApp"
   ```

2. **Create a new repository on GitHub** (e.g. `pulse-chat-app`).

3. **Link Local Repository to GitHub & Push**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/pulse-chat-app.git
   git push -u origin main
   ```

---

## 🌐 Deploying to the Web

### Option A: Deploy on Render (Recommended & Free)
1. Log in to [Render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`pulse-chat-app`).
4. Set Build Command: `npm install`
5. Set Start Command: `node server.js`
6. Click **Create Web Service**. Your app will be live with full WebSocket support!

### Option B: Deploy with Docker
```bash
docker build -t pulse-chat-app .
docker run -p 3000:3000 pulse-chat-app
```
