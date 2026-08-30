# Changelog

All notable changes to this project will be documented in this file.

## [v1.7.0] - 2026-08-30

### 🚀 Turso Cloud Database Integration & Edge Scaling
- **Turso libSQL Engine**: Integrated `@libsql/client` into `db.js`, establishing a high-performance distributed edge persistence tier with multi-gigabyte storage capacity and low-latency query performance.

### 🔒 Production Security & Fail-Closed Boundaries
- **Fail-Closed Authentication Engine**: Re-engineered `verifyUserSession` to fail closed (`return null`) on database connection or query failures, preventing unauthenticated access during transient database outages.
- **Strict Session ID Requirement**: Mandated `sessionId` validation for all standard user JWTs, blocking legacy or sessionless tokens.
- **Atomic Session Binding on Login & Registration**: Enforced mandatory session persistence prior to JWT issuance in `/api/login` and `/api/register`.
- **WebSocket Origin Validation**: Added `req.headers.origin` verification against `ALLOWED_ORIGINS` during WebSocket handshakes to prevent Cross-Site WebSocket Hijacking (CSWSH).
- **API Hygiene**: Removed deprecated unauthenticated `/api/push-logs` route.
- **Sanitized Health Telemetry**: Removed internal database error messages from public `GET /api/health` 503 response.

### 🐳 Infrastructure Modernization
- **Node.js 24 LTS Upgrade**: Upgraded Docker base image to `node:24-alpine` (Active LTS).

### 🧪 11-Suite Automated Regression Coverage
- **100% Pass Rate**: Validated all 11 test suites covering fail-closed boundaries, password hashing, session tokens, DM authorization, blocklist isolation, and search scoping.

---

## [v1.6.0] - 2026-08-25

### 🎨 Real Profile Photos & Handcrafted Vector Graphic Avatars
- **Real Photo Upload Engine**: Integrated client-side 256x256 HTML5 Canvas WebP compression (~20KB), Cloudinary CDN offloading with local data URL fallback, instant live preview rendering, and anti-download protection.
- **8 Handcrafted Graphic SVG Avatars (Zero Emojis)**: Created a suite of standalone, high-resolution vector illustrations:
  - 🌌 *Cosmic Astronaut*: 3D Space Explorer with golden reflective visor and starfield nebula (`/avatars/cosmic-astronaut.svg`).
  - ⚡ *Cyber Samurai*: Cyberpunk warrior with neon purple mask and glowing battle crest (`/avatars/cyber-samurai.svg`).
  - 🤖 *Mecha Robot*: Titanium AI Droid with glowing cyan optics and circuit detailing (`/avatars/mecha-robot.svg`).
  - 🦊 *Neon Wolf*: Geometric low-poly wolf with neon cyan and violet facets (`/avatars/neon-wolf.svg`).
  - 🔮 *Liquid Chrome*: 3D iridescent mercury sphere with fluid reflections (`/avatars/liquid-chrome.svg`).
  - 🥷 *Phantom Ninja*: Tactical shinobi in dark hood with emerald ocular visor (`/avatars/phantom-ninja.svg`).
  - 🌅 *Synthwave Sun*: 80s retro neon sunset with wireframe horizon (`/avatars/synthwave-sun.svg`).
  - 🔥 *Phoenix Flame*: Incandescent fire phoenix crest with golden-amber feathers (`/avatars/phoenix-flame.svg`).
- **Profile Settings Preset Avatar Gallery**: Interactive 4x2 visual card grid in Profile Settings featuring 1-tap live equipping, active checkmark badges, and automatic preset deselection when uploading custom gallery photos.
- **Clean Auth Registration**: Streamlined the **Create Account** form by removing the outdated emoji selector and defaulting new accounts to the Cosmic Astronaut avatar.

### 🔍 Cinematic Avatar Maximize Lightbox
- **Fullscreen Glassmorphism Viewer**: 35px backdrop blur and ambient neon back-glow.
- **Root Layering**: Relocated lightbox dialog directly to `<body>` root (`z-index: 999999`) to escape CSS parent stacking contexts.
- **Precision Click Targets**: Separated avatar click (opens high-res lightbox) from username/bio click (opens Profile Settings).

### 🌟 Full 1,800+ Unicode Emoji Suite
- **Complete Unicode Library**: Integrated all 1,800+ official emojis across 9 categories (`Smileys`, `People`, `Animals`, `Food`, `Travel`, `Activities`, `Objects`, `Symbols`, `Flags`).
- **Instant Keyword Search**: Live fuzzy search bar indexing emoji aliases in milliseconds.
- **Skin Tone Modifiers & Recents Tab**: Select custom skin tones and access frequently used emojis instantly.
- **Cursor-Aware Insertion**: Inserts emojis at the exact cursor position in the message bar without losing input focus.

