# Learning Guide: Understanding the Transcendence Project

This document serves as your complete educational resource for understanding how to build a full-stack multiplayer Pong game with comprehensive user management. Use this alongside the other documentation files for a complete learning experience.

## 📚 Documentation Structure

1. **[TUTORIAL.md](./TUTORIAL.md)** - Complete theoretical guide with concepts and architecture
2. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Deep dive into database design and relationships
3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Step-by-step practical coding examples
4. **[LEARNING_GUIDE.md](./LEARNING_GUIDE.md)** - This file: learning path and resources

---

## 🎯 Learning Objectives

By following these guides, you will understand:

### **Database & Schema Design**
- ✅ How to design relational databases with proper foreign key relationships
- ✅ User authentication and authorization patterns
- ✅ Database normalization and data integrity
- ✅ SQLite usage and query optimization
- ✅ Password hashing and security best practices

### **Backend Development**
- ✅ RESTful API design with Fastify
- ✅ JWT token-based authentication
- ✅ Middleware for request processing
- ✅ Error handling and input validation
- ✅ WebSocket implementation for real-time features
- ✅ File uploads and static file serving

### **Frontend Development**
- ✅ TypeScript for type-safe JavaScript development
- ✅ Single Page Application (SPA) architecture
- ✅ Client-side authentication flow
- ✅ API integration and error handling
- ✅ Real-time UI updates with WebSockets
- ✅ Form validation and user experience

### **Security Implementation**
- ✅ Password hashing with PBKDF2
- ✅ Two-Factor Authentication (2FA) with TOTP
- ✅ JWT security best practices
- ✅ Input sanitization and validation
- ✅ CORS configuration
- ✅ Authentication middleware patterns

### **Real-time Features**
- ✅ WebSocket server and client implementation
- ✅ Game state synchronization
- ✅ Live notifications system
- ✅ Multi-user tournament brackets
- ✅ Friend status and online presence

---

## 📖 Recommended Learning Path

### Phase 1: Foundation (Week 1-2)
**Focus: Core Concepts**

1. **Start with Database Schema**
   - Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) sections 1-3
   - Understand table relationships and foreign keys
   - Practice writing SQL queries

2. **Learn Authentication Basics**
   - Study password hashing concepts
   - Understand JWT tokens and how they work
   - Learn about middleware patterns

**Practical Exercise:**
```bash
# Follow IMPLEMENTATION_GUIDE.md Steps 1-5
cd backend && npx ts-node test-db.ts  # Test database setup
npx ts-node src/utils/hash.ts         # Test password hashing
npx ts-node src/utils/jwt.ts          # Test JWT functions
```

### Phase 2: Basic User Management (Week 3-4)
**Focus: User CRUD Operations**

3. **Build Authentication System**
   - Follow [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) Steps 6-8
   - Create signup/login endpoints
   - Implement authentication middleware

4. **Create User Interface**
   - Follow Steps 9-11 to build the frontend
   - Test the complete auth flow
   - Understand client-server communication

**Practical Exercise:**
```bash
# Run the complete system
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
# Test signup, login, profile updates
```

### Phase 3: Advanced Features (Week 5-6)
**Focus: Real-time and Security**

5. **Add Friends System**
   - Study [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) section 3.2
   - Implement friend requests and status tracking
   - Build notification system

6. **Implement 2FA Security**
   - Study [TUTORIAL.md](./TUTORIAL.md) section 5.1
   - Add TOTP-based two-factor authentication
   - Test QR code generation and verification

**Practical Exercise:**
```typescript
// Add these tables to your database
db.exec(`
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
`);
```

### Phase 4: Real-time Features (Week 7-8)
**Focus: WebSockets and Game Logic**

7. **WebSocket Communication**
   - Read [TUTORIAL.md](./TUTORIAL.md) sections 7.2 and 8.7
   - Implement basic WebSocket server
   - Create real-time notifications

8. **Tournament System**
   - Study the tournament database design
   - Implement bracket creation logic
   - Add match tracking and results

### Phase 5: Production Features (Week 9-10)
**Focus: Deployment and Optimization**

9. **File Uploads and Static Assets**
   - Implement avatar upload system
   - Configure static file serving
   - Add image validation and processing

