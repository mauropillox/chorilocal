# Big O Performance Review

## Executive Summary

This review covers the **Chorizaurio** full-stack order management application (FastAPI + React/Vite). The codebase is generally well-structured with several intentional performance optimizations already in place (batch-loaded pedido productos to avoid N+1, `useMemo`/`useCallback` in React, `Map`-based client lookups in HojaRuta, React Query caching, pagination support).

**Biggest risks identified:**
1. **Backend `_table_columns()` called repeatedly per request** — multiple PRAGMA/schema queries per single DB operation, with no caching. This is the most impactful systemic issue.
2. **Frontend `HistorialPedidos.coincideTexto` uses `clientes.find()` (O(n)) inside a filter over all pedidos** — an O(P×C) pattern that should use a Map.
3. **Backend `calcZoneProgress` runs 4 separate `.filter()` passes** over the same array — minor but a clear O(4n) that could be O(n).
4. **Frontend `ProductoSelector.totalFiltrados` duplicates the same filter logic** already computed in `productosFiltrados`.
5. **Backend `reportes/comparativo` calls `get_periodo_stats()` in a loop** of 6 iterations — 6 separate DB queries that could be a single query.
6. **Frontend `useProductFilters` computes `stockBajoCount` and `productosStockBajo` as two separate `.filter()` passes** on the same data with the same predicate.
7. **Backend `bulkAsignarRepartidor` in HojaRuta frontend sends N individual API calls** instead of a batch endpoint.

**Areas that are probably fine:**
- React Query + Zustand hybrid caching is well-implemented with staleTime and initialData hydration.
- `get_pedidos()` already uses batch loading for detalles — no N+1.
- `useMemo` and `useCallback` are used correctly and consistently in most components.
- HojaRuta already uses a `clientesMap` (Map-based O(1) lookup) for client data.
- Data sizes are small-to-medium (butcher shop CRM, likely <10K records per entity).

**Overall confidence:** High for the patterns identified. The practical impact of most findings is low at current scale but some (like `_table_columns` and the `clientes.find` pattern) could become noticeable as data grows.

---

## Analysis Scope

- **Backend files analyzed:** `db.py` (full, ~3700 lines), `routers/pedidos.py`, `routers/reportes.py`, `routers/estadisticas.py`, `routers/hoja_ruta.py`, `routers/ofertas.py`, `routers/listas_precios.py`, `routers/clientes.py`, `routers/productos.py`, `pdf_utils.py`, `dashboard.py`, `models.py`
- **Frontend files analyzed:** `components/HojaRuta.jsx`, `components/HistorialPedidos.jsx`, `components/Dashboard.jsx`, `components/Pedidos.jsx`, `components/pedidos/ProductoSelector.jsx`, `components/pedidos/ClienteSelector.jsx`, `hooks/useHybridQuery.js`, `hooks/useMutations.js`, `store/index.js`, `components/productos/useProductFilters.js`
- **Findings are mixed** — both frontend and backend.
- **Assumptions:** SQLite is the primary database (no indexes were inspected, but standard SQLite behavior assumed). Data volumes are modest (hundreds to low thousands of records per entity). This is a small business CRM, not a high-traffic SaaS.

---

## Findings

### Finding 1: Backend `_table_columns()` called repeatedly without caching

