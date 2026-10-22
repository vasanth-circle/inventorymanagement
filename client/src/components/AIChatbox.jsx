import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';

// ── Currency formatter ─────────────────────────────────────────────────────
const fmt = (n) => {
    n = Number(n) || 0;
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ── Intent detection ───────────────────────────────────────────────────────
// ── Intent detection ───────────────────────────────────────────────────────
function detectIntent(input) {
    const t = input.toLowerCase().trim();

    // Period detection
    const isWeek = /this week|week|weekly|last 7|past week/.test(t);
    const isMonth = /this month|month|monthly|current month/.test(t);
    const period = isMonth ? 'month' : isWeek ? 'week' : 'today';

    // 1. Sales persons / Users / Staff (check first so "sales" doesn't hijack it)
    if (/sales\s*person|sales\s*man|sales\s*men|sales\s*team|sales\s*rep|sales\s*staff|sales\s*user|how many.*sales\s*person|how many.*user|how many.*staff|team members?|total users?|active users?/.test(t))
        return { intent: 'sales_persons', fetch: true };

    // 2. Total orders / Sales and Purchase count
    // Handles typos like "purchsae" as well
    if (/totally.*(?:order|sale|purch)|sales.*(?:and|&).*purch.*order|purch.*(?:and|&).*sales.*order|total.*(?:sales|purch).*order|how many.*(?:sales|purch).*order|total.*orders?|how many.*orders?|all.*orders?|totally.*how many/i.test(t))
        return { intent: 'total_orders', fetch: true };

    // 3. Top stocked item in inventory (e.g. "which item is in the most", "which item is more in the inventory", "highest stock item", "most stock item")
    if (/which item.*(?:most|more)|item.*(?:most|more).*inventory|more.*(?:in.*inventory|in.*stock)|most.*(?:in.*inventory|in.*stock|stock)|highest.*stock|max.*stock|most.*quantity|top.*stock|which item.*more|more in inventory|item.*in the most/i.test(t))
        return { intent: 'top_stocked_item', fetch: true };

    // 4. Customers & Vendors count
    if (/how many.*(?:customer|vendor|supplier|part)|total.*(?:customer|vendor|supplier|part)/.test(t))
        return { intent: 'parties_summary', fetch: true };

    // 5. Today's sale
    if (/today.*sale|sale.*today|today.*revenue|today.*income|today.*sell|today.*sold|today.*order|how much.*sale|sale.*amount|sales today|today ka sale/.test(t))
        return { intent: 'today_sales', fetch: true };

    // 6. Week/month sales
    if ((isWeek || isMonth) && /sale|revenue|income|sell|sold|order/.test(t))
        return { intent: isMonth ? 'month_sales' : 'week_sales', fetch: true };

    // 7. Purchase
    if (/purchase|bought|inward purchase|today.*purchase|purchase.*today|how much.*purchase/.test(t))
        return { intent: 'today_purchase', fetch: true };

    // 8. Customers today
    if (/new customer|today.*customer|customer.*today|how many customer.*today/.test(t))
        return { intent: 'today_customers', fetch: true };

    // 9. Top selling item (strictly sales/sold items)
    if (/top.*(?:sell|sold)|best.*(?:sell|sold)|most.*sold|which item.*sold|best.*product.*sold|top.*selling|best.*selling/.test(t))
        return { intent: 'top_selling_item', fetch: true, params: { period } };

    // 10. Top customer / who bought most
    if (/top.*customer|who.*bought|who.*purchase|who.*buy|best.*customer|which customer|who.*order/.test(t))
        return { intent: 'top_customer', fetch: true, params: { period } };

    // 11. Stock summary & Total Stock Value
    if (/stock.*summary|total.*stock|stock.*value|how many.*item|item.*count|total.*item|inventory.*value|how much.*stock/.test(t))
        return { intent: 'stock_summary', fetch: true };

    // 12. Low stock
    if (/low.*stock|out.*stock|shortage|reorder|stock.*low|running.*low|lowest.*stock/.test(t))
        return { intent: 'low_stock', fetch: true };

    // 13. Today inward / boxes received
    if (/inward|received.*today|today.*received|boxes.*received|stock.*received|how many.*box|how many.*boxes/.test(t))
        return { intent: 'today_inward', fetch: true };

    return { intent: 'faq', fetch: false };
}

// ── Live data response builders ────────────────────────────────────────────
function buildLiveResponse(intent, data) {
    switch (intent) {
        case 'top_stocked_item': {
            const { topItem, items } = data;
            if (!topItem) return `📦 **Inventory Stock**\n\nNo items found in inventory.`;
            const topVal = Number(topItem.quantity || 0) * Number(topItem.price || 0);
            let msg = `📦 **Highest Stock Item in Inventory**\n\n`;
            msg += `🥇 **${topItem.name}** has the most stock!\n`;
            msg += `• 📦 **Current Stock:** ${Number(topItem.quantity || 0).toFixed(2)} boxes\n`;
            msg += `• 💵 **Unit Price:** ${fmt(topItem.price)}\n`;
            msg += `• 💰 **Total Stock Value:** ${fmt(topVal)}\n`;
            if (topItem.brand) msg += `• 🏷️ **Brand:** ${topItem.brand}\n`;
            if (items?.length > 1) {
                msg += `\n📋 **Top 5 Items by Stock:**\n`;
                items.slice(0, 5).forEach((item, i) => {
                    const val = Number(item.quantity || 0) * Number(item.price || 0);
                    msg += `${i + 1}. **${item.name}** — ${Number(item.quantity).toFixed(2)} boxes (${fmt(val)})\n`;
                });
            }
            return msg;
        }
        case 'sales_persons': {
            const { totalUsers, activeUsers, salesCount, salesUsers, allUsers } = data;
            let msg = `👥 **Sales Team & Staff Overview**\n\n`;
            msg += `👤 **Dedicated Sales Persons:** ${salesCount}\n`;
            if (salesUsers?.length > 0) {
                salesUsers.forEach(u => {
                    msg += `• **${u.name}** (${u.email || u.phone || 'Active'})\n`;
                });
            } else {
                msg += `_No dedicated sales person accounts found._\n`;
            }
            msg += `\n🏢 **Active System Users (${activeUsers || totalUsers}):**\n`;
            if (allUsers?.length > 0) {
                allUsers.slice(0, 5).forEach(u => {
                    const roleName = (u.role || 'Staff').replace(/_/g, ' ').toUpperCase();
                    msg += `• **${u.name}** — ${roleName} (${u.email})\n`;
                });
            }
            return msg;
        }
        case 'total_orders': {
            const { sales, purchase, totalOrders } = data;
            let msg = `📋 **Total Orders Summary (All Time)**\n\n`;
            msg += `🛒 **Sales Orders:**\n`;
            msg += `• **Total Orders:** ${sales.count} orders\n`;
            msg += `• **Total Value:** ${sales.formattedValue}\n`;
            msg += `• **Total Boxes:** ${sales.formattedBoxes} boxes\n\n`;
            msg += `🎫 **Purchase Orders:**\n`;
            msg += `• **Total Orders:** ${purchase.count} orders\n`;
            msg += `• **Total Value:** ${purchase.formattedValue}\n`;
            msg += `• **Total Boxes:** ${purchase.formattedBoxes} boxes\n\n`;
            msg += `📊 **Combined Total:** ${totalOrders} orders processed`;
            return msg;
        }
        case 'parties_summary': {
            const { customersCount, vendorsCount, partiesCount } = data;
            let msg = `👥 **Customer & Vendor Summary**\n\n`;
            msg += `🛍️ **Total Customers:** ${customersCount || 0}\n`;
            msg += `🏢 **Total Vendors / Suppliers:** ${vendorsCount || 0}\n`;
            msg += `🗂️ **Total Directory Parties:** ${partiesCount || 0}\n`;
            return msg;
        }
        case 'today_sales': {
            const { totalValue, totalBoxes, orderCount, topItem, topCustomer } = data;
            let msg = `📊 **Today's Sales Report**\n\n`;
            msg += `💰 **Total Value:** ${fmt(totalValue)}\n`;
            msg += `📦 **Total Boxes Sold:** ${Number(totalBoxes || 0).toFixed(2)}\n`;
            msg += `🧾 **Orders Created:** ${orderCount || 0}\n`;
            if (topItem?.name) msg += `\n🏆 **Top Selling Item:** ${topItem.name} (${Number(topItem.qty || 0).toFixed(2)} boxes)\n`;
            if (topCustomer?.name) msg += `👤 **Top Customer:** ${topCustomer.name} (${fmt(topCustomer.totalValue)})\n`;
            if (!orderCount) msg = `📊 **Today's Sales**\n\nNo sales orders found for today yet.`;
            return msg;
        }
        case 'today_purchase': {
            const { totalValue, totalBoxes, orderCount, topVendor } = data;
            let msg = `🛒 **Today's Purchase Report**\n\n`;
            msg += `💰 **Total Purchase Value:** ${fmt(totalValue)}\n`;
            msg += `📦 **Total Boxes Purchased:** ${Number(totalBoxes || 0).toFixed(2)}\n`;
            msg += `🧾 **Purchase Orders:** ${orderCount || 0}\n`;
            if (topVendor?.name) msg += `\n🏢 **Top Vendor:** ${topVendor.name} (${fmt(topVendor.totalValue)})\n`;
            if (!orderCount) msg = `🛒 **Today's Purchases**\n\nNo purchase orders found for today yet.`;
            return msg;
        }
        case 'today_customers': {
            const { newCustomers, activeCustomers } = data;
            let msg = `👥 **Today's Customer Report**\n\n`;
            msg += `🆕 **New Customers Added:** ${newCustomers}\n`;
            msg += `🛒 **Customers Who Bought Today:** ${activeCustomers}\n`;
            if (!newCustomers && !activeCustomers) msg += `\nNo customer activity recorded for today yet.`;
            return msg;
        }
        case 'top_selling_item': {
            const { topItems, period } = data;
            const periodLabel = period === 'month' ? 'This Month' : period === 'week' ? 'This Week' : 'Today';
            if (!topItems?.length) return `🏆 **Top Selling Items (${periodLabel})**\n\nNo sales data found for this period.`;
            let msg = `🏆 **Top Selling Items — ${periodLabel}**\n\n`;
            topItems.slice(0, 5).forEach((item, i) => {
                msg += `${i + 1}. **${item.name}** — ${Number(item.qty).toFixed(2)} boxes (${fmt(item.revenue)})\n`;
            });
            return msg;
        }
        case 'top_customer': {
            const { topCustomers, period } = data;
            const periodLabel = period === 'month' ? 'This Month' : period === 'week' ? 'This Week' : 'Today';
            if (!topCustomers?.length) return `👤 **Top Customers (${periodLabel})**\n\nNo customer data found for this period.`;
            let msg = `👤 **Top Customers — ${periodLabel}**\n\n`;
            topCustomers.slice(0, 5).forEach((c, i) => {
                msg += `${i + 1}. **${c.name}** — ${fmt(c.totalValue)} (${c.orderCount} orders)\n`;
            });
            return msg;
        }
        case 'stock_summary': {
            const { totalItems, lowStock, outOfStock, totalQty } = data;
            return `📦 **Stock Summary**\n\n🗂️ **Total Items:** ${totalItems}\n📦 **Total Quantity:** ${Number(totalQty).toFixed(2)} boxes\n⚠️ **Low Stock Items:** ${lowStock}\n❌ **Out of Stock:** ${outOfStock}\n💰 **Stock Value:** ${fmt(data.stockValue)}`;
        }
        case 'week_sales': {
            const { totalValue, totalBoxes, orderCount } = data;
            return `📊 **This Week's Sales**\n\n💰 **Total Value:** ${fmt(totalValue)}\n📦 **Total Boxes:** ${Number(totalBoxes || 0).toFixed(2)}\n🧾 **Orders:** ${orderCount || 0}`;
        }
        case 'month_sales': {
            const { totalValue, totalBoxes, orderCount } = data;
            return `📊 **This Month's Sales**\n\n💰 **Total Value:** ${fmt(totalValue)}\n📦 **Total Boxes:** ${Number(totalBoxes || 0).toFixed(2)}\n🧾 **Orders:** ${orderCount || 0}`;
        }
        case 'low_stock': {
            const { items, count } = data;
            if (!count) return `✅ **Low Stock Alert**\n\nNo items are currently low on stock. All good!`;
            let msg = `⚠️ **Low Stock Items (${count})**\n\n`;
            items.slice(0, 8).forEach(item => {
                msg += `• **${item.name}** — ${item.quantity} left (min: ${item.minStockThreshold})\n`;
            });
            return msg;
        }
        case 'today_inward': {
            const { totalQty, count } = data;
            return `📥 **Today's Stock Inward**\n\n📦 **Total Boxes Received:** ${Number(totalQty || 0).toFixed(2)}\n🧾 **Inward Entries:** ${count || 0}`;
        }
        default:
            return null;
    }
}

// ── FAQ fallback responses ─────────────────────────────────────────────────
const FAQ_RESPONSES = [
    {
        triggers: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'namaste'],
        response: (name) => `Hey ${name}! 👋 I'm your InventoryPro AI assistant.\n\nYou can ask me live questions like:\n- **"Today's sales?"**\n- **"Which item is more in the inventory?"**\n- **"Totally how many sales and purchase orders?"**\n- **"How many sales persons?"**\n- **"Total stock value?"**\n- **"Low stock items?"**`,
    },
    {
        triggers: ['how to add item', 'create item', 'item master', 'add product', 'manage stock'],
        response: () => `📦 **Inventory Management** lets you:\n- Add/edit items with categories, brands & sizes\n- Set HSN codes for GST compliance\n- Track stock per location\n- Bulk import via Excel\n\nGo to **Inventory → Items** to manage your products.`,
        route: '/inventory',
    },
    {
        triggers: ['how to create sale', 'create sale order', 'create sales order', 'new sale order', 'how to sell'],
        response: () => `🛒 **Sales Orders** let you:\n- Create orders with multiple items\n- Apply discounts and GST\n- Track payment status\n- Generate invoices/challans\n\nGo to **Sales → Sales Orders**.`,
        route: '/sales-orders',
    },
    {
        triggers: ['how to create purchase', 'create purchase order', 'new purchase order', 'how to buy from vendor'],
        response: () => `🎫 **Purchase Orders** let you:\n- Record purchases from vendors\n- Track received vs ordered quantities\n- Auto-update stock on inward\n\nGo to **Purchases → Purchase Entry**.`,
        route: '/purchase-orders',
    },
    {
        triggers: ['report', 'reports', 'analytics', 'profit report', 'gst report'],
        response: () => `📈 **Reports Hub** includes:\n- Sales & Purchase Reports\n- Stock & Ledger Reports\n- Profit Tracking\n- Custom Reports\n\nAll exportable to PDF or Excel!`,
        route: '/reports-hub',
    },
    {
        triggers: ['party ledger', 'party list', 'customer ledger', 'vendor ledger'],
        response: () => `👥 **Parties** lets you:\n- Track customers & vendors\n- View outstanding balances\n- See individual ledgers\n\nGo to **Sales → Parties**.`,
        route: '/parties',
    },
    {
        triggers: ['dispatch order', 'dispatch challan', 'how to dispatch'],
        response: () => `🚚 **Dispatch Management** handles fulfillment:\n- Record dispatch quantities\n- Auto-deduct from stock\n- Generate challans\n\nGo to **Sales → Dispatch Management**.`,
        route: '/dispatch-management',
    },
    {
        triggers: ['settings', 'configure', 'company profile', 'change password'],
        response: () => `⚙️ **Settings** lets you configure:\n- Company name & logo\n- GST/tax settings\n- Invoice templates\n- User roles & access\n\nGo to **Settings → Billing Settings**.`,
        route: '/settings',
    },
    {
        triggers: ['help', 'what can', 'guide', 'how to use', 'features'],
        response: (name) => `🤖 **I can answer live questions like:**\n\n- **"Today's sales?"** — shows actual value & boxes\n- **"Which item is more in the inventory?"** — highest stock item\n- **"Totally how many sales and purchase orders?"** — all orders summary\n- **"How many sales persons?"** — staff and sales team\n- **"Total stock value?"** — full inventory summary\n- **"Low stock items?"** — items running low\n\nJust type your question naturally! 🎯`,
    },
];

