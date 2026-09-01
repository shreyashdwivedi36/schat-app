# SChat™ — Real-Time Messaging & Spatial Communication Platform

> **Proprietary Owner & Lead Engineer**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)  
> **Live Production Platform**: [https://schat-live.onrender.com](https://schat-live.onrender.com/)  
> **Repository**: [shreyashdwivedi36/schat-app](https://github.com/shreyashdwivedi36/schat-app)

[![Node](https://img.shields.io/badge/Node.js-v20%2B%20%7C%20v24%20LTS-339933.svg?logo=node.js)](https://nodejs.org)
[![CI](https://github.com/shreyashdwivedi36/schat-app/actions/workflows/test.yml/badge.svg)](https://github.com/shreyashdwivedi36/schat-app/actions/workflows/test.yml)
[![WebSocket](https://img.shields.io/badge/WebSocket-Native%20ws-010101.svg?logo=socket.io)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Database](https://img.shields.io/badge/Database-Turso%20libSQL%20%7C%20PostgreSQL-blue.svg)](https://turso.tech)
[![Security](https://img.shields.io/badge/Auth-JWT%20Session%20Binding-green.svg)](https://jwt.io)

---

## 🌟 Overview

**SChat™** is a full-stack real-time messaging platform engineered with Node.js (Active LTS), Express, native WebSockets (`ws`), and Turso libSQL edge persistence. It features an explicit **Message Delivery & Read ACK Protocol**, **Server-Side Session Binding & Remote Revocation**, a **Mutual Contact Authorization Model**, and a responsive **Spatial UI Physics Engine** optimized for web, tablet, and mobile PWA environments.

---

## 🛠️ Core Engineering & Architecture

### 1. 🔄 Real-Time Delivery & Read ACK Protocol
SChat implements an explicit multi-stage message lifecycle rather than fire-and-forget broadcasting:
* **Sent (`○`)**: Message is received by the server and persisted to the database.
* **Delivered (`◑`)**: Recipient's active WebSocket or background Web Push Service Worker transmits an explicit delivery receipt back to the server.
* **Read (`●`)**: Sender UI transitions immediately upon the recipient focusing or viewing the message conversation.

### 2. 📱 Multi-Device Session Management
* **Device Telemetry**: Fingerprints platform (💻 Desktop / 📱 Mobile), OS, Browser engine, and IP address.
* **Active Session Registry**: Tracks active tokens in `user_sessions` with live heartbeats.
* **Remote Session Revocation**: Terminate individual unrecognized logins or broadcast a WebSocket session invalidation event across all other devices.

### 3. 🤝 Mutual Contact Authorization Model
* **Unsolicited Message Shield**: Direct messaging requires mutual acceptance (`pending` $\rightarrow$ `accepted` $\rightarrow$ `blocked`).
* **Instant Relationship Toggles**: Live state transitions for contact requests (**Send Request** ➔ **Cancel Request** ➔ **Chat** / **Remove**).
* **Scoped Search & Data Isolation**: Scoped database queries ensure private conversations and searches are accessible only to participating users.

### 4. 🎨 Spatial UI Physics & Vector System
* **1:1 Interactive Cursor Spotlight**: Hardware-accelerated radial spotlight tracking pointer coordinates in real-time.
* **Spring Elasticity & Parallax**: Magnetic button attraction and 3D card tilt angles driven by CSS spring mathematics.
* **Canvas Avatar WebP Compression**: Client-side image optimization (~20KB) with Cloudinary CDN offload.

### 5. 🎙️ Media & Communication Suite
* **Voice Notes**: Native `MediaRecorder` audio recording with canvas waveform visualizer.
* **Translation**: Inline message translation across multiple languages.
* **Ephemeral Privacy**: Gaussian privacy blur (`👁️`) and configurable self-destruct timers (`⏱️ 10s`, `1m`, `5m`, `1h`).

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                      Client Tier                       │
│     Vanilla ES6+ • MotionFX Engine • Web Audio API     │
│       Progressive Web App (PWA) • Service Worker       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────▼────────────────────────────┐
│                      Server Tier                       │
│     Node.js & Express.js • Native WebSockets (ws)      │
│    JWT Sliding Sessions • Device Telemetry Parser      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Persistence Tier                     │
│        PostgreSQL / Turso / Local Storage Engine       │
│   Entities: users, messages, sessions, contacts...     │
└────────────────────────────────────────────────────────┘
```

---

## 🧪 Automated Regression Test Suite

SChat includes an automated functional regression suite validating core security and data consistency boundaries:

```bash
node test.js
```

**Verified Test Coverage:**
1. Password Hashing & Verification (`bcryptjs`)
2. JWT Token Issuance & Session Binding Verification
3. User Registration & Profile Bio Updates
4. Message Editing & Pinning Integrity
5. Message Reactions & Quoted Reply Relationships
6. User Blocking & Unblocking Boundaries
7. Password Lifecycle Updates
8. Translation Payload & Fallback Verification
9. Message Search Privacy & Scoped Authorization Boundaries
10. Server-Side Session Revocation Guard & Database Validation
11. Server-Side Direct Message Authorization & Block Verification
12. Live WebSocket End-to-End Realtime Messaging & Authorization Integration Suite

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

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   JWT_SECRET=your_super_secret_jwt_key
   DATABASE_URL=your_postgres_or_turso_url
   SUPER_ADMIN_USERNAME=admin
   SUPER_ADMIN_PASSWORD=your_secure_password
   ```

4. **Start the local server**:
   ```bash
   npm start
   ```
   *Application will boot at `http://localhost:3000`.*

---

## 📄 License & Intellectual Property

**Copyright © 2026 Shreyash Dwivedi. All Rights Reserved.**
