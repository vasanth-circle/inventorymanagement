import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import FullScreenModal from '../components/FullScreenModal';

const api = (path, opts = {}) =>
    axios({ url: `/api${path}`, ...opts, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}`, ...opts.headers } });

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Ledger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [selectedPartyId, setSelectedPartyId] = useState(id || '');
    const [parties, setParties] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch both Customers and Vendors and combine them
    useEffect(() => {
        const fetchAllParties = async () => {
            try {
                const response = await api('/parties?limit=5000');
                const fetchedParties = (response.data.data?.parties || response.data.parties || []).map(p => ({
                    ...p,
                    displayName: p.companyName || p.name,
                    label: p.companyName || p.name
                })).sort((a, b) => a.displayName.localeCompare(b.displayName));
                
                setParties(fetchedParties);
            } catch (e) {
                toast.error(`Failed to fetch parties`);
            }
        };
        fetchAllParties();
        setData(null);
    }, []);

    const fetchLedger = useCallback(async () => {
        if (!selectedPartyId || parties.length === 0) {
            setData(null);
            return;
        }
        
        const selectedParty = parties.find(p => p._id === selectedPartyId);
        if (!selectedParty) return;

        try {
            setLoading(true);
            const partyType = selectedParty.partyType;
            
            const res = await api(`/ledgers/${selectedPartyId}?partyType=${partyType}`);
            const partyDetailsRes = await api(partyType === 'Customer' ? `/customers/${selectedPartyId}` : `/vendors/${selectedPartyId}`);
            
            setData({
                entries: res.data,
                party: partyDetailsRes.data.data,
                partyType
            });
        } catch {
            toast.error('Failed to fetch ledger');
        } finally {
            setLoading(false);
        }
    }, [selectedPartyId, parties]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    const handlePartyChange = (e) => {
        const val = e.target.value;
        setSelectedPartyId(val);
        if (val) navigate(`/ledger/${val}`);
        else navigate('/ledger');
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animate-in">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Unified Ledger</h1>
                    <p className="text-gray-500 mt-1">Manage accounts and financials for all parties.</p>
                </div>
            </div>

            <div className="glass-panel p-6 mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Party</label>
                <select 
                    value={selectedPartyId} 
                    onChange={handlePartyChange}
                    className="input-premium"
                >
                    <option value="">-- Choose Party --</option>
                    {parties.map(p => (
                        <option key={p._id + p.partyType} value={p._id}>
                            {p.label} {p.phone ? `- ${p.phone}` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                </div>
            ) : data && data.entries ? (
                <div className="glass-panel overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${data.partyType === 'Customer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {data.partyType}
                                </span>
                                <h2 className="text-xl font-bold text-gray-900">{data.party.companyName || data.party.name}</h2>
                            </div>
                            <p className="text-sm text-gray-500">
                                {data.party.phone} {data.party.email && `| ${data.party.email}`}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider">Current Balance</p>
                            <p className={`text-2xl font-bold ${data.party.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{fmt(Math.abs(data.party.currentBalance || 0))}
                                <span className="text-sm ml-1">{data.party.currentBalance >= 0 ? 'Dr' : 'Cr'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Ref</th>
                                    <th>Particulars</th>
                                    <th>Debit (₹)</th>
                                    <th>Credit (₹)</th>
                                    <th>Balance (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.entries.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-gray-500">No ledger entries found.</td>
                                    </tr>
                                ) : (
                                    data.entries.map((entry) => (
                                        <tr key={entry._id}>
                                            <td className="whitespace-nowrap">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                                            <td className="text-gray-500 text-xs font-mono">{entry.refNumber || '-'}</td>
                                            <td>
                                                <p className="font-medium text-gray-900 capitalize">{entry.type === 'opening' ? 'Opening Balance' : entry.description || entry.type}</p>
                                                {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
                                            </td>
                                            <td className="text-green-600 font-semibold">{entry.debit > 0 ? fmt(entry.debit) : '-'}</td>
                                            <td className="text-red-600 font-semibold">{entry.credit > 0 ? fmt(entry.credit) : '-'}</td>
                                            <td className="font-bold">
                                                {fmt(Math.abs(entry.balance))} {entry.balance > 0 ? 'Dr' : entry.balance < 0 ? 'Cr' : ''}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
            
        </div>
    );
};

export default Ledger;
