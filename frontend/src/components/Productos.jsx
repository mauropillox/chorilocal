import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { authFetch, authFetchJson } from '../authFetch';
import { toastSuccess, toastError, toastWarn } from '../toast';
import { useProductosQuery } from '../hooks/useHybridQuery';
import { useDeleteProducto, useUpdateProductoStock } from '../hooks/useMutations';
import { CACHE_KEYS } from '../utils/queryClient';
import { ProductListSkeleton, TableSkeleton } from './Skeleton';
import ConfirmDialog from './ConfirmDialog';
import HelpBanner from './HelpBanner';
import { logger } from '../utils/logger';

export default function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { productos, isLoading: productsLoading, refetch: refetchProductos, loadImagesForIds } = useProductosQuery();
  const deleteProductoMutation = useDeleteProducto();
  const updateStockMutation = useUpdateProductoStock();
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('0');
  const [stockTipo, setStockTipo] = useState('unidad');
  const [stockMinimo, setStockMinimo] = useState('10');
  const [stockMinimoTipo, setStockMinimoTipo] = useState('unidad');
  const [imagenUrl, setImagenUrl] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [categoriaProducto, setCategoriaProducto] = useState('');
  const [editingImage, setEditingImage] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [editingProducto, setEditingProducto] = useState(null); // Modal edición completa
  const [editForm, setEditForm] = useState({ nombre: '', precio: '', stock: '', stock_minimo: '', stock_tipo: 'unidad', categoria_id: '', imagen_url: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [newStock, setNewStock] = useState('');
  const [newStockTipo, setNewStockTipo] = useState('unidad');
  const [dragActive, setDragActive] = useState(false);
  const [vistaStock, setVistaStock] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [stockItemsPerPage, setStockItemsPerPage] = useState(15);
  const [confirmDelete, setConfirmDelete] = useState(null); // Producto a eliminar
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set()); // Multi-select
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  // Paginación para performance con muchos productos
  const [productsPage, setProductsPage] = useState(1);
  const PRODUCTS_PER_PAGE = 30;
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ofertas
  const [productosEnOferta, setProductosEnOferta] = useState(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const nombreInputRef = useRef(null);

  // Tags del sistema (multi-etiqueta)
  const [allTags, setAllTags] = useState([]);
  const [productosTags, setProductosTags] = useState({}); // { producto_id: [tags] }
  const [tagFiltro, setTagFiltro] = useState('');

  // Ref to always have latest agregarProducto (avoids stale closure in keyboard handler)
  const agregarProductoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Use ref to get latest function (avoids stale closure)
        if (agregarProductoRef.current) agregarProductoRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps - handler uses refs

  // Cleanup blob URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);


  // Restore persisted filters from localStorage
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('productos_filters');
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        if (filters.filtroStockBajo !== undefined) setFiltroStockBajo(filters.filtroStockBajo);
        if (filters.filtroTipo) setFiltroTipo(filters.filtroTipo);
        if (filters.showAll !== undefined) setShowAll(filters.showAll);
        if (filters.vistaStock !== undefined) setVistaStock(filters.vistaStock);
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('productos_filters', JSON.stringify({
      filtroStockBajo,
      filtroTipo,
      showAll,
      vistaStock
    }));
  }, [filtroStockBajo, filtroTipo, showAll, vistaStock]);

  // Load ofertas activas
  const { data: ofertasActivas = [] } = useQuery({
    queryKey: ['ofertasActivas'],
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/ofertas/activas`);
      return (res.ok && Array.isArray(data)) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Load categorias
  const { data: categorias = [] } = useQuery({
    queryKey: CACHE_KEYS.categorias,
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/categorias`);
      return (res.ok && Array.isArray(data)) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Update productosEnOferta when ofertas load
  useEffect(() => {
    const idsEnOferta = new Set();
    ofertasActivas.forEach(o => (o.productos_ids || []).forEach(id => idsEnOferta.add(id)));
    setProductosEnOferta(idsEnOferta);
  }, [ofertasActivas]);

  // Load tags
  const { data: tagsData = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/tags`);
      return (res.ok && Array.isArray(data)) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Load productos-con-tags
  const { data: productosConTags = [] } = useQuery({
    queryKey: ['productos-con-tags'],
    queryFn: async () => {
      const { res, data } = await authFetchJson(`${import.meta.env.VITE_API_URL}/productos-con-tags`);
      return (res.ok && Array.isArray(data)) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Update tags state when data loads
  useEffect(() => {
    setAllTags(tagsData);
    const tagMap = {};
    productosConTags.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        tagMap[p.id] = p.tags;
      }
    });
    setProductosTags(tagMap);
  }, [tagsData, productosConTags]);

  useEffect(() => {
    const buscarParam = searchParams.get('buscar');
    const stockBajoParam = searchParams.get('stockBajo');
    const crearParam = searchParams.get('crear');

    if (buscarParam) {
      setBusqueda(buscarParam);
      setShowAll(true);
      setSearchParams({});
    }
    if (stockBajoParam === '1') {
      setFiltroStockBajo(true);
      setShowAll(true);
      setSearchParams({});
    }
    if (crearParam === '1') {
      setShowCreateForm(true);
      setTimeout(() => nombreInputRef.current?.focus(), 100);
      setSearchParams({});
    }
  }, [searchParams]);



  const agregarProducto = useCallback(async () => {
    if (!nombre || !precio) return toastWarn("Debe ingresar el nombre y el precio del producto");
    if (imagenUrl && urlError) return toastWarn('URL de imagen inválida');
    setCreating(true);
    const payload = {
      nombre,
      precio: parseFloat(precio),
      stock: parseFloat(stock) || 0,
      stock_tipo: stockTipo,
      stock_minimo: parseFloat(stockMinimo) || 10,
      imagen_url: imagenUrl || null
    };
    // categoria_id es opcional
    if (categoriaProducto) {
      payload.categoria_id = parseInt(categoriaProducto);
    }
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await refetchProductos();
      setNombre(''); setPrecio(''); setStock('0'); setStockTipo('unidad'); setStockMinimo('10'); setStockMinimoTipo('unidad');
      // Clean up blob URL to prevent memory leak
      if (filePreview && filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
      setImagenUrl(''); setFilePreview(null); setUrlError(''); setCategoriaProducto('');
      toastSuccess('Producto creado correctamente');
    } else {
      try {
        const err = await res.json();
        const msg = (err && (err.detail?.detail || err.detail || err.message)) || 'Error al crear producto';
        toastError(msg);
      } catch (_) {
        toastError('Error al crear producto');
      }
    }
    setCreating(false);
  }, [nombre, precio, stock, stockTipo, stockMinimo, imagenUrl, urlError, categoriaProducto, filePreview]);

  // Keep ref updated with latest agregarProducto
  useEffect(() => {
    agregarProductoRef.current = agregarProducto;
  }, [agregarProducto]);

  const actualizarStock = async (productoId, nuevoStock, nuevoTipo) => {
    try {
      await updateStockMutation.mutateAsync({
        id: productoId,
        stock: nuevoStock,
        stock_tipo: nuevoTipo
      });
      setEditingStock(null);
      setNewStock('');
    } catch (error) {
      // Error handling is done in mutation hook
      logger.error('Stock update failed:', error);
    }
  };

  const actualizarCategoriaProducto = async (productoId, nuevaCategoriaId) => {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    // Usar endpoint específico de categoría para evitar validación de precio
    const url = nuevaCategoriaId
      ? `${import.meta.env.VITE_API_URL}/productos/${productoId}/categoria?categoria_id=${nuevaCategoriaId}`
      : `${import.meta.env.VITE_API_URL}/productos/${productoId}/categoria`;

    const res = await authFetch(url, {
      method: "PUT"
    });

    if (res.ok) {
      await refetchProductos();
      setEditingCategoria(null);
      toastSuccess('Categoría actualizada');
    } else {
      toastError('Error al actualizar categoría');
    }
  };

  // Abrir modal de edición completa
  const abrirEdicionProducto = (producto) => {
    const newEditForm = {
      nombre: producto.nombre || '',
      precio: String(producto.precio || ''),
      stock: String(producto.stock || '0'),
      stock_minimo: String(producto.stock_minimo || '10'),
      stock_tipo: producto.stock_tipo || 'unidad',
      categoria_id: producto.categoria_id || '',
      imagen_url: producto.imagen_url || ''
    };
    setEditForm(newEditForm);
    setEditingProducto(producto);
  };

  // Guardar edición completa
  const guardarEdicionProducto = async () => {
    if (!editingProducto) return;
    if (!editForm.nombre.trim()) { toastError('El nombre es requerido'); return; }
    if (!editForm.precio || parseFloat(editForm.precio) < 0) { toastError('Precio inválido'); return; }

    setSavingEdit(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${editingProducto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editForm.nombre.trim(),
          precio: parseFloat(editForm.precio),
          stock: parseFloat(editForm.stock) || 0,
          stock_minimo: parseFloat(editForm.stock_minimo) || 10,
          stock_tipo: editForm.stock_tipo,
          categoria_id: editForm.categoria_id ? parseInt(editForm.categoria_id) : null,
          imagen_url: editForm.imagen_url || null
        })
      });

      if (res.ok) {
        await refetchProductos();
        setEditingProducto(null);
        toastSuccess('Producto actualizado correctamente');
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al actualizar producto');
      }
    } catch (e) {
      toastError('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  // Eliminar producto con optimistic update
  const eliminarProducto = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteProductoMutation.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (e) {
      // Error already handled by mutation hook
    } finally {
      setDeleting(false);
    }
  };

  // Multi-select functions
  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = productosFiltrados.map(p => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const eliminarSeleccionados = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([...selectedIds])
      });
      if (res.ok) {
        const data = await res.json();
        toastSuccess(`${data.deleted} producto(s) eliminado(s)`);
        if (data.errors?.length > 0) {
          toastWarn(`${data.errors.length} producto(s) no se pudieron eliminar (tienen pedidos asociados)`);
        }
        setSelectedIds(new Set());
        await refetchProductos();
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.detail || 'Error al eliminar productos');
      }
    } catch (e) {
      toastError('Error de conexión');
    } finally {
      setDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const actualizarImagenProducto = async (productoId, nuevaImagenUrl) => {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...producto, imagen_url: nuevaImagenUrl })
    });

    if (res.ok) {
      await refetchProductos();
      setEditingImage(null);
      // Clean up blob URL to prevent memory leak
      if (filePreview && filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    } else {
      const err = await res.json().catch(() => ({}));
      toastError(err.detail || 'Error al actualizar imagen');
    }
  };

  const quitarImagenProducto = async (productoId) => {
    if (!confirm('¿Está seguro que desea quitar la imagen de este producto?')) return;

    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/${productoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...producto, imagen_url: null })
    });

    if (res.ok) {
      await refetchProductos();
      setEditingImage(null);
      toastSuccess('✅ Imagen eliminada correctamente');
    } else {
      const err = await res.json().catch(() => ({}));
      toastError(err.detail || 'Error al eliminar imagen');
    }
  };

  const validateUrl = (v) => {
    if (!v) { setUrlError(''); return; }
    try {
      const u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
      setUrlError('');
    } catch (_) { setUrlError('URL inválida'); }
  };

  const handleFileChange = async (e, productoId = null) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    await uploadFile(f, productoId);
  };

  const uploadFile = async (file, productoId = null) => {
    // Validar tamaño de archivo (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      toastError('La imagen es demasiado grande. Máximo: 5MB');
      return;
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toastError('Solo se permiten archivos de imagen');
      return;
    }

    // Clean up previous preview URL to prevent memory leak
    if (filePreview && filePreview.startsWith('blob:')) {
      URL.revokeObjectURL(filePreview);
    }

    // Crear preview inmediato
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
    setFileUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await authFetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: 'POST',
        body: fd,
        // No establecer Content-Type, el browser lo hace automáticamente con boundary
      });

      if (!res.ok) {
        const errorData = await res.text();
        logger.error('Upload error:', errorData);
        toastError(`Error al subir imagen: ${res.status}`);
        return;
      }

      const data = await res.json();
      let url = data.url || data.path || '';
      if (url.startsWith('/')) {
        url = `${import.meta.env.VITE_API_URL}${url}`;
      }

      if (productoId) {
        await actualizarImagenProducto(productoId, url);
        toastSuccess('✅ Imagen actualizada correctamente');
      } else {
        setImagenUrl(url);
        toastSuccess('✅ Imagen cargada correctamente');
      }
      setUrlError('');

    } catch (err) {
      logger.error('Upload error:', err);
      toastError('❌ Error de conexión al subir imagen');
    } finally {
      setFileUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e, productoId = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0], productoId);
  };

  const exportarCSV = async () => {
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/export/csv`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'productos.csv';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const exportarExcel = async () => {
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/productos/export/xlsx`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'productos.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toastSuccess('Excel exportado correctamente');
    } else {
      toastError('Error al exportar Excel');
    }
  };

  // Reset página cuando cambia la búsqueda o filtros
  useEffect(() => {
    setProductsPage(1);
  }, [busqueda, filtroStockBajo, filtroTipo, categoriaFiltro, tagFiltro, precioMin, precioMax]);

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim() && !showAll) return [];
    const q = busqueda.trim().toLowerCase();
    let list = q ? productos.filter(p => p.nombre.toLowerCase().includes(q)) : productos.slice();
    // Advanced filters
    if (filtroStockBajo) {
      list = list.filter(p => (p.stock || 0) < (p.stock_minimo || 10));
    }
    if (filtroTipo && filtroTipo !== 'todos') {
      list = list.filter(p => (p.stock_tipo || 'unidad') === filtroTipo);
    }
    if (categoriaFiltro) {
      list = list.filter(p => p.categoria_id === parseInt(categoriaFiltro));
    }
    // Filtro por tag
    if (tagFiltro) {
      const tagId = parseInt(tagFiltro);
      list = list.filter(p => productosTags[p.id]?.some(t => t.id === tagId));
    }
    if (precioMin) {
      const min = parseFloat(precioMin);
      if (!Number.isNaN(min)) list = list.filter(p => (p.precio || 0) >= min);
    }
    if (precioMax) {
      const max = parseFloat(precioMax);
      if (!Number.isNaN(max)) list = list.filter(p => (p.precio || 0) <= max);
    }
    return list;
  }, [productos, busqueda, showAll, filtroStockBajo, filtroTipo, categoriaFiltro, tagFiltro, productosTags, precioMin, precioMax]);

  // Productos paginados para mejor rendimiento
  const productosPaginados = useMemo(() => {
    const start = (productsPage - 1) * PRODUCTS_PER_PAGE;
    return productosFiltrados.slice(start, start + PRODUCTS_PER_PAGE);
  }, [productosFiltrados, productsPage]);

  const totalProductsPages = Math.ceil(productosFiltrados.length / PRODUCTS_PER_PAGE);

  // Get IDs of current page products for image loading
  const currentPageIds = useMemo(() =>
    productosPaginados.map(p => p.id).sort((a, b) => a - b),
    [productosPaginados]
  );

  // Lazy load images for visible products on current page
  useEffect(() => {
    if (currentPageIds.length > 0 && loadImagesForIds) {
      loadImagesForIds(currentPageIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(currentPageIds)]);

  const stockBajo = useMemo(() => {
    return productos.filter(p => {
      const stock_actual = p.stock || 0;
      const stock_min = p.stock_minimo || 10;
      return stock_actual < stock_min;
    });
  }, [productos]);

  const mostrarVistaStock = vistaStock && busqueda === '' && showAll;

  return (
    <div style={{ color: 'var(--color-text)' }}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>📦 Productos</h2>
        <div className="flex gap-2">
          <button onClick={() => setVistaStock(!vistaStock)} className={vistaStock ? "btn-primary" : "btn-secondary"}>
            {vistaStock ? "📋 Volver a Productos" : "📊 Gestor Stock"}
          </button>
          <button onClick={exportarCSV} className="btn-secondary">📥 CSV</button>
          <button onClick={exportarExcel} className="btn-secondary">📊 Excel</button>
        </div>
      </div>

      {/* Ayuda colapsable */}
      <HelpBanner
        title="¿Cómo gestionar productos?"
        icon="📦"
        items={[
          { label: 'Crear producto', text: 'Completá nombre (obligatorio), precio, y opcionalmente categoría, stock inicial y descripción. El código es único y automático.' },
          { label: 'Imágenes', text: 'Arrastrá y soltá la foto del producto, o clickeá para seleccionar. Las imágenes se comprimen automáticamente. Máximo 5MB.' },
          { label: 'Vista Gestor Stock', text: 'Clickeá "🔄 Gestor Stock" para ver todos los productos en tabla. Editá stock directamente, descargá CSV o Excel para inventario.' },
          { label: 'Stock bajo', text: 'Los productos con poco stock aparecen en naranja (⚠). Configurá el mínimo en cada producto. Las alertas aparecen en el Dashboard.' },
          { label: 'Categorías', text: 'Organizá productos por categorías para facilitar la búsqueda. Asigná colores para identificación visual.' },
          { label: 'Editar/Eliminar', text: 'Clickeá cualquier producto de la lista para editarlo. Solo podés eliminar productos sin pedidos asociados.' },
          { label: 'Tips', text: 'Usá descripciones para notas importantes (ej: "Frío", "Frágil"). Los precios se pueden ajustar con listas de precios.' }
        ]}
      />

      <div className="two-column-layout">
        {/* LEFT: Formulario */}
        <div className="panel">
          {stockBajo.length > 0 && (
            <div className="alert-warning mb-4" style={{ padding: '0.75rem 1rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold" style={{ color: '#d97706' }}>⚠️ {stockBajo.length} productos con stock bajo</span>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {stockBajo.slice(0, 2).map(p => p.nombre).join(', ')}
                    {stockBajo.length > 2 && ` y ${stockBajo.length - 2} más`}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (filtroStockBajo) {
                      setFiltroStockBajo(false);
                    } else {
                      setFiltroStockBajo(true);
                      setShowAll(true);
                      setBusqueda('');
                    }
                  }}
                  className="btn-secondary text-xs px-2 py-1"
                  style={{ minHeight: '32px' }}
                >
                  {filtroStockBajo ? 'Ver todos' : 'Ver'}
                </button>
              </div>
            </div>
          )}
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Agregar Producto</h3>

          <div className="form-group">
            <label>Nombre *</label>
            <input autoFocus type="text" placeholder="Nombre del producto" value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarProducto()} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label>Precio *</label>
              <input type="number" placeholder="0.00" value={precio}
                onChange={e => setPrecio(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarProducto()} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="form-group">
              <label>Stock inicial</label>
              <input type="number" placeholder="0" value={stock} min="0" step="0.5"
                onChange={e => setStock(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarProducto()} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={stockTipo} onChange={e => setStockTipo(e.target.value)}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kilo</option>
                <option value="caja">Caja</option>
                <option value="gancho">Gancho</option>
                <option value="tira">Tira</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Stock mínimo</label>
            <input type="number" placeholder="10" value={stockMinimo} min="0" step="0.5"
              onChange={e => setStockMinimo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarProducto()} />
          </div>

          <div className="form-group">
            <label>Categoría <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(opcional)</span></label>
            <select value={categoriaProducto} onChange={e => setCategoriaProducto(e.target.value)}>
              <option value="">Sin categoría</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Imagen (Drag & Drop o Click)</label>
            <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer drag-zone ${dragActive ? 'drag-active' : 'border-gray-300 hover:border-gray-400'
              } ${fileUploading ? 'opacity-50 pointer-events-none' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e)}
              onClick={() => !fileUploading && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <div className="text-4xl mb-2">{dragActive ? '📤' : '📷'}</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {fileUploading ? (
                  <span className="upload-loading">⏳ Subiendo imagen...</span>
                ) : dragActive ? (
                  <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>✨ Suelta la imagen aquí</span>
                ) : (
                  'Arrastra una imagen o haz click para seleccionar'
                )}
              </div>
              {!fileUploading && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  JPG, PNG, GIF, WEBP • Máximo 5MB
                </div>
              )}
            </div>
            {filePreview && !fileUploading && (
              <div className="mt-3 flex justify-center">
                <img src={filePreview} alt="Vista previa" className="product-image" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>O URL de imagen</label>
            <input type="text" placeholder="https://..." value={imagenUrl}
              onChange={e => { setImagenUrl(e.target.value); validateUrl(e.target.value); }} />
            {urlError && <span className="text-sm text-danger">{urlError}</span>}
          </div>

          <button onClick={agregarProducto} disabled={creating || !!urlError || fileUploading} className="btn-success w-full">
            {creating ? '⏳ Creando...' : '➕ Agregar Producto'}
          </button>
        </div>

        {/* RIGHT */}
        <div className="panel">
          {vistaStock ? (
            /* VISTA GESTOR DE STOCK */
            productsLoading ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>📦 Gestor de Stock</h3>
                </div>
                <TableSkeleton rows={10} columns={4} />
              </div>
            ) : (() => {
              const totalStockPages = Math.ceil(productos.length / stockItemsPerPage);
              const stockStartIndex = (stockPage - 1) * stockItemsPerPage;
              const stockEndIndex = stockStartIndex + stockItemsPerPage;
              const productosPaginados = productos.slice(stockStartIndex, stockEndIndex);

              return (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>📦 Gestor de Stock</h3>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>💡 Haz clic en Stock para editar</span>
                  </div>

                  {/* Paginación superior */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '12px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)'
                  }}>
                    <button
                      onClick={() => setStockPage(Math.max(1, stockPage - 1))}
                      disabled={stockPage === 1}
                      className="btn-secondary"
                      style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                    >
                      ← Anterior
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {stockStartIndex + 1}-{Math.min(stockEndIndex, productos.length)} de {productos.length}
                      </span>
                      <select
                        value={stockItemsPerPage}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? productos.length : parseInt(e.target.value);
                          setStockItemsPerPage(val);
                          setStockPage(1);
                        }}
                        style={{
                          background: 'var(--color-bg)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          minHeight: '36px'
                        }}
                      >
                        <option value={10}>10/pág</option>
                        <option value={15}>15/pág</option>
                        <option value={25}>25/pág</option>
                        <option value={50}>50/pág</option>
                        <option value={100}>100/pág</option>
                        <option value="all">Todos</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setStockPage(Math.min(totalStockPages, stockPage + 1))}
                      disabled={stockPage === totalStockPages}
                      className="btn-secondary"
                      style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                    >
                      Siguiente →
                    </button>
                  </div>

                  <div className="stock-table-container">
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style={{ textAlign: 'center' }}>Stock</th>
                          <th style={{ textAlign: 'center' }}>Mínimo</th>
                          <th style={{ textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productosPaginados.map(p => {
                          const bajo = (p.stock || 0) < (p.stock_minimo || 10);
                          return (
                            <tr key={p.id} className={bajo ? 'stock-bajo' : ''}>
                              <td className="truncate" title={p.nombre} style={{ maxWidth: '200px' }}>{p.nombre}</td>
                              <td style={{ textAlign: 'center' }}>
                                {editingStock === p.id ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)}
                                      className="w-16 text-sm p-1 border rounded" min="0" step="0.5" autoFocus
                                      style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
                                      onKeyDown={e => { if (e.key === 'Enter') actualizarStock(p.id, newStock, newStockTipo); if (e.key === 'Escape') setEditingStock(null); }} />
                                    <select value={newStockTipo} onChange={e => setNewStockTipo(e.target.value)}
                                      className="text-sm p-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                                      <option value="unidad">U</option>
                                      <option value="kg">Kg</option>
                                      <option value="caja">C</option>
                                      <option value="gancho">G</option>
                                      <option value="tira">T</option>
                                    </select>
                                  </div>
                                ) : (
                                  <span className="editable-cell px-3 py-1 font-semibold inline-block rounded"
                                    onClick={() => { setEditingStock(p.id); setNewStock(String(p.stock || 0)); setNewStockTipo(p.stock_tipo || 'unidad'); }}
                                    title="Clic para editar stock"
                                    style={{ cursor: 'pointer' }}>
                                    {p.stock || 0} {(p.stock_tipo || 'unidad').charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>{p.stock_minimo || 10} {(p.stock_tipo || 'unidad').charAt(0).toUpperCase()}</td>
                              <td style={{ textAlign: 'center' }}>
                                {editingStock === p.id ? (
                                  <div className="flex gap-2 justify-center">
                                    <button onClick={() => actualizarStock(p.id, newStock, newStockTipo)}
                                      className="btn-success px-3 py-1 text-sm" style={{ minHeight: '32px' }}>✓</button>
                                    <button onClick={() => setEditingStock(null)}
                                      className="btn-ghost px-2 py-1 text-sm" style={{ minHeight: '32px' }}>✕</button>
                                  </div>
                                ) : bajo ? (
                                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Bajo</span>
                                ) : (
                                  <span style={{ color: 'var(--color-success)' }}>✓ OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación inferior */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: '12px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)'
                  }}>
                    <button
                      onClick={() => setStockPage(Math.max(1, stockPage - 1))}
                      disabled={stockPage === 1}
                      className="btn-secondary"
                      style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                    >
                      ← Anterior
                    </button>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>
                      Página {stockPage} de {totalStockPages}
                    </span>
                    <button
                      onClick={() => setStockPage(Math.min(totalStockPages, stockPage + 1))}
                      disabled={stockPage === totalStockPages}
                      className="btn-secondary"
                      style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                    >
                      Siguiente →
                    </button>
                  </div>
                </>
              );
            })()
          ) : (
            /* VISTA NORMAL */
            <>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Listado</h3>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-danger, #ef4444)' }}>{selectedIds.size} seleccionados</span>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setConfirmBulkDelete(true)}
                      style={{ fontSize: '0.95rem', padding: '4px 10px' }}
                    >
                      🗑️ Eliminar seleccionados
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => setSelectedIds(new Set())}
                      style={{ fontSize: '0.95rem', padding: '4px 10px' }}
                    >
                      ✕ Limpiar
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <input type="text" placeholder="🔍 Buscar productos..." value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setShowAll(false); }} className="w-full" />
              </div>

              {/* Advanced filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="custom-checkbox" checked={filtroStockBajo} onChange={e => setFiltroStockBajo(e.target.checked)} />
                  Stock bajo
                </label>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="text-sm p-2 border rounded">
                  <option value="todos">Tipo: Todos</option>
                  <option value="unidad">Tipo: Unidad</option>
                  <option value="caja">Tipo: Caja</option>
                  <option value="gancho">Tipo: Gancho</option>
                  <option value="tira">Tipo: Tira</option>
                </select>
                <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="text-sm p-2 border rounded">
                  <option value="">Categoría: Todas</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <select value={tagFiltro} onChange={e => setTagFiltro(e.target.value)} className="text-sm p-2 border rounded">
                  <option value="">Tag: Todos</option>
                  <optgroup label="Conservación">
                    {allTags.filter(t => t.tipo === 'conservacion').map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Tipo de producto">
                    {allTags.filter(t => t.tipo === 'tipo').map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.nombre}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input type="number" placeholder="Precio min" value={precioMin} onChange={e => setPrecioMin(e.target.value)} className="text-sm p-2 border rounded" />
                <input type="number" placeholder="Precio max" value={precioMax} onChange={e => setPrecioMax(e.target.value)} className="text-sm p-2 border rounded" />
              </div>

              {productsLoading ? (
                <ProductListSkeleton count={5} />
              ) : productosFiltrados.length === 0 && !busqueda && !showAll ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-text">Escribe para buscar productos</div>
                  <button onClick={() => setShowAll(true)} className="btn-secondary">Ver todos ({productos.length})</button>
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No se encontraron</div></div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={selectedIds.size === productosFiltrados.length && productosFiltrados.length > 0}
                        onChange={toggleSelectAllVisible}
                        aria-label="Seleccionar todos los productos"
                      />
                      <span className="text-xs text-muted">Seleccionar todos</span>
                    </div>
                    <span className="text-xs text-muted">
                      {productosFiltrados.length} productos
                      {totalProductsPages > 1 && ` (pág ${productsPage}/${totalProductsPages})`}
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-3">
                    {productosPaginados.map(p => {
                      const bajo = (p.stock || 0) < (p.stock_minimo || 10);
                      const categoria = categorias.find(c => c.id === p?.categoria_id);
                      return (
                        <div key={p?.id} className={`card-item ${bajo ? 'stock-bajo-item' : ''}`} style={{ padding: '12px' }}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="custom-checkbox mt-2"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelection(p.id)}
                              aria-label={`Seleccionar producto ${p?.nombre || ''}`}
                            />
                            {/* Imagen */}
                            <div
                              className="relative group cursor-pointer flex-shrink-0"
                              onClick={() => setEditingImage(editingImage === p.id ? null : p.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingImage(editingImage === p.id ? null : p.id)}
                              aria-label={`Cambiar imagen de ${p?.nombre || 'producto'}`}
                              title="Click para cambiar imagen"
                              onDragEnter={(e) => handleDrag(e)}
                              onDragOver={(e) => handleDrag(e)}
                              onDragLeave={(e) => handleDrag(e)}
                              onDrop={(e) => handleDrop(e, p.id)}
                            >
                              {p?.imagen_url ? (
                                <img
                                  src={p.imagen_url}
                                  alt={p?.nombre || 'Producto'}
                                  className="product-image"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    if (e.target.nextElementSibling) {
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div
                                className={`product-image-placeholder ${dragActive ? 'border-primary' : ''}`}
                                style={{
                                  display: p?.imagen_url ? 'none' : 'flex',
                                  borderColor: dragActive ? 'var(--color-primary)' : undefined,
                                  backgroundColor: dragActive ? 'var(--color-bg-accent)' : undefined
                                }}
                              >
                                {dragActive ? '📤' : '📦'}
                              </div>
                              <div
                                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center rounded-lg ${dragActive ? 'opacity-100 bg-primary/20' : ''
                                  }`}
                                style={{
                                  background: dragActive ?
                                    'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(14,165,233,0.1))' :
                                    'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4))'
                                }}
                              >
                                <span className="text-2xl mb-1" aria-hidden="true">{dragActive ? '📤' : '📷'}</span>
                                <span className="text-white text-xs font-medium">
                                  {dragActive ? 'Soltar imagen aquí' : 'Cambiar Imagen'}
                                </span>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                                  {p?.nombre || 'Sin nombre'}
                                </span>
                                {productosEnOferta.has(p?.id) && (
                                  <span style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: '#fff', fontSize: '0.6rem', padding: '2px 6px',
                                    borderRadius: '6px', fontWeight: 700, flexShrink: 0
                                  }}>OFERTA</span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-sm mb-2">
                                <span className="font-bold" style={{ color: 'var(--color-success)' }}>${p?.precio || 0}</span>
                                <span className={`${bajo ? 'text-orange-600 font-bold' : ''}`} style={{ color: bajo ? undefined : 'var(--color-text-muted)' }}>
                                  📦 {p?.stock || 0} {p?.stock_tipo || 'unidad'}
                                </span>
                              </div>

                              {/* Badge de categoría mejorado */}
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: categoria ? `${categoria.color}20` : 'var(--color-bg-secondary)',
                                  border: `1px solid ${categoria?.color || 'var(--color-border)'}`,
                                  color: categoria?.color || 'var(--color-text-muted)'
                                }}
                                onClick={(e) => { e.stopPropagation(); setEditingCategoria(editingCategoria === p.id ? null : p.id); }}
                                title="Click para cambiar categoría"
                              >
                                <span style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  backgroundColor: categoria?.color || '#9ca3af'
                                }} />
                                <span style={{ fontWeight: 500 }}>{categoria?.nombre || 'Sin categoría'}</span>
                                <span style={{ opacity: 0.6 }}>▼</span>
                              </button>

                              {/* Tags del producto */}
                              {productosTags[p.id] && productosTags[p.id].length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {productosTags[p.id].slice(0, 4).map(tag => (
                                    <span
                                      key={tag.id}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                                      style={{
                                        backgroundColor: `${tag.color || '#6b7280'}20`,
                                        color: tag.color || '#6b7280',
                                        fontSize: '0.65rem'
                                      }}
                                      title={tag.nombre}
                                    >
                                      {tag.icono || '🏷️'} {tag.nombre?.replace(/^[^\s]+ /, '')}
                                    </span>
                                  ))}
                                  {productosTags[p.id].length > 4 && (
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                      +{productosTags[p.id].length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Botones editar y eliminar */}
                            <div className="flex gap-1" style={{ flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  abrirEdicionProducto(p);
                                }}
                                className="btn-ghost"
                                style={{ padding: '6px 10px', minHeight: 'auto' }}
                                title="Editar producto"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setConfirmDelete(p);
                                }}
                                className="btn-ghost"
                                style={{ padding: '6px 10px', minHeight: 'auto', color: 'var(--color-danger, #ef4444)' }}
                                title="Eliminar producto"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Editor de categoría inline mejorado */}
                          {editingCategoria === p.id && (
                            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                              <div className="text-xs mb-2 font-semibold" style={{ color: 'var(--color-text-muted)' }}>Seleccionar categoría:</div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => { actualizarCategoriaProducto(p.id, ''); }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!p.categoria_id ? 'ring-2 ring-offset-1' : ''}`}
                                  style={{
                                    backgroundColor: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-muted)'
                                  }}
                                >
                                  Sin categoría
                                </button>
                                {categorias.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => actualizarCategoriaProducto(p.id, cat.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${p.categoria_id === cat.id ? 'ring-2 ring-offset-1' : ''}`}
                                    style={{
                                      backgroundColor: `${cat.color}20`,
                                      border: `1px solid ${cat.color}`,
                                      color: cat.color
                                    }}
                                  >
                                    {cat.nombre}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setEditingCategoria(null)}
                                className="mt-2 text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                ✕ Cerrar
                              </button>
                            </div>
                          )}

                          {editingImage === p.id && (
                            <div className="mt-3 p-4 rounded-xl" style={{
                              backgroundColor: 'var(--color-bg-secondary)',
                              border: '2px dashed var(--color-primary)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-2xl">📷</span>
                                <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Cambiar Imagen</span>
                              </div>

                              <label
                                className={`flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer drag-zone ${dragActive ? 'drag-active' : ''
                                  } ${fileUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                style={{
                                  backgroundColor: 'var(--color-bg-tertiary, var(--color-bg-secondary))',
                                  border: '2px solid var(--color-border)',
                                  minHeight: '100px'
                                }}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={(e) => handleDrop(e, p.id)}
                              >
                                <span className="text-3xl mb-2">{dragActive ? '📤' : '📷'}</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                  {fileUploading ? (
                                    <span className="upload-loading">⏳ Subiendo imagen...</span>
                                  ) : dragActive ? (
                                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>✨ Suelta la imagen aquí</span>
                                  ) : (
                                    'Arrastra aquí o click para seleccionar'
                                  )}
                                </span>
                                {!fileUploading && (
                                  <span className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                    JPG, PNG, GIF, WEBP • Máximo 5MB
                                  </span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(e, p.id)}
                                  className="hidden"
                                  disabled={fileUploading}
                                />
                              </label>

                              <div className="flex justify-between items-center mt-3">
                                <button
                                  onClick={() => quitarImagenProducto(p.id)}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                  style={{
                                    backgroundColor: 'var(--color-danger, #dc3545)',
                                    color: 'white'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger-hover, #c82333)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger, #dc3545)'}
                                  disabled={!p.imagen_url}
                                  title={p.imagen_url ? "Quitar imagen actual" : "Este producto no tiene imagen"}
                                >
                                  🗑️ Quitar Imagen
                                </button>
                                <button
                                  onClick={() => setEditingImage(null)}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                  style={{
                                    backgroundColor: 'var(--color-bg-accent)',
                                    color: 'var(--color-text-muted)'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, var(--color-bg-accent))'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-accent)'}
                                >
                                  ✕ Cerrar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Paginación */}
                  {totalProductsPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <button
                        onClick={() => setProductsPage(1)}
                        disabled={productsPage === 1}
                        className="btn-ghost text-sm"
                        style={{ padding: '6px 10px' }}
                        title="Primera página"
                      >
                        ⏮️
                      </button>
                      <button
                        onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                        disabled={productsPage === 1}
                        className="btn-secondary text-sm"
                        style={{ padding: '6px 12px' }}
                      >
                        ← Anterior
                      </button>
                      <span className="text-sm px-3" style={{ color: 'var(--color-text-muted)' }}>
                        {productsPage} / {totalProductsPages}
                      </span>
                      <button
                        onClick={() => setProductsPage(p => Math.min(totalProductsPages, p + 1))}
                        disabled={productsPage === totalProductsPages}
                        className="btn-secondary text-sm"
                        style={{ padding: '6px 12px' }}
                      >
                        Siguiente →
                      </button>
                      <button
                        onClick={() => setProductsPage(totalProductsPages)}
                        disabled={productsPage === totalProductsPages}
                        className="btn-ghost text-sm"
                        style={{ padding: '6px 10px' }}
                        title="Última página"
                      >
                        ⏭️
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(busqueda || showAll) && productosFiltrados.length > 0 && totalProductsPages <= 1 && (
                <div className="mt-3 text-sm text-muted text-center">
                  Mostrando {productosFiltrados.length} de {productos.length}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de edición completa de producto */}
      {
        editingProducto && (
          <div className="modal-backdrop" onClick={() => !savingEdit && setEditingProducto(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                ✏️ Editar Producto
              </h3>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre *</label>
                  <input
                    type="text"
                    value={editForm.nombre}
                    onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="Nombre del producto"
                  />
                </div>

                {/* Precio y Stock en fila */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Precio *</label>
                    <input
                      type="number"
                      value={editForm.precio}
                      onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Stock</label>
                    <input
                      type="number"
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                {/* Stock mínimo y tipo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Stock Mínimo</label>
                    <input
                      type="number"
                      value={editForm.stock_minimo}
                      onChange={(e) => setEditForm({ ...editForm, stock_minimo: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="10"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Tipo Stock</label>
                    <select
                      value={editForm.stock_tipo}
                      onChange={(e) => setEditForm({ ...editForm, stock_tipo: e.target.value })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="unidad">Unidad</option>
                      <option value="kg">Kilo</option>
                      <option value="caja">Caja</option>
                      <option value="gancho">Gancho</option>
                      <option value="tira">Tira</option>
                    </select>
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, categoria_id: '' })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!editForm.categoria_id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      Sin categoría
                    </button>
                    {categorias.map(cat => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setEditForm({ ...editForm, categoria_id: cat.id })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${String(editForm.categoria_id) === String(cat.id) ? 'ring-2 ring-offset-1' : ''}`}
                        style={{
                          backgroundColor: `${cat.color}20`,
                          border: `1px solid ${cat.color}`,
                          color: cat.color,
                          '--tw-ring-color': cat.color
                        }}
                      >
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* URL imagen */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>URL Imagen (opcional)</label>
                  <input
                    type="text"
                    value={editForm.imagen_url}
                    onChange={(e) => setEditForm({ ...editForm, imagen_url: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingProducto(null)}
                  className="btn-secondary flex-1"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarEdicionProducto}
                  className="btn-primary flex-1"
                  disabled={savingEdit}
                >
                  {savingEdit ? '⏳ Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal confirmación eliminar producto */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={eliminarProducto}
        title="¿Eliminar producto?"
        message={`¿Estás seguro de eliminar "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText={deleting ? "Eliminando..." : "Eliminar"}
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal confirmación eliminar productos seleccionados (bulk) */}
      <ConfirmDialog
        isOpen={!!confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={eliminarSeleccionados}
        title="Eliminar productos seleccionados"
        message={`¿Seguro que deseas eliminar ${selectedIds.length} productos? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div >
  );
}
