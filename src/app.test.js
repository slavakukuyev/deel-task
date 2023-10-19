const request = require('supertest');
const app = require('./app');

describe('GET /contracts/:id', () => {
  test('should return a contract by id', async () => {
    const response = await request(app).get('/contracts/1');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', 1);
  });

  test('should return 404 if contract is not found', async () => {
    const response = await request(app).get('/contracts/999');
    expect(response.status).toBe(404);
  });
});

describe('GET /jobs/unpaid', () => {
  test('should return unpaid jobs with associated contracts and profiles', async () => {
    const response = await request(app).get('/jobs/unpaid');
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('Contract');
    expect(response.body[0].Contract).toHaveProperty('Client');
    expect(response.body[0].Contract).toHaveProperty('Contractor');
  });
});

describe('GET /admin/best-profession', () => {
  test('should return the profession that earned the most money for any contractor that worked in the query time range', async () => {
    const response = await request(app).get('/admin/best-profession?start=2021-01-01&end=2021-12-31');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('bestProfession');
  });

  test('should return 404 if no jobs are found within the query time range', async () => {
    const response = await request(app).get('/admin/best-profession?start=2022-01-01&end=2022-12-31');
    expect(response.status).toBe(404);
  });
});

describe('GET /admin/best-clients', () => {
  test('should return the clients that paid the most money for any jobs in the query time range', async () => {
    const response = await request(app).get('/admin/best-clients?start=2021-01-01&end=2021-12-31&limit=2');
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('paid');
  });

  test('should return an empty array if no jobs are found within the query time range', async () => {
    const response = await request(app).get('/admin/best-clients?start=2022-01-01&end=2022-12-31&limit=2');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