10. **Deployment with Docker**
    - Study [TUTORIAL.md](./TUTORIAL.md) section 10
    - Set up Docker containers
    - Configure nginx reverse proxy

---

## 🛠️ Development Environment Setup

### Required Tools
```bash
# Node.js (v18 or later)
node --version  # Should be 18+

# Package managers
npm --version
# or
yarn --version

# Database tool (optional)
# Install SQLite browser for visual database inspection
# https://sqlitebrowser.org/
```

### IDE Setup
**Recommended: Visual Studio Code**

```json
// .vscode/settings.json
{
  "typescript.preferences.quoteStyle": "single",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

**Essential Extensions:**
- TypeScript and JavaScript Language Features
- SQLite (by alexcvzz)
- REST Client (for testing APIs)
- Prettier (code formatting)
- ESLint (code quality)

### Environment Variables
```bash
# backend/.env
JWT_SECRET=your-super-secret-256-bit-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
IP_ADDR=localhost
```

---

## 🧪 Testing and Validation

### Database Testing
```sql
-- Test user creation and relationships
INSERT INTO users (username, email, password_hash) VALUES 
  ('alice', 'alice@example.com', 'hashed_password_1'),
  ('bob', 'bob@example.com', 'hashed_password_2');

-- Test friend relationship
INSERT INTO friends (sender_id, receiver_id, status) VALUES (1, 2, 'accepted');

-- Verify relationships work
SELECT 
  u1.username AS sender,
  u2.username AS receiver, 
  f.status
FROM friends f
JOIN users u1 ON f.sender_id = u1.id
JOIN users u2 ON f.receiver_id = u2.id;
```

### API Testing with curl
```bash
# Test signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"SecurePass123!"}'

# Test login  
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

### Frontend Testing
```javascript
// Browser console testing
const auth = window.authManager;

// Test login
await auth.login('test@example.com', 'SecurePass123!');

// Test profile update
await auth.updateProfile({username: 'newusername'});

// Check authentication status
auth.isAuthenticated();
```

---

## 🔍 Common Concepts Explained

### 1. **Database Foreign Keys**
```sql
-- This creates a relationship where each friend record
-- MUST reference valid user IDs
FOREIGN KEY (sender_id) REFERENCES users(id)
```
**Why:** Maintains data integrity - prevents orphaned records

### 2. **Password Hashing**
```typescript
// NEVER store plain text passwords!
const plainPassword = "user123";           // ❌ Bad
const hashedPassword = hashPassword(plain); // ✅ Good: "salt:hash"
```
**Why:** Even if database is compromised, passwords remain secure

### 3. **JWT Tokens**
```javascript
// JWT contains user info + signature
const token = "header.payload.signature";
// Payload: {"userId": 123, "exp": 1234567890}
```
**Why:** Stateless authentication - no server-side sessions needed

### 4. **Middleware Pattern**
```typescript
// Runs BEFORE the main route handler
fastify.get('/api/profile', 
  { preHandler: authMiddleware }, // ← This runs first
  async (req, reply) => {         // ← This runs after middleware
    // req.user is now available from middleware
  }
);
```
**Why:** Reusable authentication logic across multiple routes

### 5. **WebSocket vs HTTP**
```typescript
// HTTP: Request → Response (one-time)
fetch('/api/user/profile')  // Client asks, server responds once

// WebSocket: Persistent connection
ws.send({type: 'paddle_move'})  // Real-time bidirectional communication
```
**Why:** Games need instant updates, not request-response delays

---

## 📝 Learning Exercises

### Exercise 1: Database Design (Beginner)
Design a table for storing game settings:
```sql
-- Your task: Create a user_settings table
-- Should store: user_id, setting_name, setting_value
-- Example: user 1 wants paddle_color = "red"
```

### Exercise 2: Authentication Flow (Intermediate)
Implement password reset functionality:
```typescript
// Create these endpoints:
// POST /api/password/reset-request  // Send reset code
// POST /api/password/reset-verify   // Verify code and update password
```