- **File:** `backend/db.py:385-399` and ~30+ call sites throughout `db.py`
- **Function/Method:** `_table_columns()`, called from `add_pedido`, `get_pedidos`, `get_productos`, `update_producto`, etc.
- **Layer:** Backend
- **Category:** Repeated DB metadata queries (PRAGMA / information_schema)
- **Impact:** Medium
- **Current Complexity:** O(k) per call where k = number of columns, but called ~3-5 times per request across different tables
- **Potential Complexity After Change:** O(1) amortized with caching
- **Why it is inefficient:** Every single database operation calls `PRAGMA table_info(table)` or `information_schema.columns` query to discover column names. In `get_pedidos()` alone, `_table_columns` is called 4 times (on pedidos, detalles_pedido, productos, and detalles_pedido again via helpers). In `add_pedido()`, it's called 3 times. These are metadata queries that return the same result for the lifetime of the application unless a migration runs.
- **Why it may or may not matter in practice:** Each PRAGMA call is fast (~0.1ms on SQLite), so 4 extra PRAGMA calls per request adds ~0.4ms. At low traffic this is negligible. At 100+ requests/second it becomes ~40ms of wasted DB time per second. More importantly, it's conceptually wasteful — the schema doesn't change between requests.
- **Recommended change:** Cache table column lists in a module-level dict, invalidated only when a migration runs. Example: `_COLUMN_CACHE: Dict[str, List[str]] = {}` with a `clear_column_cache()` function called after migrations.
- **Worth doing now?** **Maybe** — it's the single most repeated unnecessary operation in the backend, but the per-call cost is low. Worth doing if you're already touching db.py.
- **Confidence level:** High

#### Relevant snippet
```python
# db.py:385-399
def _table_columns(cur, table: str) -> List[str]:
    if table not in VALID_TABLES:
        raise ValueError(f"Tabla no válida: {table}")
    if is_postgres():
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s ORDER BY ordinal_position
        """, (table,))
        return [r[0] for r in cur.fetchall()]
    else:
        cur.execute(f"PRAGMA table_info({table})")
        return [r[1] for r in cur.fetchall()]

# Called ~30+ times across the codebase per various operations
# Example: get_pedidos() calls it 4 times on lines 1964-1968
```

#### Detailed reasoning
The `_table_columns` function exists for schema compatibility across SQLite/PostgreSQL and to handle optional columns gracefully. This is a good defensive pattern, but it should cache results since schema doesn't change at runtime. The function is called on every CRUD operation, multiplying the overhead. With ~30+ call sites and each request potentially hitting multiple functions, a single page load could trigger 10+ PRAGMA queries unnecessarily.

#### Notes
- SQLite PRAGMA queries are very fast, so the per-call impact is tiny.
- The real concern is cumulative: if the app handles multiple concurrent requests, each one wastes time on redundant schema introspection.
- Cache invalidation is straightforward — only clear when a migration endpoint is called.

---

### Finding 2: Frontend `HistorialPedidos.coincideTexto` uses `clientes.find()` inside filter

- **File:** `frontend/src/components/HistorialPedidos.jsx:188-195`
- **Function/Method:** `coincideTexto` callback used in `datosFiltrados` filter
- **Layer:** Frontend
- **Category:** O(n) lookup inside O(n) loop = O(n×m)
- **Impact:** Medium
- **Current Complexity:** O(P × C) where P = pedidos count, C = clientes count
- **Potential Complexity After Change:** O(P) with a pre-built Map
- **Why it is inefficient:** For every pedido being filtered, `clientes.find(c => c.id === p.cliente_id)` performs a linear scan of the clientes array. With 500 pedidos and 200 clientes, this is 100,000 comparisons per filter pass. The filter runs on every keystroke in the search box.
- **Why it may or may not matter in practice:** With typical dataset sizes (< 500 pedidos, < 300 clientes), JavaScript engines handle this fast enough that users won't notice. But with text search triggering on every keystroke, this runs frequently. Debouncing the search input would also help.
- **Recommended change:** Create a `clientesMap` using `useMemo` (as already done in HojaRuta.jsx) and use `clientesMap.get(p.cliente_id)` instead of `clientes.find()`.
- **Worth doing now?** **Yes** — it's a trivial change (add a Map, change `.find` to `.get`) and the component already imports `useMemo`. HojaRuta.jsx already demonstrates the correct pattern at line 262.
- **Confidence level:** High

