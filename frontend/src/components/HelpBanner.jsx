import { useState } from 'react';

/**
 * Componente de ayuda colapsable con estilo dorado (similar a Ofertas)
 * @param {string} title - Título del banner (ej: "Guía de Productos")
 * @param {Array<{label: string, text: string}>} items - Lista de items de ayuda
 * @param {string} icon - Emoji/icono para el título
 */
export default function HelpBanner({ title, items, icon = '💡' }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className="help-banner"
            role="region"
            aria-label={`Ayuda: ${title}`}
        >
            {/* Header clickeable */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="help-banner-header"
                aria-expanded={isOpen}
                aria-controls="help-banner-content"
            >
                <span className="help-banner-title">
                    <span className="help-banner-icon" aria-hidden="true">{icon}</span>
                    {title}
                </span>
                <span
                    className={`help-banner-arrow ${isOpen ? 'help-banner-arrow-open' : ''}`}
                    aria-hidden="true"
                >
                    ▼
                </span>
            </button>

            {/* Contenido expandible */}
            {isOpen && (
                <div
                    id="help-banner-content"
                    className="help-banner-content"
                >
                    <div className="help-banner-items">
                        {items.map((item, idx) => (
                            <div key={idx} className="help-banner-item">
                                <strong className="help-banner-label">{item.label}:</strong>{' '}
                                <span className="help-banner-text">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
