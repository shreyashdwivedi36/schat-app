# Changelog

All notable changes to this project will be documented in this file.

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
