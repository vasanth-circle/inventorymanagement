import { jest } from '@jest/globals';
import request from 'supertest';
import { connect, closeDatabase, clearDatabase } from './dbHandler.js';

// Import app AFTER setting up memory DB URIs
let app;

describe('Auth API', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        await connect();
        // Dynamic import to ensure process.env.APP_MONGODB_URI is set before db.js is loaded
        const module = await import('../server.js');
        app = module.default;
    });

    afterAll(async () => {
        await closeDatabase();
    });

    afterEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/auth/register', () => {
        test('should register a new user and tenant', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Admin User',
                    email: 'admin@test.com',
                    password: 'password123',
                    companyName: 'Test Corp'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.email).toBe('admin@test.com');
            expect(res.body.role).toBe('tenant_owner');
        });

        test('should fail if email already exists', async () => {
            const userData = {
                name: 'Admin User',
                email: 'admin@test.com',
                password: 'password123',
                companyName: 'Test Corp'
            };

            await request(app).post('/api/auth/register').send(userData);
            
            const res = await request(app)
                .post('/api/auth/register')
                .send(userData);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('User already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Register a user first
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Login User',
                    email: 'login@test.com',
                    password: 'password123',
                    companyName: 'Login Corp'
                });
        });

        test('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@test.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
        });

        test('should fail with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@test.com',
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid credentials');
        });
    });

    describe('GET /api/auth/me', () => {
        let token;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Me User',
                    email: 'me@test.com',
                    password: 'password123',
                    companyName: 'Me Corp'
                });
            token = res.body.token;
        });

        test('should get current user profile', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe('me@test.com');
        });

        test('should fail without token', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.statusCode).toBe(401);
        });
    });
});
