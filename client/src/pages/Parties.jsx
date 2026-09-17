import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { BookOpenIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';

const Parties = () => {
    const navigate = useNavigate();
    const [parties, setParties] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalParties, setTotalParties] = useState(0);
    const [balances, setBalances] = useState({}); // { partyId: balance }
    const [lockedStatuses, setLockedStatuses] = useState({}); // { partyId: boolean }
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingParty, setEditingParty] = useState(null);
    const { user } = useContext(AuthContext);

    // Unlock Feature State
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [unlockPartyData, setUnlockPartyData] = useState(null);
    const [unlockComment, setUnlockComment] = useState('');
    const [unlockDays, setUnlockDays] = useState(1);

    const [activeTab, setActiveTab] = useState('all');
    const [lockedParties, setLockedParties] = useState([]);
    const [loadingLocked, setLoadingLocked] = useState(false);

    // New-site inline form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteAddress, setNewSiteAddress] = useState('');
    const [showAddSite, setShowAddSite] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        phone2: '',
        companyName: '',
        gstin: '',
        openingBalance: '',
        billingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
        sites: [],
    });

    const API_URL = '/parties';

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchParties(currentPage, searchQuery, itemsPerPage);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, currentPage, itemsPerPage]);

    const fetchParties = async (page = 1, search = '', limit = 10) => {
        try {
            setLoading(true);
            const res = await api.get(API_URL, { params: { page, limit, search } });
            const list = res.data.data.parties;
            setParties(list);
            setTotalPages(res.data.data.totalPages || 1);
            setTotalParties(res.data.data.totalParties || 0);
            
            // Fetch balances in parallel (non-blocking, silent on individual failures)
            const balanceMap = {};
            const lockStatusMap = {};
            await Promise.allSettled(
                list.map(async (c) => {
                    try {
                        const r = await api.get(`${API_URL}/${c._id}/balance`);
                        balanceMap[c._id] = r.data.data.balance;
                        lockStatusMap[c._id] = r.data.data.isLocked || false;
                    } catch { 
                        balanceMap[c._id] = c.currentBalance || 0; 
                        lockStatusMap[c._id] = false;
                    }
                })
            );
            setBalances(balanceMap);
            setLockedStatuses(lockStatusMap);
        } catch (error) {
            toast.error('Failed to fetch parties');
        } finally {
            setLoading(false);
        }
    };

    const fetchLockedParties = async () => {
        try {
            setLoadingLocked(true);
            const res = await api.get('/parties/reports/locked');
            setLockedParties(res.data.data);
        } catch (error) {
            toast.error('Failed to fetch locked parties');
        } finally {
            setLoadingLocked(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'locked') {
            fetchLockedParties();
        }
    }, [activeTab]);


    const handleOpenModal = (party = null) => {
        setNewSiteName('');
        setNewSiteAddress('');
        setShowAddSite(false);
        if (party) {
            setEditingParty(party);
            setFormData({
                name: party.name,
                email: party.email || '',
                phone: party.phone || '',
                phone2: party.phone2 || '',
                companyName: party.companyName || '',
                gstin: party.gstin || '',
                openingBalance: party.openingBalance || 0,
                billingAddress: party.address?.billing || { street: '', city: '', state: '', zipCode: '', country: '' },
                sites: (party.sites || []).filter(s => s.isActive !== false),
            });
        } else {
            setEditingParty(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                phone2: '',
                companyName: '',
                gstin: '',
                openingBalance: '',
                billingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
                sites: [],
            });
        }
        setIsModalOpen(true);
    };

    // Add a site to the local list (not yet saved to DB)
    const handleAddSite = () => {
        if (!newSiteName.trim()) return toast.error('Site name is required');
        setFormData(prev => ({
            ...prev,
            sites: [...prev.sites, { name: newSiteName.trim(), address: newSiteAddress.trim(), isActive: true }]
        }));
        setNewSiteName('');
        setNewSiteAddress('');
        setShowAddSite(false);
    };

    // Remove a site from the local list
    const handleRemoveSite = (idx) => {
        setFormData(prev => ({
            ...prev,
            sites: prev.sites.filter((_, i) => i !== idx)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // 10-digit validation for phone
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(formData.phone)) {
            return toast.error('Primary phone must be a 10-digit number');
        }
        if (formData.phone2 && !phoneRegex.test(formData.phone2)) {
            return toast.error('Secondary phone must be a 10-digit number');
        }
        try {
            const data = {
                ...formData,
                address: { billing: formData.billingAddress }
            };

            if (editingParty) {
                await api.put(`${API_URL}/${editingParty._id}`, data);
                toast.success('Party updated successfully');
            } else {
                await api.post(API_URL, data);
                toast.success('Party added successfully');
            }
            setIsModalOpen(false);
            fetchParties();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving party');
        }
    };

    const handleUnlockSubmit = async (e) => {
        e.preventDefault();
        if (!unlockComment.trim()) return toast.error('Unlock comment is required');
        
        try {
            await api.post(`${API_URL}/${unlockPartyData._id}/unlock`, { unlockComment, days: unlockDays });
            toast.success(`${unlockPartyData.companyName || unlockPartyData.name} has been unlocked for ${unlockDays} days.`);
            setUnlockModalOpen(false);
            setUnlockComment('');
            setUnlockDays(1);
            if (activeTab === 'locked') {
                fetchLockedParties();
            }
            fetchParties(currentPage, searchQuery, itemsPerPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unlock party');
        }
    };

    const handleDelete = async (id, balance) => {
        if (balance !== 0) {
            return toast.error('Cannot delete party with an outstanding balance');
        }
        if (window.confirm('Are you sure you want to delete this party? This action cannot be undone.')) {
            try {
                await api.delete(`${API_URL}/${id}`);
                toast.success('Party deleted successfully');
                fetchParties(currentPage, searchQuery, itemsPerPage);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to delete party');
            }
        }
    };


    const filteredLockedParties = lockedParties.filter(c =>
        !searchQuery ||
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery))
    );

    // Avatar color by name initial
    const avatarColor = (name = '') => {
        const colors = ['avatar-blue','avatar-purple','avatar-green','avatar-orange','avatar-red','avatar-gray'];
        return colors[(name.charCodeAt(0) || 0) % colors.length];
    };

    const totalDr = Object.values(balances).filter(b => b > 0).reduce((s, b) => s + b, 0);
    const totalCr = Object.values(balances).filter(b => b < 0).reduce((s, b) => s + Math.abs(b), 0);

    return (
        <div className="animate-in space-y-5">

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Parties</h1>
                    <p className="page-subtitle">Manage customers, vendors and their ledger balances</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>+ Add Party</button>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{totalParties}</div>
                    <div className="stat-card-label">Total Parties</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#c2410c'}}>{'Rs.'}{(totalDr/1000).toFixed(1)}k</div>
                    <div className="stat-card-label">Total Receivable</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#059669'}}>{'Rs.'}{(totalCr/1000).toFixed(1)}k</div>
                    <div className="stat-card-label">Total Payable</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#dc2626'}}>{lockedParties.length}</div>
                    <div className="stat-card-label">Locked Parties</div>
                </div>
            </div>

            {/* Tab Bar + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="tab-bar">
                    <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                        All Parties
                    </button>
                    <button className={`tab-btn ${activeTab === 'locked' ? 'active' : ''}`} onClick={() => { setActiveTab('locked'); fetchLockedParties(); }}>
                        Locked
                        {lockedParties.length > 0 && <span className="badge badge-danger" style={{marginLeft:'4px'}}>{lockedParties.length}</span>}
                    </button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'8px 12px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)',minWidth:'260px'}}>
                    <span style={{color:'#94a3b8',fontSize:'14px'}}>search</span>
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{flex:1,border:'none',outline:'none',fontSize:'14px',background:'transparent',color:'#0f172a'}}
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:'18px',lineHeight:1}}>x</button>}
                </div>
            </div>

            {/* All Parties */}
            {activeTab === 'all' && (
                loading ? (
                    <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                        <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                    </div>
                ) : parties.length === 0 ? (
                    <div className="table-wrapper">
                        <EmptyState icon="person" title="No parties yet" description="Add your first customer or vendor to get started." action={<button className="btn-primary" onClick={() => handleOpenModal()}>+ Add Party</button>} />
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th>Party</th>
                                    <th>Contact</th>
                                    <th>GSTIN</th>
                                    <th>Sites</th>
                                    <th style={{textAlign:'right'}}>Balance</th>
                                    <th style={{textAlign:'right'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parties.map((party) => {
                                    const bal = balances[party._id] ?? party.currentBalance ?? 0;
                                    const activeSites = (party.sites || []).filter(s => s.isActive !== false);
                                    const displayName = party.companyName || party.name;
                                    const initials = displayName.substring(0,2).toUpperCase();
                                    const isLocked = lockedStatuses[party._id];
                                    const isUnlocked = party.unlockedUntil && new Date(party.unlockedUntil) > new Date();
                                    return (
                                        <tr key={party._id} style={{cursor:'pointer'}} onClick={() => navigate(`/party-ledger/${party._id}`)}>
                                            <td>
                                                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                                    <div className={`avatar ${avatarColor(displayName)}`}>{initials}</div>
                                                    <div>
                                                        <div style={{fontWeight:'600',color:'#0f172a',display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                                                            {displayName}
                                                            {isUnlocked ? <span className="badge badge-purple">Unlocked</span>
                                                                : isLocked ? <span className="badge badge-danger">Locked</span> : null}
                                                        </div>
                                                        {party.companyName && <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'2px'}}>{party.name}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{fontWeight:'500',color:'#374151'}}>{party.phone}</div>
                                                {party.phone2 && <div style={{fontSize:'12px',color:'#94a3b8'}}>{party.phone2}</div>}
                                                {party.email && <div style={{fontSize:'12px',color:'#94a3b8'}}>{party.email}</div>}
                                            </td>
                                            <td>
                                                {party.gstin
                                                    ? <span style={{fontFamily:'monospace',fontSize:'12px',background:'#f8fafc',border:'1px solid #e2e8f0',padding:'3px 8px',borderRadius:'6px',color:'#475569'}}>{party.gstin}</span>
                                                    : <span style={{color:'#cbd5e1'}}>-</span>}
                                            </td>
                                            <td>
                                                {activeSites.length > 0 ? (
                                                    <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                                                        {activeSites.slice(0,2).map((s,i) => <span key={i} className="badge badge-primary">{s.name}</span>)}
                                                        {activeSites.length > 2 && <span className="badge badge-gray">+{activeSites.length-2}</span>}
                                                    </div>
                                                ) : <span style={{color:'#cbd5e1',fontSize:'12px'}}>-</span>}
                                            </td>
                                            <td style={{textAlign:'right'}}>
                                                {bal > 0 ? <span className="balance-dr">Rs.{Math.abs(bal).toLocaleString('en-IN')} Dr</span>
                                                    : bal < 0 ? <span className="balance-cr">Rs.{Math.abs(bal).toLocaleString('en-IN')} Cr</span>
                                                        : <span className="balance-nil">-</span>}
                                            </td>
                                            <td style={{textAlign:'right'}} onClick={(e) => e.stopPropagation()}>
                                                <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'2px'}}>
                                                    <button className="btn-icon ledger" onClick={() => navigate(`/ledger/${party._id}`)} title="View Ledger">
                                                        <BookOpenIcon style={{width:'16px',height:'16px'}} />
                                                    </button>
                                                    <button className="btn-icon edit" onClick={() => handleOpenModal(party)} title="Edit">
                                                        <PencilSquareIcon style={{width:'16px',height:'16px'}} />
                                                    </button>
                                                    <button
                                                        className="btn-icon delete"
                                                        onClick={() => handleDelete(party._id, bal)}
                                                        title={bal !== 0 ? "Cannot delete with outstanding balance" : "Delete"}
                                                        disabled={bal !== 0}
                                                        style={{opacity: bal !== 0 ? 0.3 : 1, cursor: bal !== 0 ? 'not-allowed' : 'pointer'}}
                                                    >
                                                        <TrashIcon style={{width:'16px',height:'16px'}} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {totalParties > 0 && (
                            <div className="pagination">
                                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                    <span className="pagination-info">
                                        Showing {(currentPage-1)*itemsPerPage+1}--{Math.min(currentPage*itemsPerPage,totalParties)} of {totalParties}
                                    </span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        style={{fontSize:'12px',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'4px 8px',outline:'none'}}
                                    >
                                        {[10,20,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
                                    </select>
                                </div>
                                <div className="pagination-controls">
                                    <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage===1}>first</button>
                                    <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}>prev</button>
                                    <span className="page-btn active">{currentPage} / {totalPages}</span>
                                    <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>next</button>
                                    <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages}>last</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}

            {/* Locked Parties Tab */}
            {activeTab === 'locked' && (
                loadingLocked ? (
                    <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                        <div style={{width:'40px',height:'40px',border:'3px solid #fee2e2',borderTop:'3px solid #dc2626',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                    </div>
                ) : filteredLockedParties.length === 0 ? (
                    <div className="table-wrapper">
                        <EmptyState icon="check" title="No Locked Parties" description="All parties are within their credit limits and payment terms." />
                    </div>
                ) : (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'16px'}}>
                        {filteredLockedParties.map(party => (
                            <div key={party._id} style={{background:'white',borderRadius:'16px',border:'1px solid #fecaca',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                                <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px'}}>
                                    <div className="avatar avatar-red">{(party.companyName||party.name).substring(0,2).toUpperCase()}</div>
                                    <div>
                                        <span className="badge badge-danger" style={{marginBottom:'4px',display:'block',width:'fit-content'}}>Billing Locked</span>
                                        <div style={{fontWeight:'700',fontSize:'14px',color:'#0f172a'}}>{party.companyName||party.name}</div>
                                        <div style={{fontSize:'12px',color:'#94a3b8'}}>{party.phone}</div>
                                    </div>
                                </div>
                                <div style={{background:'#fef2f2',borderRadius:'12px',padding:'12px',marginBottom:'14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                                    <div>
                                        <div style={{fontSize:'10px',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'4px'}}>Balance</div>
                                        <div style={{fontWeight:'700',color:'#dc2626',fontSize:'14px'}}>Rs.{party.currentBalance?.toLocaleString('en-IN')||0} Dr</div>
                                        {party.creditLimit > 0 && <div style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>Limit: Rs.{party.creditLimit.toLocaleString('en-IN')}</div>}
                                    </div>
                                    <div>
                                        <div style={{fontSize:'10px',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'4px'}}>Oldest Pending</div>
                                        <div style={{fontWeight:'700',color:'#0f172a',fontSize:'14px'}}>{party.oldestPendingDays} Days</div>
                                        {party.creditDays > 0 && <div style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>Limit: {party.creditDays} Days</div>}
                                    </div>
                                </div>
                                <div style={{display:'flex',gap:'8px'}}>
                                    <button onClick={() => navigate(`/party-ledger/${party._id}`)} className="btn-secondary" style={{flex:1,padding:'8px',fontSize:'12px',justifyContent:'center'}}>View Ledger</button>
                                    <button onClick={() => { setUnlockPartyData(party); setUnlockModalOpen(true); }} style={{flex:1,padding:'8px',fontSize:'12px',fontWeight:'600',background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:'10px',cursor:'pointer'}}>Unlock</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Add/Edit Party Drawer */}
            <Drawer
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingParty ? 'Edit Party' : 'Add New Party'}
                subtitle={editingParty ? `Editing: ${editingParty.companyName || editingParty.name}` : 'Fill in the details below'}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" form="party-form" className="btn-primary">{editingParty ? 'Update Party' : 'Add Party'}</button>
                    </>
                }
            >
                <form id="party-form" onSubmit={handleSubmit}>

                    <FormSection icon="person" title="Basic Information" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Display Name" required>
                                <input required type="text" value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="e.g. Ravi Kumar" />
                            </FormField>
                            <FormField label="Company Name">
                                <input type="text" value={formData.companyName}
                                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                    placeholder="e.g. Ravi Constructions" />
                            </FormField>
                            <FormField label="Primary Phone" required>
                                <input required type="tel" maxLength={10} value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'').slice(0,10)})}
                                    placeholder="10-digit number" />
                            </FormField>
                            <FormField label="Alternate Phone">
                                <input type="tel" maxLength={10} value={formData.phone2}
                                    onChange={(e) => setFormData({...formData, phone2: e.target.value.replace(/\D/g,'').slice(0,10)})}
                                    placeholder="Optional" />
                            </FormField>
                            <FormField label="Email" className="form-full">
                                <input type="email" value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    placeholder="email@example.com" />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="money" title="GST and Finance" color="#f0fdf4">
                        <div className="form-grid-2">
                            <FormField label="GSTIN">
                                <input type="text" value={formData.gstin} maxLength={15}
                                    onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                                    placeholder="22AAAAA0000A1Z5" />
                            </FormField>
                            <FormField label="Opening Balance (Rs.)" hint="Positive = Party owes you. Negative = Advance paid.">
                                <input type="number" step="0.01" value={formData.openingBalance}
                                    onChange={(e) => setFormData({...formData, openingBalance: e.target.value==='' ? '' : parseFloat(e.target.value)})}
                                    placeholder="e.g. 5000 or -1000" />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="house" title="Billing Address" color="#fef9c3">
                        <div className="form-grid-2">
                            <FormField label="Street" className="form-full">
                                <input type="text" value={formData.billingAddress.street}
                                    onChange={(e) => setFormData({...formData, billingAddress:{...formData.billingAddress, street: e.target.value}})}
                                    placeholder="Door no., Street name" />
                            </FormField>
                            <FormField label="City">
                                <input type="text" value={formData.billingAddress.city}
                                    onChange={(e) => setFormData({...formData, billingAddress:{...formData.billingAddress, city: e.target.value}})}
                                    placeholder="City" />
                            </FormField>
                            <FormField label="State">
                                <input type="text" value={formData.billingAddress.state}
                                    onChange={(e) => setFormData({...formData, billingAddress:{...formData.billingAddress, state: e.target.value}})}
                                    placeholder="State" />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="build" title="Project Sites" color="#faf5ff">
                        {formData.sites.length > 0 && (
                            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
                                {formData.sites.map((site,idx) => (
                                    <div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #dbeafe',borderRadius:'10px',padding:'10px 14px'}}>
                                        <div>
                                            <div style={{fontWeight:'700',fontSize:'13px',color:'#1e40af'}}>{site.name}</div>
                                            {site.address && <div style={{fontSize:'11px',color:'#3b82f6',marginTop:'2px'}}>{site.address}</div>}
                                        </div>
                                        <button type="button" onClick={() => handleRemoveSite(idx)} style={{background:'none',border:'none',color:'#ef4444',fontSize:'18px',cursor:'pointer',lineHeight:1}}>x</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!showAddSite && (
                            <button type="button" onClick={() => setShowAddSite(true)} style={{background:'none',border:'none',color:'#2563eb',fontSize:'13px',cursor:'pointer',padding:'0',fontWeight:'600'}}>+ Add Site</button>
                        )}
                        {showAddSite && (
                            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
                                <FormField label="Site Name" required>
                                    <input type="text" autoFocus value={newSiteName}
                                        onChange={e => setNewSiteName(e.target.value)}
                                        placeholder="e.g. Phase 1 Building"
                                        onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();handleAddSite();} }} />
                                </FormField>
                                <FormField label="Site Address">
                                    <input type="text" value={newSiteAddress}
                                        onChange={e => setNewSiteAddress(e.target.value)}
                                        placeholder="e.g. 12 Raja St, Chennai"
                                        onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();handleAddSite();} }} />
                                </FormField>
                                <div style={{display:'flex',gap:'8px'}}>
                                    <button type="button" onClick={handleAddSite} className="btn-primary" style={{padding:'8px 16px',fontSize:'13px'}}>Save Site</button>
                                    <button type="button" onClick={() => {setShowAddSite(false);setNewSiteName('');setNewSiteAddress('');}} className="btn-secondary" style={{padding:'8px 16px',fontSize:'13px'}}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </FormSection>

                    {editingParty && lockedStatuses[editingParty._id] && (
                        <div style={{display:'flex',alignItems:'center',gap:'12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'12px',padding:'14px',marginTop:'8px'}}>
                            <span style={{fontSize:'20px'}}>warning</span>
                            <div style={{flex:1}}>
                                <div style={{fontWeight:'700',fontSize:'13px',color:'#92400e'}}>Party is Credit Locked</div>
                                <div style={{fontSize:'12px',color:'#b45309',marginTop:'2px'}}>Temporarily allow billing for this party.</div>
                            </div>
                            <button type="button"
                                onClick={() => {setUnlockPartyData(editingParty);setUnlockModalOpen(true);setIsModalOpen(false);}}
                                style={{padding:'8px 14px',background:'#f59e0b',border:'none',borderRadius:'8px',color:'white',fontWeight:'700',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>
                                Unlock
                            </button>
                        </div>
                    )}
                </form>
            </Drawer>

            {/* Unlock Party Drawer */}
            <Drawer
                open={unlockModalOpen && !!unlockPartyData}
                onClose={() => setUnlockModalOpen(false)}
                size="sm"
                title="Unlock Party"
                subtitle={unlockPartyData ? `Temporarily unlock ${unlockPartyData.companyName || unlockPartyData.name}` : ''}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setUnlockModalOpen(false)}>Cancel</button>
                        <button type="submit" form="unlock-form" className="btn-primary" style={{background:'linear-gradient(135deg,#9333ea,#7c3aed)'}}>Unlock Account</button>
                    </>
                }
            >
                <form id="unlock-form" onSubmit={handleUnlockSubmit} style={{display:'flex',flexDirection:'column',gap:'18px'}}>
                    {unlockPartyData && (
                        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'#f8fafc',borderRadius:'12px',border:'1px solid #f1f5f9'}}>
                            <div className="avatar avatar-red">{(unlockPartyData.companyName||unlockPartyData.name).substring(0,2).toUpperCase()}</div>
                            <div>
                                <div style={{fontWeight:'700',fontSize:'14px',color:'#0f172a'}}>{unlockPartyData.companyName||unlockPartyData.name}</div>
                                <div style={{fontSize:'12px',color:'#94a3b8'}}>Currently locked due to pending balance</div>
                            </div>
                        </div>
                    )}
                    <FormField label="Days to Unlock" required hint="Party will be re-locked automatically after this period.">
                        <input type="number" min="1" max="365" required value={unlockDays}
                            onChange={(e) => setUnlockDays(Number(e.target.value))} placeholder="e.g. 3" />
                    </FormField>
                    <FormField label="Reason for Unlock" required>
                        <textarea required rows="3" value={unlockComment}
                            onChange={(e) => setUnlockComment(e.target.value)}
                            placeholder="e.g. Payment expected tomorrow, Manager approved."
                            style={{resize:'vertical'}} />
                    </FormField>
                </form>
            </Drawer>

        </div>
    );
};

export default Parties;
