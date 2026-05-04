import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function PublicProductPage() {
    const { slug } = useParams();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [animating, setAnimating] = useState(false);
    const [slideDir, setSlideDir] = useState('right'); // 'right' | 'left'

    // ── Fetch Product ──────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/public/product/${slug}`);
                setProduct(data.data);
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [slug]);

    const images = product?.images || [];
    const totalImages = images.length;

    // ── Navigation ──────────────────────────────────────────────────────────────
    const goTo = useCallback((idx, dir = 'right') => {
        if (animating || totalImages <= 1) return;
        setSlideDir(dir);
        setAnimating(true);
        setTimeout(() => {
            setCurrentIndex(idx);
            setAnimating(false);
        }, 280);
    }, [animating, totalImages]);

    const prev = () => {
        const newIdx = (currentIndex - 1 + totalImages) % totalImages;
        goTo(newIdx, 'left');
    };

    const next = () => {
        const newIdx = (currentIndex + 1) % totalImages;
        goTo(newIdx, 'right');
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'Escape') setIsFullscreen(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [currentIndex, totalImages, animating]);

    // Touch swipe support
    const minSwipeDistance = 50;
    const onTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
    const onTouchEnd = () => {
        if (touchStart === null || touchEnd === null) return;
        const distance = touchStart - touchEnd;
        if (Math.abs(distance) > minSwipeDistance) {
            if (distance > 0) next(); else prev();
        }
        setTouchStart(null);
        setTouchEnd(null);
    };

    const serverBase = API_BASE.replace('/api', '');
    const getImageSrc = (url) => url?.startsWith('http') ? url : `${serverBase}${url}`;

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="text-center text-white space-y-4">
                    <div className="text-5xl animate-bounce">📦</div>
                    <p className="text-slate-400 animate-pulse">Loading product…</p>
                </div>
            </div>
        );
    }

    // ── Not Found ──────────────────────────────────────────────────────────────
    if (notFound || !product) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
                <div className="text-center text-white space-y-4 max-w-sm">
                    <div className="text-6xl">🔍</div>
                    <h1 className="text-2xl font-bold">Product Not Found</h1>
                    <p className="text-slate-400 text-sm">This product showcase doesn't exist or may have been removed.</p>
                </div>
            </div>
        );
    }

    const currentImage = images[currentIndex];

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; background: #0f1117; overflow-x: hidden; }
                .slide-left { animation: slideLeft 0.28s ease; }
                .slide-right { animation: slideRight 0.28s ease; }
                @keyframes slideLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slideRight { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
                .thumb-scroll::-webkit-scrollbar { height: 4px; }
                .thumb-scroll::-webkit-scrollbar-track { background: transparent; }
                .thumb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 999px; }
            `}</style>

            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f1117 0%, #1a1f2e 100%)', display: 'flex', flexDirection: 'column' }}>

                {/* ── Top Brand Bar ───────────────────────────────────────────── */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase' }}>
                        📦 Product Showcase
                    </div>
                </div>

                {/* ── Product Header ──────────────────────────────────────────── */}
                <div style={{ padding: '20px 16px 12px', textAlign: 'center', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
                    <h1 style={{ fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '8px' }}>
                        {product.name}
                    </h1>
                    {product.description && (
                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
                            {product.description}
                        </p>
                    )}
                </div>

                {/* ── Image Count Badge ───────────────────────────────────────── */}
                {totalImages > 0 && (
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '3px 12px', borderRadius: '999px' }}>
                            {currentIndex + 1} / {totalImages}
                        </span>
                    </div>
                )}

                {/* ── Main Image Area ──────────────────────────────────────────── */}
                {totalImages === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', gap: '12px' }}>
                        <div style={{ fontSize: '64px' }}>🖼️</div>
                        <p style={{ fontSize: '14px' }}>No images available yet.</p>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
                        {/* Carousel */}
                        <div
                            style={{ position: 'relative', maxWidth: '480px', width: '100%', margin: '0 auto', borderRadius: '20px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', aspectRatio: '4/3', cursor: totalImages > 1 ? 'pointer' : 'default' }}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onClick={() => setIsFullscreen(true)}
                        >
                            {currentImage && (
                                <img
                                    key={currentIndex}
                                    src={getImageSrc(currentImage.url)}
                                    alt={currentImage.title || product.name}
                                    className={animating ? (slideDir === 'right' ? 'slide-right' : 'slide-left') : ''}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', WebkitUserDrag: 'none' }}
                                    onError={e => { e.target.src = 'https://via.placeholder.com/480x360?text=Image'; }}
                                />
                            )}

                            {/* Prev / Next Buttons */}
                            {totalImages > 1 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); prev(); }}
                                        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                                    >‹</button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); next(); }}
                                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                                    >›</button>
                                </>
                            )}

                            {/* Tap to fullscreen hint */}
                            <div style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '999px', backdropFilter: 'blur(4px)' }}>
                                Tap to expand
                            </div>
                        </div>

                        {/* ── Image Title & Description ───────────────────────── */}
                        {(currentImage?.title || currentImage?.description) && (
                            <div style={{ maxWidth: '480px', width: '100%', margin: '14px auto 0', padding: '0 4px' }}>
                                {currentImage.title && (
                                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                        {currentImage.title}
                                    </h2>
                                )}
                                {currentImage.description && (
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                                        {currentImage.description}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Dot Indicators ──────────────────────────────────── */}
                        {totalImages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goTo(i, i > currentIndex ? 'right' : 'left')}
                                        style={{ width: i === currentIndex ? '20px' : '6px', height: '6px', borderRadius: '999px', background: i === currentIndex ? '#e11d48' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* ── Thumbnail Strip ──────────────────────────────────── */}
                        {totalImages > 1 && (
                            <div
                                className="thumb-scroll"
                                style={{ maxWidth: '480px', width: '100%', margin: '14px auto 0', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}
                            >
                                {images.map((img, i) => (
                                    <button
                                        key={img._id || i}
                                        onClick={() => goTo(i, i > currentIndex ? 'right' : 'left')}
                                        style={{ flexShrink: 0, width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', border: i === currentIndex ? '2px solid #e11d48' : '2px solid transparent', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'border-color 0.2s', padding: 0 }}
                                    >
                                        <img
                                            src={getImageSrc(img.url)}
                                            alt={img.title || `Image ${i + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            onError={e => { e.target.src = 'https://via.placeholder.com/64?text=?'; }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div style={{ padding: '20px 16px', textAlign: 'center', marginTop: 'auto' }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
                        Powered by InventoryPro
                    </p>
                </div>
            </div>

            {/* ── Fullscreen Overlay ──────────────────────────────────────────── */}
            {isFullscreen && currentImage && (
                <div
                    onClick={() => setIsFullscreen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={() => { onTouchEnd(); }}
                >
                    <img
                        src={getImageSrc(currentImage.url)}
                        alt={currentImage.title || product.name}
                        style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }}
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setIsFullscreen(false)}
                        style={{ position: 'fixed', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                    >✕</button>
                    {totalImages > 1 && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); prev(); }} style={{ position: 'fixed', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>‹</button>
                            <button onClick={(e) => { e.stopPropagation(); next(); }} style={{ position: 'fixed', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>›</button>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
