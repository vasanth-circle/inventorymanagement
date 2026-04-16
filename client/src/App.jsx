import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import StockInward from './pages/StockInward';
import StockOutward from './pages/StockOutward';
import StockReturn from './pages/StockReturn';
import StockAdjustment from './pages/StockAdjustment';
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
import DispatchManagement from './pages/DispatchManagement';
import Settings from './pages/Settings';
import Quotations from './pages/Quotations';
import CustomerLedger from './pages/CustomerLedger';

function AppLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Sidebar with mobile responsiveness */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
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
                                    <AppLayout>
                                        <Routes>
                                            <Route path="/dashboard" element={<Dashboard />} />
                                            <Route path="/inventory" element={<Inventory />} />
                                            <Route path="/stock-inward" element={<StockInward />} />
                                            <Route path="/stock-outward" element={<StockOutward />} />
                                            <Route path="/stock-return" element={<StockReturn />} />
                                            <Route path="/stock-adjustment" element={<StockAdjustment />} />
                                            <Route path="/reports" element={<Reports />} />
                                            <Route path="/stocks" element={<Stocks />} />
                                            <Route path="/categories" element={<Categories />} />
                                            <Route path="/bulk-import" element={<BulkImport />} />
                                            <Route path="/users" element={<Users />} />
                                            <Route path="/customers" element={<Customers />} />
                                            <Route path="/customers/:id/ledger" element={<CustomerLedger />} />
                                            <Route path="/sales-orders" element={<SalesOrders />} />
                                            <Route path="/vendors" element={<Vendors />} />
                                            <Route path="/purchase-orders" element={<PurchaseOrders />} />
                                            <Route path="/locations" element={<Locations />} />
                                            <Route path="/dispatch-management" element={<DispatchManagement />} />
                                            <Route path="/settings" element={<Settings />} />
                                            <Route path="/quotations" element={<Quotations />} />
                                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                        </Routes>
                                    </AppLayout>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Router>
            </InventoryProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}

export default App;
