import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user, login } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/dashboard');
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await login(email, password);
        if (result.success) {
            toast.success(`Welcome back, ${result.user.name || 'User'}!`, { position: 'top-right', duration: 4000 });
            navigate('/dashboard');
        } else {
            toast.error(result.message);
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)',
            padding: '24px 16px', position: 'relative', overflow: 'hidden'
        }}>
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-120px', left: '-80px', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '40%', left: '20%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#fff" strokeWidth="1" fill="none"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="#fff" strokeWidth="1" fill="none"/>
                        </svg>
                    </div>
                    <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
                        InventoryPro
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                        Sign in to your workspace
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '36px 32px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label htmlFor="email" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>
                                Email Address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'white', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                                    outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
                                }}
                                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.07)'; }}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    style={{
                                        width: '100%', padding: '12px 44px 12px 16px', borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'white', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                                        outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.07)'; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                                        display: 'flex', alignItems: 'center', padding: '2px',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                >
                                    {showPassword ? <EyeSlashIcon style={{ width: '18px', height: '18px' }} /> : <EyeIcon style={{ width: '18px', height: '18px' }} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white', fontSize: '0.95rem', fontWeight: 700,
                                fontFamily: 'Outfit, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
                                boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.4)',
                                transition: 'all 0.2s', marginTop: '4px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}
                        >
                            {loading ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                    </svg>
                                    Signing in...
                                </>
                            ) : 'Sign In →'}
                        </button>
                    </form>

                    <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>Don't have an account?</span>
                        <Link to="/register" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                            Sign Up Free →
                        </Link>
                    </div>
                </div>

                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '24px', fontFamily: 'Inter, sans-serif' }}>
                    © 2026 InventoryPro · Secure & Encrypted
                </p>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                #email::placeholder, #password::placeholder { color: rgba(255,255,255,0.25); }
            `}</style>
        </div>
    );
};

export default Login;
