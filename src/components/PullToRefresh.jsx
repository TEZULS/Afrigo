import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 160;
const MAX_PULL = 200;

export default function PullToRefresh({ children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Vérifie si un dialog est actuellement ouvert (Radix UI ajoute [data-state="open"] sur les overlays)
  const isDialogOpen = () => !!document.querySelector('[role="dialog"]');

  const handleTouchStart = useCallback((e) => {
    if (isDialogOpen()) return;
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (isDialogOpen()) return;
    if (!isDraggingRef.current || startYRef.current === null) return;
    if (window.scrollY > 0) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      const distance = Math.min(delta * 0.5, MAX_PULL);
      setPullDistance(distance);
      if (distance > 5) {
        e.preventDefault();
      }
    }
    
    // Empêcher le surdefilement avec overscroll-behavior
    if (delta > 0 && window.scrollY === 0) {
      const body = document.body;
      body.style.overscrollBehavior = 'contain';
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startYRef.current = null;
    
    // Réinitialiser overscroll-behavior
    document.body.style.overscrollBehavior = 'auto';

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(60);
      
      // Simulate refresh duration
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance]);

  useEffect(() => {
    const el = document.documentElement;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const isReady = pullDistance >= PULL_THRESHOLD;

  return (
    <>
      {/* Indicateur visuel amélioré */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${pullDistance}px`,
          overflow: 'hidden',
          background: isDraggingRef.current 
            ? 'rgba(255,140,0,0.02)' 
            : 'transparent',
          transition: isDraggingRef.current ? 'none' : 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        {(pullDistance > 10 || isRefreshing) && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF8C00, #FFB347)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 16px rgba(255,140,0,${0.3 + progress * 0.3})`,
              transform: `scale(${0.4 + progress * 0.6}) translateY(${pullDistance > 0 ? -10 : 0}px)`,
              opacity: 0.4 + progress * 0.6,
              transition: isDraggingRef.current ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <RefreshCw
              className="text-white"
              style={{
                width: 24,
                height: 24,
                transform: `rotate(${isRefreshing ? 0 : progress * 360}deg)`,
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease',
              }}
            />
          </div>
        )}
        
        {/* Texte de statut */}
        {pullDistance > 30 && !isRefreshing && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              fontSize: '12px',
              color: '#FF8C00',
              fontWeight: '600',
              opacity: Math.min(pullDistance / 80, 1),
              transition: 'opacity 0.2s ease',
            }}
          >
            {isReady ? 'Relâchez pour rafraîchir' : 'Tirez pour rafraîchir'}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        * {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
        }
      `}</style>

      {children}
    </>
  );
}