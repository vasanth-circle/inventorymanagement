# API Documentation

## Authentication & Onboarding

### 1. Register a New Tenant (SaaS Onboarding)
**Endpoint:** `POST /api/auth/register`

Creates a new Tenant, seeds default Roles (Admin, Manager, Staff), configures default Settings, generates a Trial Subscription, and creates the initial Admin user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "admin@examplecompany.com",
  "password": "SecurePassword123!",
  "phone": "9876543210",
  "companyName": "Example Company",
  "termsAccepted": true
}
```

**Response (201 Created):**
```json
{
  "_id": "60d5ecb74d6bb830b8e71123",
  "name": "John Doe",
  "email": "admin@examplecompany.com",
  "role": "tenant_admin",
  "tenantId": "60d5ecb74d6bb830b8e70987",
  "token": "eyJhbGciOiJIUzI1NiIsInR5..."
}
```

### 2. Login
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "admin@examplecompany.com",
  "password": "SecurePassword123!"
}
```

---

## Inventory & Sales

*Note: All endpoints below require the Authorization header.*
`Authorization: Bearer <your_token>`

### 3. Get Items
**Endpoint:** `GET /api/items`

**Response (200 OK):**
```json
{
  "items": [
    {
      "_id": "60d5ecb74d6bb830b8e71234",
      "name": "Sample Product",
      "quantity": 500,
      "price": 100
    }
  ],
  "totalPages": 1,
  "currentPage": 1,
  "totalItems": 1
}
```

### 4. Create Sales Order
**Endpoint:** `POST /api/sales-orders`

**Request Body:**
```json
{
  "party": "60d5ecb74d6bb830b8e71999",
  "isEstimation": false,
  "items": [
    {
      "item": "60d5ecb74d6bb830b8e71234",
      "quantity": 10,
      "price": 100
    }
  ]
}
```

---

## Purchasing & Workflows

### 5. Create Purchase Order (Subject to Approvals)
**Endpoint:** `POST /api/purchase-orders`

If the `totalAmount` exceeds ₹10,000, the system automatically places the PO into a `draft` status and flags `approvalStatus` as `pending`. Notifications are sent to Admins.

**Request Body:**
```json
{
  "party": "60d5ecb74d6bb830b8e71888",
  "partyBillNumber": "INV-2023-001",
  "items": [
    {
      "item": "60d5ecb74d6bb830b8e71234",
      "quantity": 200,
      "price": 90,
      "total": 18000
    }
  ],
  "totalAmount": 18000
}
```

### 6. Approve Purchase Order
**Endpoint:** `PATCH /api/purchase-orders/:id/approve`
**Access:** Admin / Manager only.

**Request Body:**
```json
{
  "approvalStatus": "approved",
  "approvalNotes": "Looks good, proceed with purchase."
}
```