const DEFAULT_FAQ = {
    response: () => `🤔 I didn't understand that. Try asking:\n\n- **"Which item is more in the inventory?"**\n- **"Totally how many sales and purchase orders?"**\n- **"How many sales persons?"**\n- **"Today's sales?"**\n- **"Total stock value?"**\n- **"Low stock items?"**`,
};

function findFAQ(input) {
    const t = input.toLowerCase().trim();
    for (const item of FAQ_RESPONSES) {
        if (item.triggers.some(tr => t.includes(tr))) return item;
    }
    return DEFAULT_FAQ;
}

// ── Inline markdown renderer ───────────────────────────────────────────────
function renderText(text) {
    return text.split('\n').map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
            return <li key={i} style={{ marginLeft: '14px', marginBottom: '3px', fontSize: '0.83rem', lineHeight: 1.55 }}>{renderInline(line.slice(2))}</li>;
        }
        if (/^\d+\./.test(line)) {
            return <li key={i} style={{ marginLeft: '14px', marginBottom: '3px', fontSize: '0.83rem', listStyleType: 'decimal', lineHeight: 1.55 }}>{renderInline(line.replace(/^\d+\.\s*/, ''))}</li>;
        }
        if (line === '') return <div key={i} style={{ height: '6px' }} />;
        return <p key={i} style={{ margin: '2px 0', fontSize: '0.83rem', lineHeight: 1.55 }}>{renderInline(line)}</p>;
    });
}

