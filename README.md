# ft_transcendence: The Ultimate Pong Experience 🏓

## Table of Contents
1.  [Introduction](#1-introduction)
2.  [Project Objectives](#2-project-objectives)
3.  [Features](#3-features)
    * [Mandatory Features](#31-mandatory-features)
    * [Implemented Modules](#32-implemented-modules)
4.  [Technical Stack](#4-technical-stack)
5.  [Project Structure](#5-project-structure)
6.  [Installation & Setup](#6-installation--setup)
7.  [Usage](#7-usage)
8.  [Security Considerations](#8-security-considerations)
9.  [Credits & 42 School Philosophy](#9-credits--42-school-philosophy)

---

## 1. Introduction

`ft_transcendence` is the final core project at 42 School, a full-stack web application designed to deliver a modern, real-time multiplayer online Pong game experience. This project goes beyond basic gameplay, incorporating extensive user management, social features, and a robust backend infrastructure. It serves as a comprehensive demonstration of full-stack development skills, real-time communication, database management, and cybersecurity best practices.

---

## 2. Project Objectives

The core objective of `ft_transcendence` is to challenge students with **unfamiliar technologies** and complex tasks, fostering adaptability and problem-solving skills rather than simply demonstrating existing knowledge. This project emphasizes:

* **Adaptation:** Rapidly learning and implementing new programming languages, frameworks, and tools.
* **Problem-Solving:** Tackling intricate challenges in real-time game development, secure authentication, and scalable architecture.
* **Design & Planning:** Encouraging thoughtful design and project management before coding, especially given the project's long-term nature and potential for complex interdependencies.
* **Mandatory Requirements & Modules:** Adhering to a baseline set of features and then selecting a minimum of 7 major modules from a predefined list, each with specific technology constraints.

---

## 3. Features

This project implements all mandatory requirements and several advanced modules to provide a rich user experience.

### 3.1 Mandatory Features

* **Real-time Pong Game:** Live 1v1 Pong gameplay directly on the website.
* **Tournament System (Local):** Ability for multiple users to register aliases and play in a bracket-style tournament on the same device, with matchmaking to organize matches.
* **Single-Page Application (SPA):** A fluid user interface where the user can use browser back/forward buttons without full page reloads.
* **Browser Compatibility:** Fully compatible with the latest stable version of Mozilla Firefox.
* **Error Handling:** No unhandled errors or warnings visible to the user.
* **Docker Containerization:** The entire application runs within Docker containers, launched with a single command.

### 3.2 Implemented Modules

This project successfully integrates the following modules from the `ft_transcendence` subject:

* **Web: Backend Framework (Major)**
    * Backend developed using **Fastify with Node.js**.
* **Web: Frontend Framework/Toolkit (Minor)**
    * Frontend styled with **Tailwind CSS**.
* **Web: Use a Database for the Backend (Minor)**
    * All database instances utilize **SQLite**.
* **User Management: Standard User Management (Major)**
    * Secure user subscription and login, unique display names, profile updates, avatar uploads, friends list with online status, user profiles displaying wins/losses, and match history.
* **User Management: Implement Remote Authentication (Major)**
    * Integration with **Google Sign-in** for secure user authentication.
* **Gameplay and User Experience: Remote Players (Major)**
    * Two players can play remotely from separate computers, with real-time synchronization via WebSockets.
* **Gameplay and User Experience: Live Chat (Major)**
    * Allows users to send direct messages, block other users, invite friends to a Pong game via chat, and receive tournament notifications through the chat interface. Includes a real-time notification system.
* **AI-Algo: Introduce an AI Opponent (Major)**
    * An AI player is incorporated, simulating human behavior by refreshing its "vision" once per second and anticipating ball movements.
* **AI-Algo: User and Game Stats Dashboards (Minor)**
    * Provides user-friendly dashboards displaying individual user and game session statistics with data visualization (charts and graphs).
* **Cybersecurity: Implement Two-Factor Authentication (2FA) and JWT (Major)**
    * Enhanced security through 2FA (with QR code generation) and secure session management using JSON Web Tokens.
* **Server-Side Pong: Replace Basic Pong with Server-Side Pong and Implementing an API (Major)**
    * Game logic handled entirely server-side, exposed via an API for consistent gameplay across clients.

---

## 4. Technical Stack

* **Backend:**
    * **Language:** TypeScript
    * **Framework:** Fastify (Node.js)
    * **Database:** SQLite
    * **Real-time Communication:** WebSockets (for game state, notifications, tournaments)
    * **Authentication:** JWT, Speakeasy (for 2FA), `@fastify/oauth2` for Google Sign-in
    * **Password Hashing:** Node.js `crypto` module (PBKDF2 with SHA512)
* **Frontend:**
    * **Language:** TypeScript
    * **Styling:** Tailwind CSS
    * **Charting:** Chart.js (via CDN)
    * **Animations:** Animate.css (via CDN)
    * **Routing:** Custom SPA history management (`nav_history.ts`)
* **Development & Deployment:**
    * **Containerization:** Docker
    * **Build Tool:** TypeScript Compiler (TSC)
    * **Environment Variables:** `dotenv`

---

## 5. Project Structure

├── backend/
│   ├── middleware/       # Fastify preHandler middleware (e.g., auth)
│   ├── plugins/          # Fastify plugins (e.g., protected routes)
│   ├── routes/           # Fastify API endpoints and WebSocket handlers
│   ├── types/            # TypeScript declaration files for Fastify
│   ├── utils/            # Helper functions (DB, JWT, Hashing)
│   ├── game.ts           # Core Pong game logic (server-side)
│   ├── gameManager.ts    # Manages active game instances
│   ├── server.ts         # Main Fastify server setup
│   ├── seed.ts           # Database seeding script (for development)
│   └── tournamentManager.ts # Manages live tournament state and logic
├── src/
│   ├── api/              # Frontend API client functions
│   ├── types/            # Shared TypeScript types for frontend/WebSockets
│   ├── addfriend.ts      # Logic for adding friends in sidebar
│   ├── ai.ts             # AI opponent logic
│   ├── auth.ts           # Frontend authentication (login, signup, 2FA, Google OAuth)
│   ├── config.ts         # Global configuration (e.g., backend host)
│   ├── friends.ts        # Friends sidebar UI and logic
│   ├── friendstats.ts    # Frontend logic for displaying friend's stats
│   ├── history.ts        # Game history tab UI and logic
│   ├── main.ts           # Core frontend game logic, canvas rendering, WS connections
│   ├── nav.ts            # Navbar, profile overlay, play-flow UI logic
│   ├── nav_history.ts    # SPA browser history management
│   ├── notifications.ts  # Notification system (UI, WS client)
│   ├── profile-info.ts   # Profile info tab and inline editing
│   ├── profile-setting.ts# Profile settings and 2FA setup UI logic
│   ├── stats.ts          # Stats tab UI and Chart.js integration
│   └── tournament.ts     # Tournament UI and WS client logic
├── index.html            # Main SPA entry point
├── package.json          # Frontend dependencies and scripts
├── tsconfig.json         # Frontend TypeScript configuration
├── backend/package.json  # Backend dependencies and scripts
├── backend/tsconfig.json # Backend TypeScript configuration
└── .gitignore            # Git ignore rules for node_modules, .env, etc.


---

## 6. Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Omarak9120/ft_transcendence.git](https://github.com/Omarak9120/ft_transcendence.git)
    cd ft_transcendence
    ```
2.  **Install dependencies (Frontend):**
    ```bash
    npm install
    # Or using Yarn: yarn install
    ```
3.  **Install dependencies (Backend):**
    ```bash
    cd backend
    npm install
    # Or using Yarn: yarn install
    cd ..
    ```
4.  **Configure Environment Variables:**
    Create a `.env` file in the `backend/` directory and populate it with your environment variables.
    ```
    # backend/.env
    JWT_SECRET="your_strong_jwt_secret_key"
    GOOGLE_CLIENT_ID="your_google_client_id"
    GOOGLE_CLIENT_SECRET="your_google_client_secret"
    IP_ADDR="127.0.0.1" # Or your actual IP for external access/Docker
    ```
    *Ensure `IP_ADDR` matches the host your frontend is served from and is accessible by Docker containers.*

5.  **Build TypeScript:**
    ```bash
    npm run build # from the root directory
    ```
    This will compile `src/**/*.ts` to `dist/**/*.js` and `backend/**/*.ts` to `backend/dist/**/*.js`.

6.  **Run with Docker:**
    *Make sure Docker and Docker Compose are installed.*
    (A `Dockerfile` and `docker-compose.yml` would typically be present here. Assuming they are configured to build and run both frontend and backend services.)

    ```bash
    docker-compose up --build
    ```
    *Note: If encountering "Path too long" errors on Windows, consider enabling long path support or using `rimraf` for `node_modules` cleanup.*

---

## 7. Usage

Once the Docker containers are running:

1.  Open your web browser (preferably Mozilla Firefox, as per requirements) and navigate to `http://localhost:5500` (or `http://YOUR_IP_ADDR:5500`).
2.  **Sign Up / Login:** Create a new account or sign in with an existing one. You can also use Google Sign-in.
3.  **Explore Profile:** Check your profile, stats, and game history. Enable 2FA for enhanced security.
4.  **Play Game:**
    * **Vs AI:** Practice against the AI opponent.
    * **1v1 (Offline):** Two players on the same keyboard.
    * **Remote Play:** Create a game and share the ID, or join an existing game ID to play against a friend remotely. You can also directly challenge friends.
    * **Tournament:** Create or join a tournament and follow the bracket.
5.  **Interact:** Use the live chat feature to send direct messages, block users, or invite friends to games.

---

## 8. Security Considerations

This project prioritizes security as a core requirement:

* **Password Hashing:** All passwords are securely hashed using `PBKDF2` before storage.
* **Authentication Tokens:** JWTs are used for secure session management and authorization.
* **Two-Factor Authentication (2FA):** Optional 2FA provides an extra layer of security for user accounts.
* **Input Validation:** All forms and user inputs are validated on both the client-side and server-side to prevent common vulnerabilities like SQL injection and XSS attacks.
* **HTTPS/WSS:** Secure `HTTPS` and `WSS` connections are enforced for all backend communications.
* **Environment Variables:** Sensitive credentials and API keys are stored securely in a `.env` file and excluded from version control via `.gitignore`.

---

## 9. Credits & 42 School Philosophy

This project was developed as part of the 42 School curriculum. It encapsulates the pedagogical approach of learning by doing, confronting students with real-world development challenges and fostering independent problem-solving. The "surprise" element of the project subject encouraged rapid adaptation to new technologies, a critical skill for any software engineer.

**Disclaimer:** This is a 42 School project for educational purposes.

---
