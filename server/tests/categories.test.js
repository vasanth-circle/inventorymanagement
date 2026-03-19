import { jest } from '@jest/globals';
import request from 'supertest';
import { connect, closeDatabase, clearDatabase } from './dbHandler.js';

let app;
let adminToken;
let managerToken;
let staffToken;

describe('Category API', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        await connect();
        const module = await import('../server.js');
        app = module.default;

        // Setup: Register an admin to get a tenant and token
        const adminRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Admin User',
                email: 'admin@cat.com',
                password: 'password123',
                companyName: 'Cat Corp'
            });
        adminToken = adminRes.body.token;

        // Login to get other roles or use addUser if available
        // For simplicity, we'll just use the admin token for most CRUD tests
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('POST /api/categories', () => {
        test('should create a new category', async () => {
            const res = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Electronics',
                    description: 'Gadgets and stuff'
                });

            if (res.statusCode !== 201) {
                console.log('Category Creation Failed:', res.body);
            }

            expect(res.statusCode).toBe(201);
            expect(res.body.name).toBe('Electronics');
            expect(res.body).toHaveProperty('tenantId');
        });

        test('should fail without authorization', async () => {
            const res = await request(app)
                .post('/api/categories')
                .send({ name: 'Unauth' });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/categories', () => {
        test('should get all categories for the tenant', async () => {
            await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Furniture' });

            const res = await request(app)
                .get('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body.some(c => c.name === 'Furniture')).toBe(true);
        });
    });

    describe('PUT /api/categories/:id', () => {
        test('should update a category', async () => {
            const createRes = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Old Name' });
            
            const categoryId = createRes.body._id;

            const res = await request(app)
                .put(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New Name' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('New Name');
        });
    });

    describe('DELETE /api/categories/:id', () => {
        test('should delete a category', async () => {
            const createRes = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'To Delete' });
            
            const categoryId = createRes.body._id;

            const res = await request(app)
                .delete(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Category deleted successfully');
        });
    });
});