#### Relevant snippet
```javascript
// HistorialPedidos.jsx:188-195
const coincideTexto = useCallback((p) => {
    const q = busquedaTexto.trim().toLowerCase();
    if (!q) return true;
    const cliente = clientes.find(c => c.id === p.cliente_id); // O(C) per pedido
    const clienteNombre = (cliente?.nombre || '').toLowerCase();
    const productosStr = (p.productos || []).map(x => x.nombre.toLowerCase()).join(' ');
    return clienteNombre.includes(q) || productosStr.includes(q);
}, [busquedaTexto, clientes]);

// Used in:
// datosFiltrados = datosActuales.filter(p => coincideTexto(p) && ...)  // O(P) outer loop
```

#### Detailed reasoning
This is the classic "array.find() inside a loop" anti-pattern. The HojaRuta component already solved this exact problem at line 262-265 with `const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes])`. The same pattern should be applied here.

#### Notes
- The `useCallback` wrapping is correct for preventing unnecessary re-renders, but doesn't help with the algorithmic complexity inside.
- Since `busquedaTexto` triggers this on every keystroke, the O(P×C) cost is amplified by the frequency of recalculation.
- Adding debouncing to the search input would also reduce how often this runs.

---

### Finding 3: `calcZoneProgress` runs 4 separate `.filter()` passes

- **File:** `frontend/src/components/HojaRuta.jsx:45-53`
- **Function/Method:** `calcZoneProgress()`
- **Layer:** Frontend
- **Category:** Repeated O(n) passes over the same array
- **Impact:** Low
- **Current Complexity:** O(4n) — four `.filter()` calls over `pedidosZona`
- **Potential Complexity After Change:** O(n) — single pass with counters
- **Why it is inefficient:** Four separate `.filter()` calls iterate over the same array independently to count items by estado. A single `reduce()` or `for` loop could compute all four counts at once.
- **Why it may or may not matter in practice:** `pedidosZona` is a subset of pedidos for a single zone, likely <50 items. Four passes over <50 items is ~200 comparisons — completely negligible.
- **Recommended change:** Replace with a single `reduce()` that accumulates counts. Not urgent.
- **Worth doing now?** **No** — the cost is trivial and the current code is very readable.
- **Confidence level:** High

#### Relevant snippet
```javascript
// HojaRuta.jsx:45-53
const calcZoneProgress = (pedidosZona) => {
    const total = pedidosZona.length;
    const pendiente = pedidosZona.filter(p => (p.estado || 'pendiente') === 'pendiente').length;
    const preparando = pedidosZona.filter(p => p.estado === 'preparando').length;
    const entregado = pedidosZona.filter(p => p.estado === 'entregado').length;
    const cancelado = pedidosZona.filter(p => p.estado === 'cancelado').length;
    const completedPercent = total > 0 ? Math.round((entregado / total) * 100) : 0;
    return { total, pendiente, preparando, entregado, cancelado, completedPercent };
};
```

---

### Finding 4: `ProductoSelector.totalFiltrados` duplicates filter logic

- **File:** `frontend/src/components/pedidos/ProductoSelector.jsx:67-70`
- **Function/Method:** `totalFiltrados` useMemo
- **Layer:** Frontend
- **Category:** Duplicated O(n) computation
- **Impact:** Low
- **Current Complexity:** O(n) extra pass (same filter as `productosFiltrados` but without sorting/slicing)
- **Potential Complexity After Change:** O(1) — derive from pre-computed count
- **Why it is inefficient:** `totalFiltrados` re-runs the exact same `.filter()` predicate that `productosFiltrados` already applies (same `busqueda` comparison). The only purpose is to get the count before slicing. This could just track the pre-slice count inside the `productosFiltrados` memo or use a separate ref.
- **Why it may or may not matter in practice:** The filter runs on `productos` (typically <500 items), so the duplicated pass is cheap. It runs on every search keystroke.
- **Recommended change:** Restructure `productosFiltrados` to also return/expose the total count before slicing. One approach: compute the full filtered list, store its length, then slice. Return both.
- **Worth doing now?** **No** — negligible cost. But it's a simple cleanup if you're already modifying the component.
- **Confidence level:** High

