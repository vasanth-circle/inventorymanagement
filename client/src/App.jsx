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
import StockReturnsList from './pages/StockReturnsList';
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
import Assets from './pages/Assets';
import AssetDashboard from './pages/AssetDashboard';
import AssetReports from './pages/AssetReports';
import Profile from './pages/Profile';
import ProductShowcase from './pages/ProductShowcase';
import ProductShowcaseEdit from './pages/ProductShowcaseEdit';
import PublicProductPage from './pages/PublicProductPage';
import VendorLedger from './pages/VendorLedger';
import BottomNav from './components/BottomNav';
import HSNManagement from './pages/HSNManagement';
import LedgerReports from './pages/LedgerReports';
import Onboarding from './pages/Onboarding';
import Sizes from './pages/Sizes';
import Brands from './pages/Brands';
import Finishes from './pages/Finishes';
import ActionLogs from './pages/ActionLogs';
import ProfitTracking from './pages/ProfitTracking';
import Expenses from './pages/Expenses';
import CustomReports from './pages/CustomReports';
import CreditNotes from './pages/CreditNotes';
import GoodsReceiptNotes from './pages/GoodsReceiptNotes';
import WarehouseTransfers from './pages/WarehouseTransfers';
import WorkflowRules from './pages/WorkflowRules';
import ReportSchedules from './pages/ReportSchedules';
import ApiSettings from './pages/ApiSettings';
import ShippingIntegration from './pages/ShippingIntegration';
import EcommerceChannels from './pages/EcommerceChannels';

import WarehouseLayout from './pages/WarehouseLayout';
import BOM from './pages/BOM';
import Production from './pages/Production';
import BiDashboard from './pages/BiDashboard';
import AiInsights from './pages/AiInsights';

function AppLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Sidebar with mobile responsiveness */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8">
                    {children}
                </main>
                <BottomNav />
            </div>
        </div>
    );
}

function App() {
    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';
    const fallbackRoute = activeApp === 'assets' ? '/assets/dashboard' : '/dashboard';

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
                        {/* Public product showcase page — no login required */}
                        <Route path="/p/:slug" element={<PublicProductPage />} />

                        {/* Protected Onboarding (No Sidebar) */}
                        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                        {/* Protected Routes */}
                        <Route
                            path="/*"
                            element={
                                <ProtectedRoute>
                                    <AppLayout>
                                        <Routes>
                                            <Route path="/profile" element={<Profile />} />
                                            <Route path="/dashboard" element={<Dashboard />} />
                                            <Route path="/inventory" element={<Inventory />} />
                                            <Route path="/stock-inward" element={<StockInward />} />
                                            <Route path="/stock-outward" element={<StockOutward />} />
                                            <Route path="/stock-return" element={<StockReturn />} />
                                            <Route path="/stock-returns-list" element={<StockReturnsList />} />
                                            <Route path="/stock-adjustment" element={<StockAdjustment />} />
                                            <Route path="/reports" element={<Reports />} />
                                            <Route path="/ledger-reports" element={<LedgerReports />} />
                                            <Route path="/profit-tracking" element={<ProfitTracking />} />
                                            <Route path="/stocks" element={<Stocks />} />
                                            <Route path="/categories" element={<Categories />} />
                                            <Route path="/bulk-import" element={<BulkImport />} />
                                            <Route path="/users" element={<Users />} />
                                            <Route path="/customers" element={<Customers />} />
                                            <Route path="/customers/:id/ledger" element={<CustomerLedger />} />
                                            <Route path="/customer-ledger" element={<CustomerLedger />} />
                                            <Route path="/customer-ledger/:id" element={<CustomerLedger />} />
                                            <Route path="/sales-orders" element={<SalesOrders />} />
                                            <Route path="/vendors" element={<Vendors />} />
                                            <Route path="/purchase-orders" element={<PurchaseOrders />} />
                                            <Route path="/vendor-ledger" element={<VendorLedger />} />
                                            <Route path="/hsn-management" element={<HSNManagement />} />
                                            <Route path="/vendor-ledger/:id" element={<VendorLedger />} />
                                            <Route path="/expenses" element={<Expenses />} />
                                            <Route path="/sizes" element={<Sizes />} />
                                            <Route path="/brands" element={<Brands />} />
                                            <Route path="/finishes" element={<Finishes />} />
                                            <Route path="/action-logs" element={<ActionLogs />} />
                                            <Route path="/custom-reports" element={<CustomReports />} />
                                            <Route path="/locations" element={<Locations />} />
                                            <Route path="/dispatch-management" element={<DispatchManagement />} />
                                            <Route path="/settings" element={<Settings />} />
                                            <Route path="/quotations" element={<Quotations />} />
                                            <Route path="/credit-notes" element={<CreditNotes />} />
                                            <Route path="/grn" element={<GoodsReceiptNotes />} />
                                            <Route path="/warehouse-transfers" element={<WarehouseTransfers />} />
                                            <Route path="/workflow-rules" element={<WorkflowRules />} />
                                            <Route path="/report-schedules" element={<ReportSchedules />} />
                                            <Route path="/api-settings" element={<ApiSettings />} />
                                            <Route path="/shipping" element={<ShippingIntegration />} />
                                            <Route path="/ecommerce" element={<EcommerceChannels />} />

                                            <Route path="/warehouse-layout" element={<WarehouseLayout />} />
                                            <Route path="/bom" element={<BOM />} />
                                            <Route path="/production" element={<Production />} />
                                            <Route path="/bi-dashboard" element={<BiDashboard />} />
                                            <Route path="/ai-insights" element={<AiInsights />} />
                                            <Route path="/assets" element={<Assets />} />
                                            <Route path="/assets/dashboard" element={<AssetDashboard />} />
                                            <Route path="/assets/reports" element={<AssetReports />} />
                                            <Route path="/product-showcase" element={<ProductShowcase />} />
                                            <Route path="/product-showcase/:id/images" element={<ProductShowcaseEdit />} />
                                            <Route path="/" element={<Navigate to={fallbackRoute} replace />} />
                                            <Route path="*" element={<Navigate to={fallbackRoute} replace />} />
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
