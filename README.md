# PULSE — Animated Realtime WebSocket Chat Application

> **Project Owner & Lead Developer**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)

A complete, production-ready full-stack real-time chat application built with **Node.js**, **Express**, **WebSockets (`ws`)**, **JWT Authentication**, and an interactive **Animated Glassmorphism Frontend**.

---

## 👤 Author Information

- **Owner**: Shreyash Dwivedi
- **GitHub**: [@shreyashdwivedi36](https://github.com/shreyashdwivedi36)
- **Repository**: [https://github.com/shreyashdwivedi36/pulse-chat-app](https://github.com/shreyashdwivedi36/pulse-chat-app)

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