#### Relevant snippet
```javascript
// ProductoSelector.jsx:37-65 (computes filtered list with sort + slice)
const productosFiltrados = useMemo(() => {
    let filtered = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    // ... sort ...
    if (!showAll && filtered.length > 12) {
        return filtered.slice(0, 12);
    }
    return filtered;
}, [productos, busqueda, sortBy, showAll]);

// ProductoSelector.jsx:67-70 (re-runs the same filter just for count)
const totalFiltrados = useMemo(() =>
    productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).length,
    [productos, busqueda]
);
```

---

### Finding 5: Backend `reportes/comparativo` calls DB in a loop (6 iterations)

- **File:** `backend/routers/reportes.py:550-564`
- **Function/Method:** `get_reporte_comparativo` — inner loop calling `get_periodo_stats()`
- **Layer:** Backend
- **Category:** Repeated DB queries in a loop
- **Impact:** Low-Medium
- **Current Complexity:** O(6) DB queries in a loop — fixed iteration count
- **Potential Complexity After Change:** O(1) — single query with GROUP BY
- **Why it is inefficient:** The loop calls `get_periodo_stats()` 6 times (one per month), each of which executes a full `SELECT ... JOIN ... WHERE DATE BETWEEN ... GROUP BY` query. These 6 queries could be replaced by a single query with `GROUP BY strftime('%Y-%m', p.fecha)` that returns all 6 months at once.
- **Why it may or may not matter in practice:** This is a comparativo report — called infrequently (admin-only, on demand). 6 queries on SQLite are fast. The concern is more about clean design than actual performance.
- **Recommended change:** Combine into a single query: `SELECT strftime('%Y-%m', p.fecha) as mes, COUNT(DISTINCT p.id), COALESCE(SUM(...)) FROM ... WHERE DATE(p.fecha) >= ? GROUP BY mes ORDER BY mes`. Plus 2 existing queries = 3 total instead of 8+.
- **Worth doing now?** **No** — low-frequency admin endpoint. Nice cleanup if refactoring reports.
- **Confidence level:** High

#### Relevant snippet
```python
# reportes.py:550-564
ultimos_6_meses = []
for i in range(6):
    mes_inicio = (hoy.replace(day=1) - timedelta(days=30*i)).replace(day=1)
    if i == 0:
        mes_fin = hoy
    else:
        mes_fin = (mes_inicio + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    stats = get_periodo_stats(mes_inicio.strftime("%Y-%m-%d"), mes_fin.strftime("%Y-%m-%d"))
    # ... Each call runs a SELECT with JOIN ...
```

---

### Finding 6: `useProductFilters` duplicates stockBajo filter

- **File:** `frontend/src/components/productos/useProductFilters.js:111-118`
- **Function/Method:** `stockBajoCount` and `productosStockBajo` useMemos
- **Layer:** Frontend
- **Category:** Duplicated O(n) computation with identical predicate
- **Impact:** Low
- **Current Complexity:** O(2n) — two `.filter()` calls with the same predicate
- **Potential Complexity After Change:** O(n) — compute once, derive count from `.length`
- **Why it is inefficient:** Both `stockBajoCount` and `productosStockBajo` iterate over `productos` with the identical filter predicate `(p.stock || 0) < (p.stock_minimo || 10)`. The count is just `.length` of the filtered array.
- **Why it may or may not matter in practice:** `productos` is typically <500 items. Two passes over <500 items is negligible.
- **Recommended change:** Compute `productosStockBajo` once, derive `stockBajoCount` as `productosStockBajo.length`.
- **Worth doing now?** **No** — trivial cost. Good cleanup.
- **Confidence level:** High

#### Relevant snippet
```javascript
// useProductFilters.js:111-118
const stockBajoCount = useMemo(() => {
    return productos.filter(p => (p.stock || 0) < (p.stock_minimo || 10)).length;
}, [productos]);

const productosStockBajo = useMemo(() => {
    return productos.filter(p => (p.stock || 0) < (p.stock_minimo || 10));
}, [productos]);
```

