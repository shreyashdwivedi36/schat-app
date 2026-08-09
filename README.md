# SChat — Animated Realtime WebSocket Chat Application

> **Lead Developer & Owner**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)  
> **Live Demo**: [SChat](https://schat-live.onrender.com/)

A full-stack, real-time messaging application engineered with **Node.js**, **Express**, **WebSockets (`ws`)**, **JWT Authentication**, **PostgreSQL / SQLite Database**, and an interactive **Animated Glassmorphism Frontend**.

---

## ✨ Key Features

- **Real-Time Messaging**: Built on persistent WebSocket connections (`ws`) for instant two-way message delivery.
- **Voice Messages 🎙️**: Native `MediaRecorder` integration allowing users to record voice notes, encoded as Base64 blobs, and sent over WebSockets with a custom UI audio player.
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
- **Frontend**: HTML5, CSS3 (Glassmorphism, Flexbox/Grid, Keyframe Animations), ES6 JavaScript, Web Audio API
- **DevOps**: Docker, Render CI/CD Pipeline, Git

---

## 🚀 Zero-Config Local Development Setup

You can run this entire full-stack application locally in under 10 seconds without needing Docker or a PostgreSQL server. 

If no `DATABASE_URL` is provided in the environment, the app automatically switches to a custom local JSON fallback database (`db_fallback.json`). 

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/shreyashdwivedi36/schat-app.git
   cd schat-app
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm start
   ```

4. **Access Application**:
   Open `http://localhost:3000` in your web browser.

---

## 🐳 Docker Deployment

To build and run the application container using Docker:

```bash
docker build -t schat-app .
docker run -p 3000:3000 schat-app
```

---

## 📄 Author & Copyright

Developed and owned by **Shreyash Dwivedi** ([@shreyashdwivedi36](https://github.com/shreyashdwivedi36)).  
Copyright (c) 2026 Shreyash Dwivedi. All Rights Reserved.
