# 🔐 SECRET_KEY Rotation Guide

## ✅ COMPLETADO - Enero 7, 2026

El `SECRET_KEY` anterior fue expuesto en el historial de git:
```
CbkCQmbpKKVQaG2NaEWzfJ9B3ijEAa-PFeIYh3ReSys  ← COMPROMETIDO (ya no se usa)
```

**Estado actual:**
- ✅ **Producción (Render):** Usa `igv9vHDUMejAp92WmbQ24VYfNVtR8-XdXjhfiRCSD7A` (en Secret File)
- ✅ **Local (.env):** Usa `LOCAL_DEV_ONLY_k8mP2xQ9vL5nR7wT3yA6bC1dE4fG0hJ`

## Pasos Completados

### 1. Generar nuevo SECRET_KEY
```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

### 2. Actualizar en Producción

**Si usas Render:**
1. Ir a Dashboard → Environment → Environment Variables
2. Editar `SECRET_KEY` con el nuevo valor
3. Guardar y hacer redeploy

**Si usas Docker/VPS:**
1. Editar el archivo `.env` en el servidor
2. Reiniciar el contenedor: `docker-compose restart backend`

### 3. Efectos de la Rotación
- ✅ Todos los tokens JWT existentes serán invalidados
- ✅ Los usuarios deberán hacer login nuevamente
- ✅ Esto es el comportamiento esperado y seguro

## Verificación
```bash
# Probar que el nuevo secret funciona
curl -X POST https://tu-dominio.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu_password"}'
```

## Limpieza del Historial (Opcional)

Para eliminar el secret del historial de git:

```bash
# Opción 1: git-filter-repo (recomendado)
pip install git-filter-repo
git filter-repo --replace-text <(echo 'CbkCQmbpKKVQaG2NaEWzfJ9B3ijEAa-PFeIYh3ReSys==>REDACTED')

# Opción 2: BFG Repo Cleaner
bfg --replace-text <(echo 'CbkCQmbpKKVQaG2NaEWzfJ9B3ijEAa-PFeIYh3ReSys') .
```

⚠️ **IMPORTANTE**: La limpieza del historial requiere `git push --force` y afecta a todos los colaboradores.