---

### Finding 7: HojaRuta `bulkAsignarRepartidor` sends N parallel API calls

- **File:** `frontend/src/components/HojaRuta.jsx:340-379`
- **Function/Method:** `bulkAsignarRepartidor`
- **Layer:** Frontend → Backend
- **Category:** N individual API calls instead of batch
- **Impact:** Medium
- **Current Complexity:** O(n) network round trips where n = selected pedidos
- **Potential Complexity After Change:** O(1) — single batch API call
- **Why it is inefficient:** When assigning a repartidor to multiple selected pedidos, the code sends N individual `PUT /pedidos/{id}/estado` requests via `Promise.allSettled`. With 20 selected pedidos, this is 20 HTTP requests in parallel. While `Promise.allSettled` handles them concurrently, each is a separate TCP connection, request parsing, transaction, and response.
- **Why it may or may not matter in practice:** The bulk-delete operation already has a proper batch endpoint (`POST /pedidos/bulk-delete`). The repartidor assignment lacks such an endpoint. With <20 selections, parallel requests finish fast, but it's wasteful and could hit rate limits.
- **Recommended change:** Create a `POST /pedidos/bulk-update-estado` backend endpoint that accepts `{ids: [...], estado: "...", repartidor: "..."}` and updates all pedidos in a single transaction. This mirrors the existing `bulk-delete` pattern.
- **Worth doing now?** **Maybe** — if bulk operations are used frequently. It's a good pattern to establish.
- **Confidence level:** High

#### Relevant snippet
```javascript
// HojaRuta.jsx:350-362
const results = await Promise.allSettled(
    ids.map(id => {
        const pedido = pedidosMap.get(id);
        return authFetch(`${import.meta.env.VITE_API_URL}/pedidos/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado: pedido?.estado || 'pendiente',
                repartidor: bulkRepartidor
            })
        });
    })
);
```

---

### Finding 8: Backend `add_pedido` — product lookup by name inside loop (fallback path)

- **File:** `backend/db.py:1911-1922`
- **Function/Method:** `add_pedido` — product ID lookup fallback
- **Layer:** Backend
- **Category:** DB query inside loop (fallback path)
- **Impact:** Low
- **Current Complexity:** O(P) where P = products in pedido — but only triggers for products without an ID
- **Potential Complexity After Change:** O(1) if product IDs are always provided
- **Why it is inefficient:** When a product in the pedido lacks an `id`/`producto_id`, the code executes `SELECT id FROM productos WHERE nombre = ? LIMIT 1` inside the loop. This is a DB query per product.
- **Why it may or may not matter in practice:** This is a **fallback path** — the normal case provides product IDs from the frontend. The fallback only triggers for edge cases (offline sync, legacy data). Most pedidos have <10 products.
- **Recommended change:** If the fallback is ever used in bulk, pre-fetch all product names → IDs into a dict before the loop. But since this path rarely triggers and pedidos typically have <10 items, it's not worth optimizing.
- **Worth doing now?** **No** — fallback path with tiny data sizes.
- **Confidence level:** High

#### Relevant snippet
```python
# db.py:1911-1922
for prod in pedido.get("productos", []):
    product_id = prod.get("id") or prod.get("producto_id")
    if product_id is None:
        nombre = prod.get("nombre")
        if not nombre:
            raise ValueError("Producto inválido en pedido: falta id/producto_id y nombre")
        _execute(cur, "SELECT id FROM productos WHERE nombre = ? LIMIT 1", (nombre,))
        r = _fetchone_as_dict(cur)
        if not r:
            raise ValueError(f"Producto no existe en DB: {nombre}")
        product_id = r["id"]