function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AIChatbox() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', greeting: true }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [hasUnread, setHasUnread] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const firstName = user?.name?.split(' ')[0] || 'there';

    useEffect(() => {
        if (open) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            setTimeout(() => inputRef.current?.focus(), 150);
            setHasUnread(false);
        }
    }, [open, messages]);

    const sendMessage = async (text) => {
        const userText = (text || input).trim();
        if (!userText) return;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setIsTyping(true);

        try {
            const { intent, fetch: shouldFetch, params = {} } = detectIntent(userText);

            if (shouldFetch) {
                // Fetch real-time data from server
                const queryParams = new URLSearchParams({ intent, ...params }).toString();
                const { data } = await api.get(`/ai-chat/query?${queryParams}`);
                const responseText = buildLiveResponse(intent, data);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: responseText,
                    isLive: true,
                }]);
            } else {
                // FAQ / navigation response
                await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
                const faq = findFAQ(userText);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: faq.response(firstName),
                    route: faq.route,
                    isLive: false,
                }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `❌ **Error fetching data**\n\nCould not connect to the server. Please check your connection and try again.`,
                isLive: false,
            }]);
        }

        setIsTyping(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // Unique Bespoke Inventory AI Icon (Smart Cube with AI Quantum Core)
    const UniqueAIIcon = ({ size = 19, color = "#0b57d0" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.5L20.2 7.3V16.7L12 21.5L3.8 16.7V7.3L12 2.5Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 2.5L20.2 7.3L12 12.1L3.8 7.3L12 2.5Z" fill={color === "#ffffff" ? "rgba(255,255,255,0.25)" : "#d3e3fd"} opacity="0.8" />
            <path d="M12 12.1V21.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12.1" r="2.8" fill={color} />
            <circle cx="12" cy="12.1" r="1.2" fill={color === "#ffffff" ? "#0b57d0" : "#ffffff"} />
            <circle cx="12" cy="2.5" r="1.2" fill={color} />
            <circle cx="20.2" cy="7.3" r="1.2" fill={color} />
            <circle cx="3.8" cy="7.3" r="1.2" fill={color} />
        </svg>
    );

    const BotAvatar = () => (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eaf1fb', border: '1px solid #d3e3fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UniqueAIIcon size={16} color="#0b57d0" />
        </div>
    );

    return (
        <>
            {/* Unique Inventory AI Trigger Button */}
            <button
                id="ai-chatbox-toggle"
                onClick={() => setOpen(o => !o)}
                style={{
                    position: 'fixed', bottom: '88px', right: '20px', zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: '#ffffff',
                    color: '#1f1f1f',
                    border: '1px solid #dadce0',
                    borderRadius: '9999px',
                    padding: open ? '10px 14px' : '9px 18px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.82rem',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f4f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            >
                {open ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444746" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                ) : (
                    <>
                        <UniqueAIIcon size={18} color="#0b57d0" />
                        <span>AI Assistant</span>
                        {hasUnread && (
                            <span style={{ position: 'absolute', top: '5px', right: '5px', width: '8px', height: '8px', background: '#d93025', borderRadius: '50%', border: '2px solid white' }} />
                        )}
                    </>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: '150px', right: '20px',
                    width: '370px', maxWidth: 'calc(100vw - 32px)',
                    height: '520px', maxHeight: 'calc(100vh - 180px)',
                    background: 'white', borderRadius: '24px',
                    boxShadow: '0 8px 32px rgba(60,64,67,0.22)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', zIndex: 999,
                    animation: 'chatSlideIn 0.25s cubic-bezier(0.2, 0, 0, 1)',
                    border: '1px solid #dadce0',
                }}>
                    {/* Header */}
                    <div style={{
                        background: '#ffffff',
                        borderBottom: '1px solid #dadce0',
                        padding: '14px 18px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eaf1fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UniqueAIIcon size={20} color="#0b57d0" />
                                </div>
                                <span style={{ position: 'absolute', bottom: '0px', right: '0px', width: '9px', height: '9px', background: '#137333', borderRadius: '50%', border: '2px solid white' }} />
                            </div>
                            <div>
                                <p style={{ color: '#1f1f1f', fontWeight: 600, fontSize: '0.92rem', margin: 0, fontFamily: 'Inter, sans-serif' }}>InventoryPro AI</p>
                                <p style={{ color: '#747775', fontSize: '0.7rem', margin: 0, fontFamily: 'Inter, sans-serif' }}>Live workspace intelligence</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            style={{ background: 'transparent', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#747775', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f4f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                                {msg.role === 'assistant' && <BotAvatar />}
                                <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{
                                        background: msg.role === 'user' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : 'white',
                                        color: msg.role === 'user' ? 'white' : '#111827',
                                        padding: '10px 14px',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                        fontSize: '0.83rem', lineHeight: 1.55,
                                        fontFamily: 'Inter, sans-serif',
                                        border: msg.role === 'assistant' ? '1px solid #f0f0f0' : 'none',
                                    }}>
                                        {msg.greeting ? (
                                            <div style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
                                                <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 6px', color: '#111827', fontFamily: 'Outfit, sans-serif' }}>Hello, {firstName}!</p>
                                                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 10px' }}>Ask me live questions about your business:</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                                                    {["Today's sales?", "Which item is more in inventory?", "Total orders?", "How many sales persons?", "Total stock value?"].map((q, i) => (
                                                        <button key={i} onClick={() => sendMessage(q)} style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '20px', padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                                            {q}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>{renderText(msg.text)}</div>
                                        )}
                                    </div>
                                    {/* Live data badge */}
                                    {msg.isLive && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#10b981', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
                                            Live data · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                    {/* Navigate button for FAQ responses */}
                                    {msg.route && (
                                        <button onClick={() => { navigate(msg.route); setOpen(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                            Go there now
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <BotAvatar />
                                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', animation: `chatDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '12px', borderTop: '1px solid #dadce0', background: 'white', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <input
                            ref={inputRef}
                            id="ai-chat-input"
                            placeholder="Ask questions about inventory, orders, stock..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{ flex: 1, border: '1px solid #dadce0', borderRadius: '9999px', padding: '10px 16px', fontSize: '0.84rem', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#f8fafc', color: '#1f1f1f', transition: 'all 0.15s ease' }}
                            onFocus={e => { e.target.style.borderColor = '#0b57d0'; e.target.style.boxShadow = '0 0 0 3px rgba(11,87,208,0.15)'; e.target.style.background = 'white'; }}
                            onBlur={e => { e.target.style.borderColor = '#dadce0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                        />
                        <button
                            id="ai-chat-send"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isTyping}
                            style={{
                                width: '38px', height: '38px', borderRadius: '50%', border: 'none', flexShrink: 0,
                                background: (input.trim() && !isTyping) ? '#0b57d0' : '#f0f4f9',
                                color: (input.trim() && !isTyping) ? 'white' : '#747775',
                                cursor: (input.trim() && !isTyping) ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                boxShadow: (input.trim() && !isTyping) ? '0 1px 2px 0 rgba(60,64,67,0.3)' : 'none',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes chatSlideIn {
                    from { opacity:0; transform:translateY(20px) scale(0.95); }
                    to   { opacity:1; transform:translateY(0) scale(1); }
                }
                @keyframes chatDot {
                    0%,80%,100% { transform:scale(0.6); opacity:0.4; }
                    40%         { transform:scale(1); opacity:1; }
                }
                @keyframes livePulse {
                    0%,100% { opacity:1; transform:scale(1); }
                    50%     { opacity:0.5; transform:scale(1.3); }
                }
            `}</style>
        </>
    );
}
