import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import ProtectedRoute from './components/ProtectedRoute';
import MenuProtectedRoute from './components/MenuProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import StockInward from './pages/StockInward';
import StockOutward from './pages/StockOutward';
import Reports from './pages/Reports';
import ScanBill from './pages/ScanBill';
import Returns from './pages/Returns';
import StockReturn from './pages/StockReturn';
import Users from './pages/Users';

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
                                    <div className="min-h-screen bg-gray-100">
                                        <Navbar />
                                        <div className="flex">
                                            <Sidebar />
                                            <main className="flex-1 p-6">
                                                <Routes>
                                                    <Route path="/dashboard" element={
                                                        <MenuProtectedRoute menuId="dashboard">
                                                            <Dashboard />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/inventory" element={
                                                        <MenuProtectedRoute menuId="inventory">
                                                            <Inventory />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/stock-inward" element={
                                                        <MenuProtectedRoute menuId="stock-inward">
                                                            <StockInward />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/stock-outward" element={
                                                        <MenuProtectedRoute menuId="stock-outward">
                                                            <StockOutward />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/stock-return" element={
                                                        <MenuProtectedRoute menuId="stock-return">
                                                            <StockReturn />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/scan-bill" element={
                                                        <MenuProtectedRoute menuId="scan-bill">
                                                            <ScanBill />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/returns" element={
                                                        <MenuProtectedRoute menuId="returns">
                                                            <Returns />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/reports" element={
                                                        <MenuProtectedRoute menuId="reports">
                                                            <Reports />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/users" element={
                                                        <MenuProtectedRoute menuId="users">
                                                            <Users />
                                                        </MenuProtectedRoute>
                                                    } />
                                                    <Route path="/" element={<Navigate to="/dashboard" />} />
                                                </Routes>
                                            </main>
                                        </div>
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
