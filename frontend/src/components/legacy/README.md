# Legacy/Archived Components

This folder contains React components that are no longer used in the application but are kept for reference.

## Contents

| File | Archived Date | Reason |
|------|---------------|--------|
| `ProductosNew.jsx` | 2026-01-05 | Appears to be an experimental/alternative version of Productos. Not imported anywhere. The modularized version uses `productos/` subfolder instead. |

## Verification

```bash
# Checked for imports - none found
grep -r "ProductosNew" frontend/src/ --include="*.jsx" --include="*.js"
# Result: No matches
```

## Current Productos Architecture

The active Productos implementation uses:
- `Productos.jsx` (1249 lines) - Main component
- `productos/` subfolder with modularized helpers:
  - `useProductos.js` - State management hook
  - `useProductFilters.js` - Filtering logic
  - `ProductoList.jsx` - List rendering
  - `ProductoForm.jsx` - Add/edit form
  - `ProductoEditModal.jsx` - Edit modal
  - `ProductoStockManager.jsx` - Stock management
  - `index.js` - Exports
