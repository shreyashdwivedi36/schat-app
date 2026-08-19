# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.0] - 2026-08-19

### ✨ Added
- **Enterprise Media Deduplication**: Engineered a cryptographic SHA-256 Web Crypto hashing engine that creates a globally unique registry of files. Duplicate uploads bypass the network entirely, resulting in 0ms instant broadcasts for viral content and massive storage savings.
- **Client-Side Media Compression**: Implemented an optimized HTML5 Canvas engine that intercepts heavy images and compresses them into lightweight 200KB WebP payloads before they even touch the network.
- **Just-in-Time Blurred Previews**: Upgraded the UI rendering engine to dynamically construct Cloudinary URLs, delivering instant 20px blurred placeholders (`e_blur:200`) that elegantly crossfade into high-resolution images as they load in the background.
- **Uncompressed Document Uploads**: Upgraded the attachment button to a WhatsApp-style floating dropdown menu, allowing users to choose between compressed Photos or full-resolution Documents.
- **Automated Cloudinary Auto-Purge**: Built a lightweight Node.js cron job that securely interfaces with Cloudinary's Admin API to permanently delete expired media older than 30 days to protect free-tier storage.
- **Native Context Menu Media Downloads**: Upgraded the right-click context menu to support direct Blob fetching, allowing users to save original-quality Voice Notes and Images directly to their physical device storage.
- **Global Channel Media Moderation**: Disabled media uploading in the Global Chat to prevent uncontrolled storage bloat, restricting heavy Cloudinary uploads strictly to 1-on-1 private messaging.

## [v1.1.0] - 2026-08-18

### ✨ Added
- **Premium UI Polish**: Standardized shape radiuses and shadow tints, introduced tactile button physics, and removed heavy graphical filters to ensure a buttery smooth 60fps scrolling experience.
- **Date Dividers**: Implemented dynamically rendered chat date categorization dividers.
- **Read Receipts & Delivery Status**: Implemented a complete pipeline for message statuses. Messages now progress from Sent (?) to Delivered (?? grey) and Read (?? blue), mirroring WhatsApp.
- **Privacy-Focused Contacts**: The sidebar now defaults to showing only users you have previously chatted with, preventing strangers from cluttering your view.
- **Global Search**: The search bar instantly queries the global user registry. Searching and messaging a new user automatically permanently adds them to your recent chats list.
- **Real-Time Typing Indicators**: Added real-time indicators scoped accurately to active 1-on-1 conversations.

### ?? Fixed
- Phantom typing indicators appearing across all active clients.
- Status synchronisation issues across active tabs.

## [v1.0.1] - 2026-08-15

### ? Added
- **Live Inline Translation**: Integrated Google Translate API for one-click message translation.
- **Progressive Web App (PWA)**: Added service worker, manifest, and offline caching allowing the app to be installed to mobile home screens.
- **Audio Waveform Visualizer**: Added dynamic real-time visualization to the voice message recorder.

## [v1.0.0] - 2026-08-10

### ?? Initial Release
- **Core Architecture**: Node.js, Express, WebSockets, JWT Authentication, and SQLite/PostgreSQL.
- **Real-Time Messaging**: Built a persistent WebSocket server for instant 1-on-1 direct messages and a global channel.
- **Voice Messages**: Native MediaRecorder implementation with Cloudinary offloaded storage and Opus compression.
- **Glassmorphism UI**: Beautiful, frosted responsive layout for mobile and desktop.
- **Message Interactions**: Implemented context menus for Edit, Delete, Pin, and Reply.
- **Privacy Features**: Added toggleable Gaussian privacy blur and customizable self-destruct timers.
- **Security**: Full signup/login flows secured by Bcrypt password hashing.
