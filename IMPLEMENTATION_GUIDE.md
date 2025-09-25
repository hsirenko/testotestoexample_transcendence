# Step-by-Step Implementation Guide

This guide provides working code examples for each step of building the user management system. Follow these steps in order to understand how each component works.

## Prerequisites Setup

```bash
# Create new project
mkdir transcendence-tutorial
cd transcendence-tutorial

# Create directory structure
mkdir -p frontend/src backend/src/{routes,utils,middleware} uploads/avatars

# Initialize frontend
cd frontend
npm init -y
npm install typescript @types/node tailwindcss concurrently http-server

# Initialize backend  
cd ../backend
npm init -y
npm install fastify @fastify/cors @fastify/multipart @fastify/websocket @fastify/static
npm install better-sqlite3 jsonwebtoken bcrypt speakeasy qrcode
npm install --save-dev @types/node @types/jsonwebtoken @types/bcrypt typescript ts-node

# Create TypeScript configs
cd ../frontend && npx tsc --init
cd ../backend && npx tsc --init
```

## Step 1: Basic Database Setup

**File: `backend/src/utils/db.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../pong.db');
const db = new Database(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON');

// Create users table
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

console.log('Database initialized');
export default db;
```

**Test the database:**

```typescript
// backend/test-db.ts
import db from './src/utils/db';

// Insert test user
const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
const result = stmt.run('testuser', 'test@example.com', 'hashed_password_here');

console.log('Inserted user with ID:', result.lastInsertRowid);

// Query users
const users = db.prepare('SELECT * FROM users').all();
console.log('All users:', users);
```

## Step 2: Password Security

**File: `backend/src/utils/hash.ts`**

```typescript
import crypto from 'crypto';

const ROUNDS = 100_000;
const DKLEN = 64;
const DIGEST = 'sha512';

export function hashPassword(plain: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(plain, salt, ROUNDS, DKLEN, DIGEST).toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
    const [salt, originalHash] = stored.split(':');
    if (!salt || !originalHash) return false;

    const hash = crypto.pbkdf2Sync(plain, salt, ROUNDS, DKLEN, DIGEST);
    return crypto.timingSafeEqual(hash, Buffer.from(originalHash, 'hex'));
}

// Test the functions
if (require.main === module) {
    const password = 'MySecurePassword123!';
    const hashed = hashPassword(password);
    console.log('Hashed:', hashed);
    
    const isValid = verifyPassword(password, hashed);
    console.log('Valid:', isValid);
    
    const isInvalid = verifyPassword('WrongPassword', hashed);
    console.log('Invalid:', isInvalid);
}
```

**Run the test:**
```bash
cd backend && npx ts-node src/utils/hash.ts
```

## Step 3: JWT Token Management

**File: `backend/src/utils/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

export function generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: '7d',
        issuer: 'transcendence'
    });
}

export function verifyToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET, { 
        issuer: 'transcendence' 
    }) as JWTPayload;
}

// Test JWT functions
if (require.main === module) {
    const payload: JWTPayload = {
        userId: 1,
        username: 'testuser', 
        email: 'test@example.com'
    };
    
    const token = generateToken(payload);
    console.log('Generated token:', token);
    
    try {
        const decoded = verifyToken(token);
        console.log('Decoded payload:', decoded);
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}
```

## Step 4: User Registration Route

