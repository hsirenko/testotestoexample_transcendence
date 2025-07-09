# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode (watch + serve)
npm run dev

# Production build and serve
npm run start

# Serve only (port 5500)
npm run serve
```

### Backend Development

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run start
```

### Full Application

```bash
# Start entire application with Docker
docker-compose up --build

# Access application at http://localhost:8090 (nginx) or http://localhost:5500 (frontend direct)
```

## Architecture Overview

This is a **full-stack multiplayer Pong game** built as a Single Page Application (SPA) with real-time multiplayer capabilities, tournament systems, and blockchain integration.

### Key Components

**Frontend (TypeScript + Tailwind CSS)**

- SPA with custom routing (`nav_history.ts`)
- Real-time game rendering on HTML5 Canvas
- WebSocket client for multiplayer synchronization
- Chart.js for statistics visualization

**Backend (Fastify + Node.js)**

- RESTful API with JWT authentication
- WebSocket server for real-time multiplayer
- Server-side game logic to prevent cheating
- SQLite database with better-sqlite3
- Google OAuth2 and 2FA support

**Infrastructure**

- Docker Compose with nginx reverse proxy
- Three-service architecture (frontend, backend, nginx)
- SSL/TLS termination at nginx layer
- Persistent SQLite database via Docker volumes

### Real-Time Features

- **Game State Synchronization**: Server-side game logic broadcasts to all connected clients
- **Live Chat**: Direct messaging and game invitations
- **Tournament System**: Bracket-style tournaments with live updates
- **Notifications**: Real-time notifications for game invites, friend requests, etc.

### Security Implementation

- **Authentication**: JWT tokens with refresh mechanism
- **2FA**: TOTP with QR code generation using Speakeasy
- **Password Security**: PBKDF2 hashing with salt
- **Input Validation**: Server-side validation for all user inputs
- **HTTPS/WSS**: Secure connections enforced

### Database Schema

SQLite database handles:

- User management (profiles, friends, authentication)
- Game history and statistics
- Tournament records
- Chat messages and notifications

### Blockchain Integration

- **Smart Contracts**: Solidity contracts deployed on Avalanche Fuji testnet
- **Purpose**: Immutable tournament score storage
- **Technology**: Hardhat development framework with Ethers.js

## Development Notes

### File Structure

- `src/`: Frontend TypeScript source files
- `backend/`: Fastify backend server
- `smart-contracts/`: Solidity smart contracts
- `nginx/`: Reverse proxy configuration
- `uploads/`: User avatar storage

### Key Files

- `main.ts`: Core game logic and WebSocket handling
- `game.ts`: Server-side Pong game implementation
- `gameManager.ts`: Manages active game instances
- `tournamentManager.ts`: Tournament bracket logic
- `auth.ts`: Frontend authentication flow

### Environment Setup

Backend requires `.env` file with:

- `JWT_SECRET`: Strong secret for JWT signing
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `IP_ADDR`: Server IP address for Docker networking

### WebSocket Events

The application uses extensive WebSocket communication for:

- Game state updates
- Player actions (paddle movement, game commands)
- Tournament progression
- Chat messages and notifications
- Friend status updates

### Testing

No automated test suite is currently configured. Manual testing is performed through the web interface.
