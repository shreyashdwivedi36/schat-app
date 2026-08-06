# SChat — Animated Realtime WebSocket Chat Application

> **Lead Developer & Owner**: [Shreyash Dwivedi](https://github.com/shreyashdwivedi36)  
> **Live Demo**: [SChat](https://schat-live.onrender.com/)

A full-stack, real-time messaging application engineered with **Node.js**, **Express**, **WebSockets (`ws`)**, **JWT Authentication**, **PostgreSQL / SQLite Database**, and an interactive **Animated Glassmorphism Frontend**.

---

## ✨ Key Features

- **Real-Time Messaging**: Built on persistent WebSocket connections (`ws`) for instant two-way message delivery.
- **Live Presence & Typing Indicators**: Dynamic online user count, user presence tracking, and real-time dancing-dot typing indicators.
- **Message Management**: Users can delete their own sent messages with real-time broadcast removal across all connected clients.
- **Message Delivery Status & Read Receipts**: Real-time status checkmarks (`✓` Sent, `✓✓` Delivered, `✓✓` Read).
- **Privacy Blur & Self-Destruct Timer**: Toggleable Gaussian privacy blur (`👁️`) and customizable self-destruct timers (`⏱️ 10s`, `1m`, `5m`, `1h`).
- **Dark & Light Mode**: Customizable UI theme toggle with persistent state saved in browser storage.
- **User Authentication & Security**: Secure signup and login powered by JSON Web Tokens (JWT) and Bcrypt password hashing.
- **Responsive Glassmorphism UI**:
  - Adaptive design optimized for both mobile smartphones and desktop PC screens.
  - Mobile drawer navigation overlay for active users list.
  - Synthesized audio feedback via Web Audio API for message interactions.
  - Interactive avatar picker and emoji popup drawer.
- **Database Persistence**: Flexible database layer supporting cloud PostgreSQL in production and local SQLite for development.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, WebSockets (`ws`), PostgreSQL (`pg`), SQLite3, JWT (`jsonwebtoken`), Bcrypt
- **Frontend**: HTML5, CSS3 (Glassmorphism, Flexbox/Grid, Keyframe Animations), ES6 JavaScript, Web Audio API
- **DevOps**: Docker, Render CI/CD Pipeline, Git

---

## 🚀 Local Development Setup

To run this project locally on your machine:

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
