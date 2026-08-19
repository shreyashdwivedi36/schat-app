# SChat — Animated Realtime WebSocket Chat Application

> **Lead Developer & Owner**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)  
> **Live Demo**: [SChat](https://schat-live.onrender.com/)

A full-stack, real-time messaging application engineered with **Node.js**, **Express**, **WebSockets (`ws`)**, **JWT Authentication**, **PostgreSQL / SQLite Database**, and an interactive **Animated Glassmorphism Frontend**.

📢 **[View the Latest Updates & Changelog ➔](./CHANGELOG.md)**

---

## ✨ Key Features

- **Real-Time Messaging**: Built on persistent WebSocket connections (`ws`) for instant two-way message delivery.
- **Optimized Media Handling**: 
  - **Deduplication**: Client-side file hashing (SHA-256) prevents duplicate uploads, saving storage space and bandwidth.
  - **Progressive Image Loading**: Uses Cloudinary URL transformations to deliver instant 20px blurred placeholders that smoothly transition to high-res images.
  - **Automated Storage Management**: A background Node.js loop automatically purges media older than 30 days to efficiently manage free-tier limits.
  - **Client-Side Compression**: Reduces large images to lightweight WebP files via HTML5 Canvas before they hit the network.
- **Optimistic Media Rendering**: Implemented a seamless optimistic UI system that instantly displays local image and document previews with a sweeping glow animation while Cloudinary uploads process in the background.
- **Dynamic Welcome Greeting**: The home screen now features a personalized, time-sensitive greeting (Good morning/afternoon/evening, [User]) based on the user's local timezone.
- **Quick Close Chat Navigation**: Added a convenient '✖' button to the active chat header for one-click navigation back to the welcome screen.
- **Lightbox Image Viewer**: Added a native, responsive full-screen lightbox for viewing high-resolution image attachments.
- **Voice Messages 🎙️**: Native `MediaRecorder` integration with **Cloudinary** for offloaded storage. Features a real-time **Audio Waveform Visualizer**, 16kbps Opus compression, and a custom UI audio player.
- **Live Inline Translation 🌐**: One-click Google Translate API integration to instantly translate incoming messages to the user's preferred language.
- **Private & Global Chat**: Support for 1-on-1 Direct Messages and a Global Channel.
- **Progressive Web App (PWA)**: Fully installable to mobile home screens with offline caching and an auto-updating Network-First Service Worker (`sw.js`).
- **Rich Message Interactions**: 
  - **Context Menus**: Right-click/long-press messages to Reply, Pin, Edit, Translate, or Copy text.
  - **Quick Emoji Reactions**: Add floating quick reactions (👍, ❤️, 😂, 🔥, etc.) to messages.
- **Message Management**: Users can edit or delete their own messages with real-time broadcast updates.
- **Delivery Status & Read Receipts**: Real-time status checkmarks (`✓` Sent, `✓✓` Delivered, `✓✓` Read).
- **Privacy Blur & Self-Destruct**: Toggleable Gaussian privacy blur (`👁️`) and customizable self-destruct timers (`⏱️ 10s`, `1m`, `5m`, `1h`).
- **User Authentication & Security**: Secure signup and login powered by JSON Web Tokens (JWT) and Bcrypt password hashing.
- **Responsive Glassmorphism UI**: Adaptive, beautifully frosted layout for mobile and desktop with synthesized audio feedback.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, WebSockets (`ws`), PostgreSQL (`pg`), SQLite3, JWT (`jsonwebtoken`), Bcrypt
- **Frontend**: HTML5, CSS3 (Glassmorphism, Flexbox/Grid, Keyframe Animations), ES6 JavaScript, Web Audio API, Cloudinary REST API
- **DevOps**: Docker, Render CI/CD Pipeline, Git

---

## 🏢 Architecture Evaluation Setup

This repository contains proprietary source code. The instructions below are provided strictly for **authorized technical evaluation and architectural review**. 

**Unauthorized commercial use, modification, cloning, or distribution is strictly prohibited.**

### Local Evaluation Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/shreyashdwivedi36/schat-app.git
   cd schat-app
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Evaluation Server**:
   ```bash
   npm start
   ```
*(Note: If no `DATABASE_URL` is provided, the backend will automatically mock a database using a local JSON fallback `db_fallback.json`.)*

---

## 📄 Author & Copyright

Developed and owned by **Shreyash Dwivedi** ([@shreyashdwivedi36](https://github.com/shreyashdwivedi36)).  
Copyright (c) 2026 Shreyash Dwivedi. All Rights Reserved.
