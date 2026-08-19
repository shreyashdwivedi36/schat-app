# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.0] - 2026-08-19

### ✨ Added
- **Media Deduplication**: Implemented a SHA-256 file hashing system to create a registry of uploaded files. Duplicate uploads are caught locally and bypass the network, resulting in instant broadcasts and significant storage savings.
- **Client-Side Media Compression**: Built an HTML5 Canvas engine that intercepts large images and compresses them into lightweight WebP payloads before uploading.
- **Progressive Image Loading**: The UI dynamically constructs Cloudinary URLs to deliver instant 20px blurred placeholders that smoothly transition into high-resolution images as they load.
- **Uncompressed Document Uploads**: Added a WhatsApp-style dropdown menu allowing users to choose between compressed Photos or full-resolution Documents.
- **Automated Storage Management**: Added a Node.js background loop that uses the Cloudinary Admin API to automatically delete media older than 30 days, keeping the app within free-tier limits.
- **Native Context Menu Media Downloads**: Added an option in the right-click context menu to fetch and save original-quality Voice Notes and Images directly to device storage.
- **Global Channel Media Moderation**: Disabled media uploading in the Global Chat to prevent spam, restricting heavy Cloudinary uploads strictly to 1-on-1 private messaging.

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

## [v1.0.1] - 2026-08-15

### ✨ Added
- **Live Inline Translation**: Integrated Google Translate API for one-click message translation.
- **Progressive Web App (PWA)**: Added service worker, manifest, and offline caching allowing the app to be installed to mobile home screens.
- **Audio Waveform Visualizer**: Added dynamic real-time visualization to the voice message recorder.

## [v1.0.0] - 2026-08-10

### 🎉 Initial Release
- **Core Architecture**: Node.js, Express, WebSockets, JWT Authentication, and SQLite/PostgreSQL.
- **Real-Time Messaging**: Built a persistent WebSocket server for instant 1-on-1 direct messages and a global channel.
- **Voice Messages**: Native MediaRecorder implementation with Cloudinary offloaded storage and Opus compression.
- **Glassmorphism UI**: Beautiful, frosted responsive layout for mobile and desktop.
- **Message Interactions**: Implemented context menus for Edit, Delete, Pin, and Reply.
- **Privacy Features**: Added toggleable Gaussian privacy blur and customizable self-destruct timers.
- **Security**: Full signup/login flows secured by Bcrypt password hashing.