### ⚙️ Modern Tabbed Profile Settings Modal
- **Expansive Glassmorphism Layout**: Redesigned modal with a 580px wide frosted card and top Hero Avatar banner.
- **Segmented Tabs**: Smooth switching between `👤 Profile`, `🔒 Security`, and `💻 Active Devices`.
- **Session Deduplication**: Optimized session telemetry so each physical browser instance appears once with `[THIS DEVICE]`.

### 📎 Modern Attachment Popover Menu
- **Sleek Action Sheet**: Replaced the plain dropdown with vibrant Cyan & Indigo gradient icon badges and clean two-line typography (`Photos & Videos`, `Documents & Files`).

### ⚡ Zero-Refresh Contact Actions & Database Engine Integrity
- **Instant Real-Time UI Toggles**: Real-time state toggling between **Send Request**, **Cancel Request**, and **Remove Contact** with 0-refresh instantaneous button updates.
- **Database Query Matchers**: Added 3-param and 4-param `DELETE FROM contacts WHERE` handlers in `db.js` so cancellations and contact removals permanently delete from the database without bouncing back.

### 🛡️ PWA Precache & Complete Integration Test Suite
- **Offline PWA Precache**: Precached all 8 SVG vector graphic avatars and `motion-fx.js` in Service Worker (`v=117`).
- **Automated Integration Testing**: 5/5 passed with 0 errors across sessions, avatars, contacts, and messaging APIs.

---

## [v1.5.0] - 2026-08-23

### 📱 Active Multi-Device Sessions & Device Security
- **Multi-Device Login Telemetry**: Added database-backed active session tracking (`user_sessions`) capturing OS (Windows, macOS, iOS, Android, Linux), browser engine, IP address, and last-active timestamps.
- **Current Device Safety**: Highlighted the active viewing device as `This Device (Active Now)` with protection against accidental self-revocation.
- **Remote Session Revocation**: Users can terminate any remote login individually or execute **"Log Out All Other Devices"** with real-time WebSocket disconnection.
- **JWT Session Binding**: Embedded unique session tokens in JWT payloads with automatic sliding session renewal.

### 🤝 Privacy-First Contact Request System
- **Mutual Permission Model**: Replaced unrestricted user listings with a mutual contact request architecture (`contacts`). Only accepted contacts appear in the Direct Messages sidebar.
- **Find & Add Contacts**: Added a search modal to discover users by `@username` and dispatch private chat requests.
- **Dynamic Request Lifecycle**:
  - Tapping **"Send Request"** immediately transforms into an active **"Cancel Request"** button with visual toast confirmation.
  - Tapping **"Cancel Request"** takes back the request and removes the notification from the recipient's screen in real time.
  - If the recipient declines, the button automatically resets to **"Send Request"**.
  - If accepted, the button transforms into **"Chat"** and adds the contact to the active DM list.
- **High-Visibility Notification Surfaces**:
  - Interactive toast chime: `📩 @username sent you a chat request!`.
  - Prominent glowing animated banner above the Direct Messages list: `📩 1 pending chat request [Review]`.
  - Pulsing `📥 Requests (N)` pill badge next to section header.
- **Revoke Connection**: Added **"Remove Contact"** in the context menu to un-link and remove contacts from both users' screens.

### 🎨 Spatial UI Physics & Vector Iconography Overhaul
- **1:1 Interactive Cursor Spotlight**: Zero-idle-CPU dynamic radial spotlight tracking mouse coordinates across the standby screen.
- **Magnetic Snap Hover & 3D Tilt**: Magnetic attraction on action buttons with mathematical CSS `linear()` spring elasticity and 3D parallax tilt hover physics.
- **Universal SVG Vector System**: Replaced all raw Unicode emojis with unified, pixel-perfect 1.85px stroke SVG line vector icons.
- **Clean Standby Privacy Shield**: Borderless floating SChat emblem with ambient backlight drop shadow and isolated message stream transitions.

### 🛡️ Core Reliability & Brand Protection
- **SChat™ Trademark Branding**: Branded metadata, headers, and copyright notices with official `™` notation.
- **Cryptographic SHA-256 Ownership Proof**: Generated `proof_of_ownership.json` and captured immutable public snapshots on the Wayback Machine.

---

## [v1.2.0] - 2026-08-19