**File: `backend/src/routes/auth.ts`**

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../utils/db';
import { hashPassword, verifyPassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';

interface SignupBody {
    username: string;
    email: string;
    password: string;
}

interface LoginBody {
    email: string;
    password: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
    
    // User registration
    fastify.post('/api/signup', async (req: FastifyRequest<{Body: SignupBody}>, reply: FastifyReply) => {
        const { username, email, password } = req.body;

        // Basic validation
        if (!username || !email || !password) {
            return reply.status(400).send({ error: 'All fields are required' });
        }

        if (username.length < 2) {
            return reply.status(400).send({ error: 'Username must be at least 2 characters' });
        }

        if (password.length < 8) {
            return reply.status(400).send({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
                              .get(username, email);

        if (existingUser) {
            return reply.status(400).send({ error: 'Username or email already exists' });
        }

        // Create user
        try {
            const passwordHash = hashPassword(password);
            const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
            const result = stmt.run(username, email, passwordHash);

            return reply.status(201).send({ 
                message: 'User created successfully',
                userId: result.lastInsertRowid
            });
        } catch (error) {
            console.error('Signup error:', error);
            return reply.status(500).send({ error: 'Failed to create user' });
        }
    });

    // User login
    fastify.post('/api/login', async (req: FastifyRequest<{Body: LoginBody}>, reply: FastifyReply) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email and password are required' });
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return reply.status(401).send({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = verifyPassword(password, user.password_hash);

        if (!isValidPassword) {
            return reply.status(401).send({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = generateToken({
            userId: user.id,
            username: user.username,
            email: user.email
        });

        return reply.send({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });
    });
}
```

## Step 5: Authentication Middleware

**File: `backend/src/middleware/auth.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, JWTPayload } from '../utils/jwt';

// Extend FastifyRequest to include user
declare module 'fastify' {
    interface FastifyRequest {
        user?: JWTPayload;
    }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    try {
        const authHeader = request.headers.authorization;
        
        if (!authHeader) {
            return reply.status(401).send({ error: 'Authorization header required' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return reply.status(401).send({ error: 'Token required' });
        }

        // Verify and decode token
        const decoded = verifyToken(token);
        request.user = decoded;

        // Optionally check if user still exists in database
        // const user = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);
        // if (!user) {
        //     return reply.status(401).send({ error: 'User no longer exists' });
        // }

    } catch (error) {
        console.error('Auth middleware error:', error);
        return reply.status(401).send({ error: 'Invalid or expired token' });
    }
}

// Helper function for routes that need user ID
export function requireAuth() {
    return { preHandler: authMiddleware };
}
```

## Step 6: Protected User Routes

**File: `backend/src/routes/user.ts`**

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';

interface UpdateProfileBody {
    username?: string;
    email?: string;
}

export default async function userRoutes(fastify: FastifyInstance) {
    
    // Get current user profile
    fastify.get('/api/user/profile', 
        { preHandler: authMiddleware },
        async (req: FastifyRequest, reply: FastifyReply) => {
            const userId = req.user!.userId;

            const user = db.prepare(`
                SELECT id, username, email, created_at 
                FROM users 
                WHERE id = ?
            `).get(userId);

            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }

            return reply.send(user);
        }
    );

    // Update user profile
    fastify.put('/api/user/profile',
        { preHandler: authMiddleware },
        async (req: FastifyRequest<{Body: UpdateProfileBody}>, reply: FastifyReply) => {
            const userId = req.user!.userId;
            const { username, email } = req.body;

            if (!username && !email) {
                return reply.status(400).send({ error: 'At least one field must be provided' });
            }

            try {
                const updates: string[] = [];
                const values: any[] = [];

                if (username) {
                    if (username.length < 2) {
                        return reply.status(400).send({ error: 'Username must be at least 2 characters' });
                    }
                    updates.push('username = ?');
                    values.push(username);
                }

                if (email) {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        return reply.status(400).send({ error: 'Invalid email format' });
                    }
                    updates.push('email = ?');
                    values.push(email);
                }

                values.push(userId);

                const stmt = db.prepare(`
                    UPDATE users 
                    SET ${updates.join(', ')} 
                    WHERE id = ?
                `);

                stmt.run(...values);

                return reply.send({ message: 'Profile updated successfully' });

            } catch (error: any) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return reply.status(400).send({ error: 'Username or email already taken' });
                }
                console.error('Profile update error:', error);
                return reply.status(500).send({ error: 'Failed to update profile' });
            }
        }
    );

    // Get all users (for testing)
    fastify.get('/api/users', async (req: FastifyRequest, reply: FastifyReply) => {
        const users = db.prepare(`
            SELECT id, username, email, created_at 
            FROM users 
            ORDER BY created_at DESC
        `).all();

        return reply.send(users);
    });
}
```

## Step 7: Basic Server Setup

**File: `backend/src/server.ts`**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';

const fastify = Fastify({
    logger: {
        level: 'info'
    }
});

const start = async () => {
    try {
        // Register CORS
        await fastify.register(cors, {
            origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
            credentials: true
        });

        // Register routes
        await fastify.register(authRoutes);
        await fastify.register(userRoutes);

        // Health check
        fastify.get('/api/health', async () => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        // Start server
        const port = 3000;
        await fastify.listen({ port, host: '0.0.0.0' });
        
        console.log(`✅ Server running on http://localhost:${port}`);
        console.log(`🔍 Try: http://localhost:${port}/api/health`);

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
```

**Start the server:**
```bash
cd backend && npx ts-node src/server.ts
```

## Step 8: Frontend Authentication

**File: `frontend/src/auth.ts`**

```typescript
interface User {
    id: number;
    username: string;
    email: string;
    created_at: string;
}

interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

class AuthManager {
    private token: string | null = null;
    private user: User | null = null;
    private apiBase = 'http://localhost:3000';

    constructor() {
        // Load from localStorage on init
        this.token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('auth_user');
        this.user = userData ? JSON.parse(userData) : null;
    }

    async signup(username: string, email: string, password: string): Promise<{success: boolean, error?: string}> {
        try {
            const response = await fetch(`${this.apiBase}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    async login(email: string, password: string): Promise<{success: boolean, error?: string}> {
        try {
            const response = await fetch(`${this.apiBase}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data: AuthResponse = await response.json();

            if (!response.ok) {
                return { success: false, error: data.message || 'Login failed' };
            }

            // Store auth data
            this.token = data.token;
            this.user = data.user;
            
            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('auth_user', JSON.stringify(this.user));

            return { success: true };
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    async getProfile(): Promise<{success: boolean, user?: User, error?: string}> {
        if (!this.token) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch(`${this.apiBase}/api/user/profile`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return { success: false, error: 'Session expired' };
                }
                throw new Error('Failed to fetch profile');
            }

            const user = await response.json();
            this.user = user;
            localStorage.setItem('auth_user', JSON.stringify(user));

            return { success: true, user };
        } catch (error) {
            return { success: false, error: 'Failed to fetch profile' };
        }
    }

    async updateProfile(data: {username?: string, email?: string}): Promise<{success: boolean, error?: string}> {
        if (!this.token) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch(`${this.apiBase}/api/user/profile`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}` 
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error };
            }

            // Refresh profile
            await this.getProfile();

            return { success: true };
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    logout(): void {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }

    isAuthenticated(): boolean {
        return !!this.token;
    }

    getCurrentUser(): User | null {
        return this.user;
    }

    getAuthHeader(): Record<string, string> {
        return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    }
}

// Export singleton instance
export const authManager = new AuthManager();

// Make it available globally for testing
(window as any).authManager = authManager;
```

## Step 9: HTML Interface

**File: `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcendence - User Management Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .hidden { display: none !important; }
        .error { color: #ef4444; }
        .success { color: #10b981; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-center mb-8">Transcendence Demo</h1>

        <!-- Login/Signup Form -->
        <div id="auth-section" class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <div class="flex mb-4">
                <button id="login-tab" class="flex-1 py-2 px-4 bg-blue-500 text-white rounded-l">Login</button>
                <button id="signup-tab" class="flex-1 py-2 px-4 bg-gray-300 rounded-r">Sign Up</button>
            </div>

            <form id="auth-form">
                <div id="signup-fields" class="hidden">
                    <input id="signup-username" type="text" placeholder="Username" 
                           class="w-full p-3 mb-3 border rounded" required>
                </div>
                
                <input id="email" type="email" placeholder="Email" 
                       class="w-full p-3 mb-3 border rounded" required>
                
                <input id="password" type="password" placeholder="Password" 
                       class="w-full p-3 mb-4 border rounded" required>

                <button type="submit" id="auth-submit" 
                        class="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600">
                    Login
                </button>
            </form>

            <div id="auth-message" class="mt-4 text-center"></div>
        </div>

        <!-- User Dashboard -->
        <div id="dashboard-section" class="hidden max-w-2xl mx-auto">
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">Welcome, <span id="user-username"></span>!</h2>
                    <button id="logout-btn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Logout
                    </button>
                </div>
                
                <div class="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>Email: <span id="user-email" class="font-medium"></span></div>
                    <div>ID: <span id="user-id" class="font-medium"></span></div>
                    <div>Member since: <span id="user-created" class="font-medium"></span></div>
                </div>
            </div>

            <!-- Profile Edit Form -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-xl font-bold mb-4">Edit Profile</h3>
                <form id="profile-form">
                    <input id="profile-username" type="text" placeholder="New username" 
                           class="w-full p-3 mb-3 border rounded">
                    <input id="profile-email" type="email" placeholder="New email" 
                           class="w-full p-3 mb-4 border rounded">
                    <button type="submit" class="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
                        Update Profile
                    </button>
                </form>
                <div id="profile-message" class="mt-4"></div>
            </div>
        </div>
    </div>

    <script src="js/auth.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

## Step 10: Frontend Application Logic

**File: `frontend/src/app.ts`**

```typescript
import { authManager } from './auth';

class App {
    private isSignupMode = false;

    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthentication();
    }

    private initializeElements() {
        // Get DOM elements
        this.elements = {
            authSection: document.getElementById('auth-section')!,
            dashboardSection: document.getElementById('dashboard-section')!,
            loginTab: document.getElementById('login-tab')!,
            signupTab: document.getElementById('signup-tab')!,
            authForm: document.getElementById('auth-form') as HTMLFormElement,
            authSubmit: document.getElementById('auth-submit')!,
            signupFields: document.getElementById('signup-fields')!,
            authMessage: document.getElementById('auth-message')!,
            
            // Dashboard elements
            userUsername: document.getElementById('user-username')!,
            userEmail: document.getElementById('user-email')!,
            userId: document.getElementById('user-id')!,
            userCreated: document.getElementById('user-created')!,
            logoutBtn: document.getElementById('logout-btn')!,
            
            // Profile form
            profileForm: document.getElementById('profile-form') as HTMLFormElement,
            profileMessage: document.getElementById('profile-message')!,
            
            // Input fields
            email: document.getElementById('email') as HTMLInputElement,
            password: document.getElementById('password') as HTMLInputElement,
            signupUsername: document.getElementById('signup-username') as HTMLInputElement,
            profileUsername: document.getElementById('profile-username') as HTMLInputElement,
            profileEmail: document.getElementById('profile-email') as HTMLInputElement
        };
    }

    private attachEventListeners() {
        // Tab switching
        this.elements.loginTab.addEventListener('click', () => this.switchToLogin());
        this.elements.signupTab.addEventListener('click', () => this.switchToSignup());

        // Auth form submission
        this.elements.authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));

        // Profile form submission
        this.elements.profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));

        // Logout
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    private switchToLogin() {
        this.isSignupMode = false;
        this.elements.loginTab.classList.add('bg-blue-500', 'text-white');
        this.elements.loginTab.classList.remove('bg-gray-300');
        this.elements.signupTab.classList.add('bg-gray-300');
        this.elements.signupTab.classList.remove('bg-blue-500', 'text-white');
        this.elements.signupFields.classList.add('hidden');
        this.elements.authSubmit.textContent = 'Login';
        this.clearMessage();
    }

    private switchToSignup() {
        this.isSignupMode = true;
        this.elements.signupTab.classList.add('bg-blue-500', 'text-white');
        this.elements.signupTab.classList.remove('bg-gray-300');
        this.elements.loginTab.classList.add('bg-gray-300');
        this.elements.loginTab.classList.remove('bg-blue-500', 'text-white');
        this.elements.signupFields.classList.remove('hidden');
        this.elements.authSubmit.textContent = 'Sign Up';
        this.clearMessage();
    }

    private async handleAuthSubmit(e: Event) {
        e.preventDefault();
        
        const email = this.elements.email.value.trim();
        const password = this.elements.password.value;
        
        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            this.elements.authSubmit.textContent = 'Loading...';
            this.elements.authSubmit.setAttribute('disabled', 'true');

            if (this.isSignupMode) {
                const username = this.elements.signupUsername.value.trim();
                if (!username) {
                    this.showMessage('Username is required', 'error');
                    return;
                }

                const result = await authManager.signup(username, email, password);
                if (result.success) {
                    this.showMessage('Account created! Please login.', 'success');
                    this.switchToLogin();
                    this.elements.authForm.reset();
                } else {
                    this.showMessage(result.error || 'Signup failed', 'error');
                }
            } else {
                const result = await authManager.login(email, password);
                if (result.success) {
                    this.showDashboard();
                } else {
                    this.showMessage(result.error || 'Login failed', 'error');
                }
            }
        } finally {
            this.elements.authSubmit.textContent = this.isSignupMode ? 'Sign Up' : 'Login';
            this.elements.authSubmit.removeAttribute('disabled');
        }
    }

    private async handleProfileSubmit(e: Event) {
        e.preventDefault();
        
        const username = this.elements.profileUsername.value.trim();
        const email = this.elements.profileEmail.value.trim();
        
        if (!username && !email) {
            this.showProfileMessage('Please provide at least one field to update', 'error');
            return;
        }

        const updateData: any = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;

        const result = await authManager.updateProfile(updateData);
        if (result.success) {
            this.showProfileMessage('Profile updated successfully!', 'success');
            this.elements.profileForm.reset();
            this.updateUserDisplay();
        } else {
            this.showProfileMessage(result.error || 'Update failed', 'error');
        }
    }

    private handleLogout() {
        authManager.logout();
        this.showAuthForm();
        this.elements.authForm.reset();
    }

    private async checkAuthentication() {
        if (authManager.isAuthenticated()) {
            // Verify token is still valid
            const result = await authManager.getProfile();
            if (result.success) {
                this.showDashboard();
            } else {
                this.showAuthForm();
            }
        } else {
            this.showAuthForm();
        }
    }

    private showAuthForm() {
        this.elements.authSection.classList.remove('hidden');
        this.elements.dashboardSection.classList.add('hidden');
        this.clearMessage();
    }

    private showDashboard() {
        this.elements.authSection.classList.add('hidden');
        this.elements.dashboardSection.classList.remove('hidden');
        this.updateUserDisplay();
    }

    private updateUserDisplay() {
        const user = authManager.getCurrentUser();
        if (user) {
            this.elements.userUsername.textContent = user.username;
            this.elements.userEmail.textContent = user.email;
            this.elements.userId.textContent = user.id.toString();
            this.elements.userCreated.textContent = new Date(user.created_at).toLocaleDateString();
        }
    }

    private showMessage(message: string, type: 'success' | 'error') {
        this.elements.authMessage.textContent = message;
        this.elements.authMessage.className = `mt-4 text-center ${type}`;
    }

    private showProfileMessage(message: string, type: 'success' | 'error') {
        this.elements.profileMessage.textContent = message;
        this.elements.profileMessage.className = `mt-4 ${type}`;
    }

    private clearMessage() {
        this.elements.authMessage.textContent = '';
        this.elements.profileMessage.textContent = '';
    }

    private elements: any;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
```

## Step 11: Build Configuration

**File: `frontend/package.json`** (update scripts):
```json
{
  "scripts": {
    "build": "tsc",
    "serve": "http-server . -p 5500 -c-1 --cors",
    "dev": "concurrently \"tsc --watch\" \"http-server . -p 5500 -c-1 --cors\"",
    "start": "npm run build && npm run serve"
  }
}
```

**File: `backend/package.json`** (update scripts):
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "test": "ts-node test-db.ts"
  }
}
```

## Step 12: Test the Complete System

1. **Start the backend:**
```bash
cd backend
npm run dev
```

2. **Start the frontend (new terminal):**
```bash
cd frontend
npm run dev
```

3. **Test the application:**
   - Open http://localhost:5500
   - Try creating a new account
   - Login with the account
   - Update your profile
   - Check browser dev tools for network requests
   - Verify data in the database

## Testing API with curl

```bash
# Test signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"TestPassword123!"}'

# Test login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# Test protected route (use token from login response)
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Test profile update
curl -X PUT http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"username":"newusername"}'
```

## Common Issues and Solutions

1. **CORS Error**: Make sure backend CORS is configured for your frontend URL
2. **Database Lock**: Ensure only one instance of the app is running
3. **Token Expires**: Check JWT_SECRET consistency and token expiry
4. **TypeScript Errors**: Run `npm run build` to check for compilation errors

This step-by-step guide provides a complete working foundation for user management that you can expand upon with additional features like 2FA, social login, friends system, etc.