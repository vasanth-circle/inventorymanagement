# Inventory Management System

A comprehensive full-stack inventory management system built with React, Node.js, Express, and MongoDB.

## Features

### Core Functionality
- ✅ **User Authentication** - JWT-based authentication with role-based access control (Admin, Manager, Staff)
- ✅ **Stock Management** - Inward, Outward, and Transfer operations
- ✅ **Real-time Dashboard** - Overview cards, charts, and analytics
- ✅ **Inventory Table** - Dynamic columns with filtering, search, and pagination
- ✅ **Low Stock Alerts** - Automatic alerts when stock falls below threshold
- ✅ **Reports & Analytics** - Transaction reports with CSV export
- ✅ **Image Upload** - Item images with drag & drop support
- ✅ **Responsive Design** - Mobile-first design with Tailwind CSS

### Technology Stack

**Frontend:**
- React 18
- React Router DOM
- Tailwind CSS
- Recharts (for data visualization)
- Axios
- React Hot Toast

**Backend:**
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Bcrypt for password hashing
- Multer for file uploads
- Joi for validation

## Project Structure

```
InventoryManagement/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── context/       # Context providers
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── server/                # Node.js backend
│   ├── controllers/       # Business logic
│   ├── middleware/        # Auth, validation, error handling
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API routes
│   ├── uploads/          # Uploaded images
│   ├── server.js         # Server entry point
│   └── package.json
│
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the server directory:
```env
MONGODB_URI=mongodb://localhost:27017/inventory_management
JWT_SECRET=your_jwt_secret_key_change_this_in_production
PORT=5000
NODE_ENV=development
```

4. Start MongoDB (if running locally):
```bash
mongod
```

5. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies (if not already installed):
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The client will run on `http://localhost:3000`

## Default User Credentials

After starting the application, you'll need to register a new user. The first user should be created with the "admin" role for full access.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - Get all users (Admin only)

### Items
- `GET /api/items` - Get all items (with pagination & filters)
- `POST /api/items` - Create new item
- `GET /api/items/:id` - Get single item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item (Admin/Manager)

### Transactions
- `POST /api/transactions/inward` - Record stock inward
- `POST /api/transactions/outward` - Record stock outward
- `POST /api/transactions/transfer` - Record stock transfer
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/item/:itemId` - Get item history

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/low-stock` - Get low stock items
- `GET /api/dashboard/recent-transactions` - Get recent transactions
- `GET /api/dashboard/stock-trend` - Get stock movement trend

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (Admin/Manager)
- `PUT /api/categories/:id` - Update category (Admin/Manager)
- `DELETE /api/categories/:id` - Delete category (Admin)

## Features in Detail

### Stock Management
- **Inward**: Add new items or increase existing stock with image upload
- **Outward**: Remove stock with reason tracking (Sale, Damage, Expired, etc.)
- **Transfer**: Move stock between locations

### Dashboard Analytics
- Total items count
- Low stock alerts
- Out of stock items
- Stock value calculation
- Today's inward/outward summary
- Category-wise distribution (Pie chart)
- Recent transactions table

### Inventory Management
- Advanced filtering (category, status, search)
- Pagination support
- Export to CSV
- Image preview
- Stock status indicators

### Reports
- Date range filtering
- Transaction type filtering
- Detailed transaction history
- CSV export functionality

## User Roles & Permissions

- **Admin**: Full access to all features
- **Manager**: Can manage items, categories, and transactions
- **Staff**: Can view and create transactions

## Development

### Running in Development Mode

Backend:
```bash
cd server
npm run dev
```

Frontend:
```bash
cd client
npm run dev
```

### Building for Production

Frontend:
```bash
cd client
npm run build
```

## Future Enhancements

- Barcode/QR code scanning
- Multi-language support
- Email notifications for low stock
- Advanced analytics and forecasting
- Backup & restore functionality
- Mobile app

## License

ISC

## Support

For issues or questions, please create an issue in the repository.
