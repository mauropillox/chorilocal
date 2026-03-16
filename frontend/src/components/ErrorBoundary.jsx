import { Component } from 'react';
import { logger } from '../utils/logger';

// Lazy-load Sentry for error boundary integration
let SentryModule = null;
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then(m => { SentryModule = m; }).catch(() => { });
}

/**
 * ErrorBoundary - Captura errores de renderizado en React
 * Evita que toda la app crashee si un componente falla
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // ALWAYS log to console in production for diagnostics
    console.error('[ErrorBoundary]', error?.message || error, {
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      localStorage_draft: (() => { try { return localStorage.getItem('pedido_draft')?.slice(0, 500); } catch { return null; } })(),
    });
    // Log error using production-safe logger
    logger.error('ErrorBoundary caught:', error);
    // Send to Sentry if available
    if (SentryModule && SentryModule.captureException) {
      SentryModule.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>Algo salió mal</h1>
            <p>Ocurrió un error inesperado. Por favor, intenta recargar la página.</p>

            {this.state.error && (
              <details className="error-details">
                <summary>Detalles del error</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem', maxHeight: '200px', overflow: 'auto' }}>{this.state.error.toString()}</pre>
                {import.meta.env.DEV && <pre>{this.state.errorInfo?.componentStack}</pre>}
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleReload} className="btn-primary">
                🔄 Recargar página
              </button>
              <button onClick={this.handleGoHome} className="btn-secondary">
                🏠 Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * TabErrorBoundary - Wrapper for specific tabs/sections
 * Use this to wrap individual components that might fail
 */
export function TabErrorBoundary({ children, tabName }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