### Exercise 3: Real-time Features (Advanced)
Add online status tracking:
```typescript
// Track when users connect/disconnect via WebSocket
// Update friends list to show "online" indicators
// Store last_seen timestamp in database
```

### Exercise 4: Security Hardening (Expert)
Implement rate limiting:
```typescript
// Prevent abuse by limiting:
// - 5 login attempts per minute per IP
// - 10 API calls per minute per user
// - 1 password reset per hour per email
```

---

## 🚀 Next Steps and Extensions

After mastering the core concepts, consider adding:

### **Game Features**
- AI opponents for single-player mode
- Multiple game modes (different ball speeds, paddle sizes)
- Replay system to watch previous matches
- Tournament brackets with elimination rounds

### **Social Features**
- Private messaging between friends
- Game invitations and challenges
- User profiles with statistics and achievements
- Social media integration for sharing scores

### **Advanced Security**
- OAuth with multiple providers (GitHub, Discord)
- Account verification via email
- Session management and token blacklisting
- Advanced 2FA with backup codes

### **Performance & Scaling**
- Database connection pooling
- Redis for session storage
- Load balancing with multiple server instances
- CDN integration for static assets

### **Mobile & PWA**
- Progressive Web App (PWA) features
- Mobile-responsive design
- Push notifications
- Offline game mode

---

## 🎓 Additional Learning Resources

### **Books**
- "Node.js Design Patterns" by Mario Casciaro
- "Learning SQL" by Alan Beaulieu
- "Clean Code" by Robert C. Martin
- "Building Secure Web Applications" by OWASP

### **Online Courses**
- **Database Design:** Khan Academy SQL Course
- **Node.js:** The Complete Node.js Developer Course (Udemy)
- **TypeScript:** TypeScript Handbook (Official Documentation)
- **WebSockets:** Socket.io Documentation and Tutorials

### **Practice Projects**
1. **Chat Application** - Practice WebSocket communication
2. **Todo App with Authentication** - Master CRUD operations
3. **Social Media API** - Advanced database relationships
4. **E-commerce Backend** - Complex business logic

### **Security Learning**
- OWASP Top 10 Web Application Security Risks
- JWT.io for understanding JSON Web Tokens
- Have I Been Pwned API integration
- Cryptography best practices documentation

---

## 🤝 Community and Support

### **Getting Help**
1. **Stack Overflow** - Tag questions with: typescript, node.js, sqlite, fastify
2. **Discord/Reddit** - Join developer communities
3. **GitHub Issues** - Study open source projects' issue discussions
4. **Documentation** - Always check official docs first

### **Contributing to Learning**
- Share your implementations on GitHub
- Write blog posts about challenges you solved
- Help others in developer communities
- Create your own tutorial variations

---

## ✅ Knowledge Checkpoints

Use these to verify your understanding:

### **Database Concepts**
- [ ] Can explain the difference between PRIMARY KEY and FOREIGN KEY
- [ ] Understand why we normalize data into separate tables
- [ ] Know when to use indexes for query optimization
- [ ] Can write complex JOIN queries across multiple tables

### **Security Concepts** 
- [ ] Never store plain text passwords
- [ ] Understand salt + hash vs simple hashing
- [ ] Know JWT structure and how to validate tokens
- [ ] Can implement proper input validation and sanitization

### **API Design**
- [ ] Understand REST principles and HTTP methods
- [ ] Know how to structure API responses consistently
- [ ] Can implement proper error handling
- [ ] Understand middleware execution flow

### **Frontend Integration**
- [ ] Can handle async API calls with proper error handling
- [ ] Understand client-side state management
- [ ] Know how to secure API calls with authentication headers
- [ ] Can implement responsive user interfaces

### **Real-time Communication**
- [ ] Understand WebSocket vs HTTP differences
- [ ] Can implement bidirectional communication
- [ ] Know how to handle connection failures gracefully
- [ ] Understand event-driven architecture

---

This learning guide provides you with a structured path through the complexities of full-stack web development, focusing specifically on user management systems. Take your time with each phase, practice the exercises, and don't hesitate to experiment with the code examples.

Remember: **Understanding concepts is more important than memorizing syntax.** Focus on the "why" behind each implementation choice, and you'll become a better developer overall.