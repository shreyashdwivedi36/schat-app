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

### 📱 1. Active Multi-Device Session Management
- **Device & Browser Fingerprinting**: Live telemetry tracking device type (💻 Desktop / 📱 Mobile), OS (Windows, macOS, iOS, Android, Linux), Browser engine, and IP address.
- **Current Device Protection**: Highlights the active viewing device as `This Device (Active Now)` to prevent accidental self-disconnection.
- **Remote Session Revocation**: Terminate individual unrecognized logins or use **"Log Out All Other Devices"** to instantly broadcast WebSocket session termination and invalidate tokens remotely.

### 🤝 2. Privacy-First Contact Request System
- **Clean Direct Messages**: Unsolicited direct messages are blocked by default. Only **Mutual Accepted Contacts** appear in the Direct Messages sidebar.
- **Search & Connect**: Discover other users by `@username` and send private chat requests.
- **Dynamic Request Lifecycle**: Instant visual feedback with **Send Request** ➔ **Cancel Request** ➔ **Chat** dynamic state management.
- **Pending Requests Inbox**: Incoming requests trigger real-time notifications with instant **Accept** or **Decline** actions.
- **Revoke Connection**: Either user can remove a contact at any time, instantly removing the conversation from both users' screens.

### 🎨 3. Spatial UI Physics & Vector Iconography
- **1:1 Interactive Cursor Spotlight**: Hardware-accelerated dynamic radial spotlight tracking mouse coordinates in real time with 0% idle CPU overhead.
- **Magnetic Snap Hover**: Buttons and channels feature magnetic attraction with mathematical CSS `linear()` spring elasticity.
- **3D Parallax Tilt**: Interactive card tilt angles responding directly to pointer coordinates.
- **Crisp SVG Vector System**: Replaced all raw Unicode emojis with unified, pixel-perfect 1.85px stroke SVG line vector icons.

### 🎙️ 4. Voice Notes & Waveform Engine
- Native `MediaRecorder` audio recording with 16kbps Opus compression.
- Live canvas audio waveform visualizer during recording and playback.
- Cloudinary media offloading with optimistic UI delivery and sweeping progress animations.

### 🌐 5. Live Multilingual Translation
- Instant inline message translation powered by Google Translate API for seamless cross-language communication.

### ⏱️ 6. Ephemeral Privacy Messages
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
