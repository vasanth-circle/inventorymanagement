import { jest } from '@jest/globals';
import request from 'supertest';
import { connect, closeDatabase, clearDatabase } from './dbHandler.js';

let app;
let adminToken;

describe('Location API', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        await connect();
        const module = await import('../server.js');
        app = module.default;

        const adminRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Admin User',
                email: 'admin@loc.com',
                password: 'password123',
                companyName: 'Loc Corp'
            });
        adminToken = adminRes.body.token;
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('POST /api/locations', () => {
        test('should create a new location', async () => {
            const res = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Main Warehouse',
                    address: '123 Storage St'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.name).toBe('Main Warehouse');
        });
    });

    describe('GET /api/locations', () => {
        test('should get all locations for the tenant', async () => {
            await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Branch Office' });

            const res = await request(app)
                .get('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('PUT /api/locations/:id', () => {
        test('should update a location', async () => {
            const createRes = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Old Loc' });
            
            const locationId = createRes.body._id;

            const res = await request(app)
                .put(`/api/locations/${locationId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New Loc' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('New Loc');
        });
    });

    describe('DELETE /api/locations/:id', () => {
        test('should delete a location', async () => {
            const createRes = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'To Delete Loc' });
            
            const locationId = createRes.body._id;

            const res = await request(app)
                .delete(`/api/locations/${locationId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Location deleted successfully');
        });
    });
});
