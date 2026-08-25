# SChat™ — Real-Time Spatial Messaging & Privacy Communication Platform

> **Proprietary Owner & Lead Engineer**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)  
> **Live Production Platform**: [https://schat-live.onrender.com](https://schat-live.onrender.com/)  
> **Intellectual Property**: SChat™ is a proprietary trademark of Shreyash Dwivedi. All Rights Reserved.

[![License](https://img.shields.io/badge/Trademark-SChat%E2%84%A2-6366f1.svg)](https://schat-live.onrender.com)
[![Node](https://img.shields.io/badge/Node.js-v18%2B-339933.svg?logo=node.js)](https://nodejs.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-Live%20Sync-010101.svg?logo=socket.io)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Security](https://img.shields.io/badge/Auth-JWT%20Sliding%20Session-green.svg)](https://jwt.io)

---

## 🌟 Overview

**SChat™** is a next-generation real-time messaging platform combining high-grade **Spatial UI Physics**, enterprise-grade **Multi-Device Session Security**, and a **Privacy-First Mutual Contact Request Model**. 

Engineered with Node.js, Express, native WebSockets (`ws`), PostgreSQL / SQLite, and a custom CSS spring-physics engine, SChat™ delivers desktop-class performance and liquid responsiveness across web, tablet, and mobile PWA environments.

---

## ✨ Flagship Capabilities

### 🎨 1. Real Profile Photos & 8 Handcrafted Graphic Avatars
- **Real Photo Upload Engine**: Client-side 256x256 HTML5 Canvas WebP compression (~20KB) with Cloudinary CDN offload and instant live previews.
- **8 Handcrafted Graphic SVG Artworks (Zero Emojis)**: Standalone vector illustrations (*Cosmic Astronaut*, *Cyber Samurai*, *Mecha Robot*, *Neon Wolf*, *Liquid Chrome*, *Phantom Ninja*, *Synthwave Sun*, *Phoenix Flame*).
- **Preset Avatar Gallery**: 1-tap preset avatar equipping in Profile Settings with automatic checkmark tracking.
- **Cinematic Avatar Maximize Lightbox**: Fullscreen 35px glassmorphism modal with ambient neon back-glow and anti-download protection.

### 🌟 2. Full 1,800+ Unicode Emoji Suite & Search
- **Complete Unicode Library**: Integrated all 1,800+ official emojis across 9 categories.
- **Instant Keyword Search**: Live fuzzy search bar finding any emoji in milliseconds.
- **Skin Tone Modifiers & Recents**: Fast access to favorite skin tones and pinned recently used emojis.
- **Smart Cursor Insertion**: Inserts emojis at your exact typing cursor position in the message bar.

### 📱 3. Active Multi-Device Session Management
- **Device & Browser Fingerprinting**: Live telemetry tracking device type (💻 Desktop / 📱 Mobile), OS (Windows, macOS, iOS, Android, Linux), Browser engine, and IP address.
- **Current Device Protection**: Highlights the active viewing device as `This Device (Active Now)` to prevent accidental self-disconnection.
- **Remote Session Revocation**: Terminate individual unrecognized logins or use **"Log Out All Other Devices"** to instantly broadcast WebSocket session termination and invalidate tokens remotely.

### 🤝 4. Privacy-First Contact Request System
- **Clean Direct Messages**: Unsolicited direct messages are blocked by default. Only **Mutual Accepted Contacts** appear in the Direct Messages sidebar.
- **Search & Connect**: Discover other users by `@username` and send private chat requests with instant zero-refresh button toggles (**Send Request** ➔ **Cancel Request** ➔ **Chat** / **Remove**).
- **Pending Requests Inbox**: Incoming requests trigger real-time notifications with instant **Accept** or **Decline** actions.

### 🎨 5. Spatial UI Physics & Vector Iconography
- **1:1 Interactive Cursor Spotlight**: Hardware-accelerated dynamic radial spotlight tracking mouse coordinates in real time with 0% idle CPU overhead.
- **Magnetic Snap Hover**: Buttons and channels feature magnetic attraction with mathematical CSS `linear()` spring elasticity.
- **3D Parallax Tilt**: Interactive card tilt angles responding directly to pointer coordinates.
- **Crisp SVG Vector System**: Unified, pixel-perfect 1.85px stroke SVG line vector icons.

### 🎙️ 6. Voice Notes & Waveform Engine
- Native `MediaRecorder` audio recording with 16kbps Opus compression.
- Live canvas audio waveform visualizer during recording and playback.
- Cloudinary media offloading with optimistic UI delivery and sweeping progress animations.

### 🌐 7. Live Multilingual Translation
- Instant inline message translation powered by Google Translate API for seamless cross-language communication.

### ⏱️ 8. Ephemeral Privacy Messages
- Toggleable Gaussian privacy blur (`👁️`) to prevent shoulder surfing.
- Configurable self-destruct timers (`⏱️ 10s`, `1m`, `5m`, `1h`) with synchronized countdown badges.

---

## 🛠️ Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────┐
   │                     Client Tier                        │
   │  Vanilla ES6+ • MotionFX Engine • Web Audio Synthesizer│
   │       Progressive Web App (PWA) • Service Worker       │
   └───────────────────────────┬────────────────────────────┘
                               │ HTTPS / WSS
   ┌───────────────────────────▼────────────────────────────┐
   │                     Server Tier                        │
   │      Node.js & Express.js • Native WebSockets (ws)     │
   │     JWT Sliding Auth • User-Agent Device Parser        │
   └───────────────────────────┬────────────────────────────┘
                               │
   ┌───────────────────────────▼────────────────────────────┐
   │                   Persistence Tier                     │
   │    PostgreSQL (Production) / Local Fallback Store      │
   │  Tables: users, user_sessions, contacts, messages...   │
   └────────────────────────────────────────────────────────┘
```

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shreyashdwivedi36/schat-app.git
   cd schat-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local server**:
   ```bash
   npm start
   ```
   *Application will boot at `http://localhost:3000`.*

---

## 📄 License & Intellectual Property

**Copyright © 2026 Shreyash Dwivedi. All Rights Reserved.**

SChat™ and all associated source code, design assets, and documentation are proprietary works. Unauthorized copying, distribution, or reproduction is strictly prohibited.
