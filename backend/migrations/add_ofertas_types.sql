-- Migration: Add flexible offer types system
-- Date: 2026-01-21
-- Description: Adds tipo_oferta and reglas_json to support multiple offer types

-- Add new columns to ofertas table (SQLite doesn't support IF NOT EXISTS in ALTER)
-- Check first if columns exist, add them if they don't
PRAGMA table_info(ofertas);

-- Add columns one by one (will fail silently if already exists)
ALTER TABLE ofertas ADD COLUMN tipo TEXT DEFAULT 'porcentaje';
ALTER TABLE ofertas ADD COLUMN reglas_json TEXT;
ALTER TABLE ofertas ADD COLUMN compra_cantidad INTEGER;
ALTER TABLE ofertas ADD COLUMN paga_cantidad INTEGER;
ALTER TABLE ofertas ADD COLUMN regalo_producto_id INTEGER;
ALTER TABLE ofertas ADD COLUMN regalo_cantidad INTEGER DEFAULT 1;

-- Update existing offers to have tipo 'porcentaje'
UPDATE ofertas SET tipo = 'porcentaje' WHERE tipo IS NULL OR tipo = '';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ofertas_tipo ON ofertas(tipo);
CREATE INDEX IF NOT EXISTS idx_ofertas_activa ON ofertas(activa);