```

---

### Finding 9: `useBulkUpdatePedidosEstado` uses `ids.includes()` inside `.map()`

- **File:** `frontend/src/hooks/useMutations.js:580-586`
- **Function/Method:** `useBulkUpdatePedidosEstado` onMutate
- **Layer:** Frontend
- **Category:** O(n) lookup inside O(m) loop
- **Impact:** Low
- **Current Complexity:** O(P × I) where P = all pedidos, I = selected IDs
- **Potential Complexity After Change:** O(P) with a Set
- **Why it is inefficient:** `ids.includes(p.id)` is O(I) per iteration of the `.map()` over all pedidos. With 500 pedidos and 20 selected, that's 10,000 comparisons.
- **Why it may or may not matter in practice:** This runs once per bulk update (not per render), and the dataset sizes are small enough that it's negligible. But it's a textbook anti-pattern.
- **Recommended change:** Convert `ids` to a `Set` before the `.map()`: `const idSet = new Set(ids); ... idSet.has(p.id)`.
- **Worth doing now?** **No** — trivial cost, but an easy fix if touching this code.
- **Confidence level:** High

#### Relevant snippet
```javascript
// useMutations.js:580-586
queryClient.setQueryData(CACHE_KEYS.pedidos, (old = []) =>
    old.map(p =>
        ids.includes(p.id)  // O(I) per pedido
            ? { ...p, estado: nuevoEstado }
            : p
    )
);
```

---

### Finding 10: Backend `audit_log` called in loop for bulk-delete

- **File:** `backend/routers/pedidos.py:491-499`
- **Function/Method:** `eliminar_pedidos_bulk` — audit log loop
- **Layer:** Backend
- **Category:** DB writes in a loop
- **Impact:** Low
- **Current Complexity:** O(n) DB writes where n = deleted pedidos (max 100)
- **Potential Complexity After Change:** O(1) with batch insert
- **Why it is inefficient:** After bulk-deleting pedidos, the audit log is written one entry at a time in a loop. Each `audit_log()` call likely opens a new DB connection/transaction.
- **Why it may or may not matter in practice:** The bulk-delete is capped at 100 items and is admin-only. The audit writes happen outside the main transaction (by design, to not block the delete). At 100 items, this is ~100 separate INSERT statements, which is slow but acceptable for a rare admin operation.
- **Recommended change:** Create a `bulk_audit_log()` that inserts all entries in a single transaction.
- **Worth doing now?** **No** — rare admin operation with a hard cap of 100.
- **Confidence level:** High

---

## Probably Fine / No Action Needed

### 1. `get_pedidos()` batch loading — Already optimized
`backend/db.py:2023-2057` already uses batch loading with a single `WHERE dp.pedido_id IN (...)` query to load all detalles_pedido for all pedidos. This correctly avoids the N+1 problem. No change needed.

### 2. `pedidos/list` endpoint — Also uses batch loading
`backend/routers/pedidos.py:233-265` also uses the batch loading pattern for the `/pedidos/list` endpoint. Well done.

### 3. HojaRuta `clientesMap` — Already correctly using Map
`frontend/src/components/HojaRuta.jsx:262-269` already creates a `Map` for O(1) client lookups using `useMemo`. This is the correct pattern and avoids the O(n) `.find()` anti-pattern. No change needed. (Note: HistorialPedidos should copy this pattern — see Finding 2.)

### 4. React Query staleTime and caching — Well configured
All hybrid query hooks use appropriate `staleTime` values (2-10 minutes depending on entity volatility). This prevents unnecessary refetches and is a good caching strategy.

### 5. `useProductosQuery` image loading — Efficient
The lazy image loading strategy (load first 30 on initial fetch, then load on demand) is a good optimization that avoids fetching all image blobs upfront. The `loadImagesForIds` function correctly filters already-loaded IDs.

### 6. `useProductFilters.productosFiltrados` — Sequential filters are fine
The chained `.filter()` calls in `useProductFilters.productosFiltrados` (lines 70-107) look like repeated passes, but each subsequent filter only runs on the already-reduced `list`. This is O(n) total (not O(n per filter)) because each filter reduces the input. The code is readable and efficient.

### 7. Zustand store persistence — Correctly excludes heavy data
The store's `partialize` function (line 505-518) correctly excludes `productImages` (base64 blobs) and `loadingImageIds` from localStorage persistence. This prevents localStorage bloat.

### 8. `useMutations.js` optimistic updates — Well structured
All mutation hooks follow the correct React Query optimistic update pattern: cancel queries → snapshot → optimistic update → rollback on error → refetch on settle. No performance concerns.

### 9. `useProductFilters` chained filters — semantically correct
Though lines 70-107 have multiple `.filter()` calls, they apply different predicates and each runs on the result of the previous, not on the original array. This is O(n) total, not O(n × filters).

### 10. `pedidosFiltrados` in HojaRuta — Properly memoized
The filtered pedidos computation at HojaRuta.jsx:279-297 uses `useMemo` with correct dependencies and the O(1) `getCliente()` lookup via the pre-built Map. This is well-optimized.

---

## Suggested Changes for ChatGPT to Review

### High Priority
1. **[Finding 2] Add `clientesMap` to HistorialPedidos** — Create `const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes])` and replace `clientes.find(c => c.id === p.cliente_id)` with `clientesMap.get(p.cliente_id)` in `coincideTexto`. Trivial change, clear benefit.

### Medium Priority
2. **[Finding 1] Cache `_table_columns()` results in db.py** — Add module-level `_COLUMN_CACHE = {}` dict. First call populates, subsequent calls return cached. Add `clear_column_cache()` called from migration endpoints. Affects ~30 call sites implicitly (no caller changes needed).

3. **[Finding 7] Create `POST /pedidos/bulk-update-estado` endpoint** — Mirror the existing `bulk-delete` pattern. Accept `{ids: [...], estado: "...", repartidor: "..."}`. Update all in a single transaction. Update frontend `bulkAsignarRepartidor` and `bulkChangeEstado` to use it.

### Low Priority
4. **[Finding 3] Consolidate `calcZoneProgress` into single pass** — Replace 4 `.filter()` calls with a single `reduce()` accumulating counts. Readability vs performance tradeoff — current code is arguably more readable.

5. **[Finding 4] Eliminate `totalFiltrados` duplication in ProductoSelector** — Restructure to compute filtered count from the pre-computed list inside `productosFiltrados`.

6. **[Finding 6] Merge `stockBajoCount` and `productosStockBajo`** — Compute `productosStockBajo` once, derive count from `.length`.

7. **[Finding 9] Convert `ids` to Set in `useBulkUpdatePedidosEstado`** — `const idSet = new Set(ids)` before the `.map()`.

8. **[Finding 5] Consolidate report comparativo queries** — Replace 6-iteration loop with a single `GROUP BY` query. Only worthwhile if refactoring reports module.

---

## Final Recommendation

### Worth fixing now
- **Finding 2** (HistorialPedidos `clientes.find` → Map) — trivial change, clears a real O(P×C) pattern on a keystroke-triggered path.

### Worth fixing soon (next refactoring pass)
- **Finding 1** (`_table_columns` caching) — systemic improvement that reduces DB overhead across all endpoints.
- **Finding 7** (bulk update endpoint) — API design improvement that reduces network overhead for batch operations.

### Defer / Optional
- Findings 3, 4, 5, 6, 9 — these are all real patterns but with negligible practical impact at current scale. Fix when touching the relevant code.
- Finding 8 — fallback path, almost never triggered.
- Finding 10 — rare admin operation, capped at 100.

### Profile before changing
- The `_table_columns` overhead — profile to confirm whether PRAGMA calls are actually measurable in production response times.
- Any frontend performance concerns — use React DevTools Profiler to confirm whether re-renders from derived state recalculations are actually visible to users.

### General note on scale
This is a small business CRM (butcher shop/food distributor). Expected data volumes are modest: <1000 clientes, <500 productos, <10000 pedidos. Most of the findings are theoretical concerns that would only become practical issues at 10-100x the current scale. The codebase is well-structured and already contains many correct optimizations (batch loading, useMemo, Map lookups, React Query caching). No urgent performance crisis exists.
