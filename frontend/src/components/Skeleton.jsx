/**
 * Skeleton loading components for better perceived performance
 */

export function SkeletonText({ width = '100%', className = '' }) {
  return <div className={`skeleton skeleton-text ${className}`} style={{ width }} />;
}

export function SkeletonTitle({ width = '60%', className = '' }) {
  return <div className={`skeleton skeleton-title ${className}`} style={{ width }} />;
}

export function SkeletonImage({ size = 72, className = '' }) {
  return (
    <div 
      className={`skeleton skeleton-image ${className}`} 
      style={{ width: size, height: size }} 
    />
  );
}

export function SkeletonButton({ width = 120, className = '' }) {
  return (
    <div 
      className={`skeleton skeleton-button ${className}`} 
      style={{ width }} 
    />
  );
}

export function SkeletonProductRow() {
  return (
    <div className="skeleton-product-row">
      <SkeletonImage size={72} />
      <div style={{ flex: 1 }}>
        <SkeletonText width="70%" />
        <SkeletonText width="40%" />
      </div>
      <SkeletonButton width={80} />
    </div>
  );
}

export function SkeletonTableRow({ columns = 4 }) {
  return (
    <div className="skeleton-table-row">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="skeleton skeleton-table-cell" />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="skeleton-card">
      <SkeletonTitle />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText key={i} width={`${90 - i * 15}%`} />
      ))}
    </div>
  );
}

// Preset loaders for common views
export function ProductListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductRow key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div>
      <div className="skeleton-table-row" style={{ background: 'var(--color-bg-secondary)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton skeleton-table-cell" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      {/* Charts area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}

export default {
  Text: SkeletonText,
  Title: SkeletonTitle,
  Image: SkeletonImage,
  Button: SkeletonButton,
  ProductRow: SkeletonProductRow,
  TableRow: SkeletonTableRow,
  Card: SkeletonCard,
  ProductList: ProductListSkeleton,
  Table: TableSkeleton,
  Dashboard: DashboardSkeleton
};