### ✨ Added
- **Optimistic Media Rendering**: Implemented a seamless optimistic UI system that instantly displays local image and document previews with a sweeping glow animation while Cloudinary uploads process in the background.
- **Dynamic Welcome Greeting**: The home screen now features a personalized, time-sensitive greeting (Good morning/afternoon/evening, [User]) based on the user's local timezone.
- **Quick Close Chat Navigation**: Added a convenient '✖' button to the active chat header for one-click navigation back to the welcome screen.
- **Lightbox Image Viewer**: Added a native, responsive full-screen lightbox for viewing high-resolution image attachments.

### 🐛 Fixed
- Patched a fatal ReferenceError ('White Screen of Death') caused by global scope leakage in the app.js closure.
- Fixed an issue where the context menu 'Download' and 'Copy' event listeners were improperly nested, rendering them inactive.
- Fixed a bug where Read Receipts (Blue Ticks) wouldn't map to the correct message cards in the DOM due to missing recipient ID bindings.
- Fixed Cloudinary direct downloads opening in a new blank browser tab.
- Adjusted the mobile font size and line-height of the welcome greeting to prevent awkward multiline wrapping.
- Disabled the sidebar from automatically opening on mobile devices when closing an active chat.

### ✨ Added (continued)
- **Media Deduplication**: Implemented a SHA-256 file hashing system to create a registry of uploaded files. Duplicate uploads are caught locally and bypass the network, resulting in instant broadcasts and significant storage savings.
- **Client-Side Media Compression**: Built an HTML5 Canvas engine that intercepts large images and compresses them into lightweight WebP payloads before uploading.
- **Progressive Image Loading**: The UI dynamically constructs Cloudinary URLs to deliver instant 20px blurred placeholders that smoothly transition into high-resolution images as they load.
- **Uncompressed Document Uploads**: Added a WhatsApp-style dropdown menu allowing users to choose between compressed Photos or full-resolution Documents.
- **Automated Storage Management**: Added a Node.js background loop that uses the Cloudinary Admin API to automatically delete media older than 30 days, keeping the app within free-tier limits.
- **Native Context Menu Media Downloads**: Added an option in the right-click context menu to fetch and save original-quality Voice Notes and Images directly to device storage.
- **Global Channel Media Moderation**: Disabled media uploading in the Global Chat to prevent spam, restricting heavy Cloudinary uploads strictly to 1-on-1 private messaging.

---

## [v1.1.0] - 2026-08-18

### ✨ Added
- **Premium UI Polish**: Standardized shape radiuses and shadow tints, introduced tactile button physics, and removed heavy graphical filters to ensure a buttery smooth 60fps scrolling experience.
- **Date Dividers**: Implemented dynamically rendered chat date categorization dividers.
- **Read Receipts & Delivery Status**: Implemented a complete pipeline for message statuses. Messages now progress from Sent to Delivered and Read, mirroring WhatsApp.
- **Privacy-Focused Contacts**: The sidebar now defaults to showing only users you have previously chatted with, preventing strangers from cluttering your view.
- **Global Search**: The search bar instantly queries the global user registry. Searching and messaging a new user automatically permanently adds them to your recent chats list.
- **Real-Time Typing Indicators**: Added real-time indicators scoped accurately to active 1-on-1 conversations.

### 🐛 Fixed
- Phantom typing indicators appearing across all active clients.
- Status synchronisation issues across active tabs.

---

## [v1.0.1] - 2026-08-15

### ✨ Added
- **Live Inline Translation**: Integrated Google Translate API for one-click message translation.
- **Progressive Web App (PWA)**: Added service worker, manifest, and offline caching allowing the app to be installed to mobile home screens.
- **Audio Waveform Visualizer**: Added dynamic real-time visualization to the voice message recorder.

---

## [v1.0.0] - 2026-08-10

### 🎉 Initial Release
- **Core Architecture**: Node.js, Express, WebSockets, JWT Authentication, and SQLite/PostgreSQL.
- **Real-Time Messaging**: Built a persistent WebSocket server for instant 1-on-1 direct messages and a global channel.
- **Voice Messages**: Native MediaRecorder implementation with Cloudinary offloaded storage and Opus compression.
- **Glassmorphism UI**: Beautiful, frosted responsive layout for mobile and desktop.
- **Message Interactions**: Implemented context menus for Edit, Delete, Pin, and Reply.
- **Privacy Features**: Added toggleable Gaussian privacy blur and customizable self-destruct timers.
- **Security**: Full signup/login flows secured by Bcrypt password hashing.
