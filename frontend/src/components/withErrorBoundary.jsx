import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * withErrorBoundary - HOC to wrap any component with error boundary
 * Provides isolated error handling per component
 * 
 * Usage:
 *   const SafeComponent = withErrorBoundary(MyComponent, 'MyComponent');
 */
export function withErrorBoundary(WrappedComponent, componentName = 'Component') {
    return function WrappedWithErrorBoundary(props) {
        return (
            <ErrorBoundary fallbackMessage={`Error en ${componentName}`}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

/**
 * ComponentErrorBoundary - Inline error boundary for specific sections
 * Use when you want to catch errors in a specific part of a component
 * 
 * Usage:
 *   <ComponentErrorBoundary name="Tabla de productos">
 *     <ProductTable />
 *   </ComponentErrorBoundary>
 */
export function ComponentErrorBoundary({ children, name = 'componente', fallback = null }) {
    return (
        <ErrorBoundary
            fallbackMessage={`Error cargando ${name}`}
            fallback={fallback}
        >
            {children}
        </ErrorBoundary>
    );
}

export default withErrorBoundary;
