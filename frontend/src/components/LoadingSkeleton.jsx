import React from 'react';

/**
 * LoadingSkeleton - Reusable skeleton loader for better perceived performance
 * Use this instead of spinners for content that has predictable layout
 */

export function SkeletonBox({ width = '100%', height = '1rem', className = '', style = {} }) {
    return (
        <div
            className={`animate-pulse rounded ${className}`}
            style={{
                width,
                height,
                background: 'var(--color-bg-secondary)',
                ...style
            }}
            aria-hidden="true"
        />
    );
}

export function SkeletonText({ lines = 3, className = '' }) {
    return (
        <div className={`space-y-2 ${className}`} aria-hidden="true">
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBox
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="0.875rem"
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className = '' }) {
    return (
        <div
            className={`p-4 rounded-lg ${className}`}
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            aria-hidden="true"
        >
            <div className="flex items-center gap-3 mb-3">
                <SkeletonBox width="40px" height="40px" className="rounded-full" />
                <div className="flex-1">
                    <SkeletonBox width="60%" height="1rem" className="mb-2" />
                    <SkeletonBox width="40%" height="0.75rem" />
                </div>
            </div>
            <SkeletonText lines={2} />
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
    return (
        <div className={`space-y-2 ${className}`} aria-hidden="true" role="status" aria-label="Cargando datos">
            {/* Header */}
            <div className="flex gap-4 p-3 rounded" style={{ background: 'var(--color-bg-secondary)' }}>
                {Array.from({ length: cols }).map((_, i) => (
                    <SkeletonBox key={i} width={`${100 / cols}%`} height="1rem" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4 p-3 rounded" style={{ background: 'var(--color-bg)' }}>
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <SkeletonBox
                            key={colIndex}
                            width={`${100 / cols}%`}
                            height="0.875rem"
                            style={{ opacity: 1 - (rowIndex * 0.1) }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonPedido({ className = '' }) {
    return (
        <div
            className={`p-3 rounded-lg ${className}`}
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            aria-hidden="true"
        >
            <div className="flex items-center gap-2 mb-2">
                <SkeletonBox width="16px" height="16px" className="rounded" />
                <SkeletonBox width="120px" height="1rem" />
                <SkeletonBox width="80px" height="1.25rem" className="rounded-full" />
            </div>
            <SkeletonBox width="200px" height="0.75rem" className="mb-1" />
            <SkeletonBox width="150px" height="0.75rem" />
        </div>
    );
}

export function SkeletonHojaRuta() {
    return (
        <div className="p-4 space-y-4" aria-busy="true" aria-label="Cargando hoja de ruta">
            {/* Stats cards skeleton */}
            <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(i => (
                    <SkeletonBox key={i} height="60px" className="rounded-lg" />
                ))}
            </div>

            {/* Toolbar skeleton */}
            <div className="flex gap-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                <SkeletonBox width="150px" height="36px" className="rounded" />
                <SkeletonBox width="150px" height="36px" className="rounded" />
                <SkeletonBox width="100px" height="36px" className="rounded" />
            </div>

            {/* Pedidos skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <SkeletonPedido key={i} />
                ))}
            </div>
        </div>
    );
}

export default {
    SkeletonBox,
    SkeletonText,
    SkeletonCard,
    SkeletonTable,
    SkeletonPedido,
    SkeletonHojaRuta
};
