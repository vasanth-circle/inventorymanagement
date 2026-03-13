import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import StockInward from './pages/StockInward';
import StockOutward from './pages/StockOutward';
import StockReturn from './pages/StockReturn';
import Reports from './pages/Reports';
import Stocks from './pages/Stocks';
import Categories from './pages/Categories';
import BulkImport from './pages/BulkImport';
import Users from './pages/Users';
import Customers from './pages/Customers';
import SalesOrders from './pages/SalesOrders';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Locations from './pages/Locations';

function App() {
    return (
        <AuthProvider>
            <InventoryProvider>
                <Router>
                    <Toaster position="top-right" />
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Protected Routes */}
                        <Route
                            path="/*"
                            element={
                                <ProtectedRoute>
                                    <div className="flex min-h-screen bg-gray-100">
                                        <Sidebar />
                                        <main className="flex-1 p-6 overflow-y-auto">
                                            <Routes>
                                                <Route path="/dashboard" element={<Dashboard />} />
                                                <Route path="/inventory" element={<Inventory />} />
                                                <Route path="/stock-inward" element={<StockInward />} />
                                                <Route path="/stock-outward" element={<StockOutward />} />
                                                <Route path="/stock-return" element={<StockReturn />} />
                                                <Route path="/reports" element={<Reports />} />
                                                <Route path="/stocks" element={<Stocks />} />
                                                <Route path="/categories" element={<Categories />} />
                                                <Route path="/bulk-import" element={<BulkImport />} />
                                                <Route path="/users" element={<Users />} />
                                                <Route path="/customers" element={<Customers />} />
                                                <Route path="/sales-orders" element={<SalesOrders />} />
                                                <Route path="/vendors" element={<Vendors />} />
                                                <Route path="/purchase-orders" element={<PurchaseOrders />} />
                                            </Routes>
                                        </main>
                                    </div>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Router>
            </InventoryProvider>
        </AuthProvider>
    );
}

export default App;
