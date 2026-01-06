#!/usr/bin/env python3
"""
Script inteligente para asignar múltiples tags a productos.
Analiza cada producto y asigna:
1. Tag de conservación (Congelado, Refrigerado, Ambiente)
2. Tag(s) de tipo de producto
"""
import sqlite3
import re

# IDs de tags (según lo insertado en la BD)
TAGS = {
    # Conservación
    'congelado': 1,
    'refrigerado': 2,
    'ambiente': 3,
    # Tipo
    'carnes': 4,
    'aves': 5,
    'cerdo': 6,
    'pescados': 7,
    'embutidos': 8,
    'lacteos': 9,
    'verduras': 10,
    'frutas': 11,
    'pastas': 12,
    'comidas': 13,
    'postres': 14,
    'conservas': 15,
    'grasas': 16,
    'salsas': 17,
    'bebidas': 18,
    'panaderia': 19,
}

def clasificar_producto(nombre: str) -> list:
    """
    Clasifica un producto y devuelve lista de tag_ids.
    Cada producto puede tener múltiples tags.
    """
    tags = []
    n = nombre.upper()
    
    # === CLASIFICACIÓN POR TIPO DE PRODUCTO ===
    
    # EMBUTIDOS (fiambres, chacinados)
    embutidos_keywords = [
        'CHORIZO', 'SALAME', 'SALAMIN', 'MORTADELA', 'JAMON', 'PANCETA', 'BACON',
        'BONDIOLA', 'BUTIFARRA', 'CAPOCUELO', 'CHACARERO', 'LONGANIZA', 'MORCILLA',
        'LIONESA', 'PATE', 'HUNGARA', 'LOMITO', 'PALETA', 'FIAMBRE', 'FINCETA',
        'PANCHO', 'FRANKFURT', 'SALCHICHA', 'SOPRESATA', 'SALCHICHON', 'SCHNECK',
        'CENTENARIO', 'CARLITOS', 'ARIZONA', 'OTONELLO', 'DOÑA COCA', 'PIPPO',
        'MORTADELIN', 'CHICHARRON', 'AHUMADO'
    ]
    
    # AVES (pollo, pavo)
    aves_keywords = [
        'POLLO', 'PECHUGA', 'SUPREMA', 'MUSLO', 'ALITA', 'NUGGET DE POLLO',
        'MILANESA DE POLLO', 'MEDALLON DE POLLO', 'PAMPLONA DE POLLO',
        'ARROLLADO DE POLLO', 'HAMBURGUESA DE POLLO', 'PAVO'
    ]
    
    # CERDO
    cerdo_keywords = [
        'CERDO', 'PORCINO', 'LECHON', 'CARRE DE CERDO', 'GRASA DE CERDO',
        'CARNE PICADA DE CERDO', 'CHICHARRON DE CERDO'
    ]
    
    # CARNES (vacunas)
    carnes_keywords = [
        'CARNE PICADA COMUN', 'CARNE PICADA ESPECIAL', 'HAMBURGUESA BURGY',
        'HAMBURGUESA PATY', 'HAMBURGUESA SCHNECK', 'HAMBURGUESA TACUAREMBO',
        'HAMBURGUESA CENTENARIO', 'MATAMBRE', 'MILANESA DE CARNE', 
        'PULPA DE BONDIOLA', 'MATAMBRITO'
    ]
    
    # PESCADOS Y MARISCOS
    pescados_keywords = [
        'MERLUZA', 'SALMON', 'ATUN', 'CALAMAR', 'MARISCOS', 'CAMARON',
        'LANGOSTINO', 'PULPO', 'MEJILLON', 'PANGASIUS', 'FILET DE',
        'MIX DE MARISCOS', 'SURIMI'
    ]
    
    # LÁCTEOS
    lacteos_keywords = [
        'QUESO', 'MUZZA', 'MOZZARELLA', 'CHEDAR', 'CHEDDAR', 'DAMBO',
        'PROVOLONE', 'MANTECA', 'CREMA DE LECHE', 'LECHE ', 'YOGUR',
        'DULCE DE LECHE', 'REQUESON', 'RICOTA'
    ]
    
    # VERDURAS
    verduras_keywords = [
        'ACELGA', 'BROCOLI', 'BROCCOLI', 'ESPINACA', 'CHOCLO', 'MAIZ',
        'ARVEJA', 'CHAUCHA', 'ZANAHORIA', 'COLIFLOR', 'CEBOLLA', 'AJO',
        'ZAPALLO', 'CALABAZA', 'BONIATO', 'MORRON', 'PUERRO', 'ENSALADA',
        'VEGETALES', 'VERDURA', 'QUINOA', 'SOFRITO', 'SOPA DE VEGETALES'
    ]
    
    # PAPAS Y DERIVADOS (también verduras pero congeladas)
    papas_keywords = [
        'PAPA ', 'PAPAS', 'ROSTI', 'CROQUETA', 'NOISSETE', 'RAPIPAP',
        'PAPA PALHA', 'STEAKHOUSE'
    ]
    
    # FRUTAS
    frutas_keywords = [
        'FRUTILLA', 'ARANDANO', 'FRAMBUESA', 'MORA', 'ANANA', 'MANGO',
        'MARACUYA', 'FRUTOS ROJOS', 'FRUTOS DEL BOSQUE', 'CEREZA', 'BANANA'
    ]
    
    # PASTAS
    pastas_keywords = [
        'RAVIOLES', 'CAPELETI', 'SORRENTINO', 'ÑOQUI', 'GNOCCHI',
        'FETUCCINI', 'TALLARIN', 'CORBATITA', 'MOÑAS', 'TORTELIN',
        'CINTA', 'PASTA', 'SAN CONO', 'HAY PASTA', 'TERRUÑO'
    ]
    
    # COMIDAS PREPARADAS
    comidas_keywords = [
        'EMPANADA', 'PIZZA', 'TARTA', 'BURRITO', 'ARROLLADITO',
        'CHIVITO', 'BAURU', 'MILANESA DE SOJA', 'DELIGUMBRES',
        'HAMBURGUESA VEG', 'HAMBURGUESA DE ESPINACA', 'HAMBURGUESA DE QUINOA',
        'HAMBURGUESA DE REMOLACHA', 'HAMBURGUESA DE COLIFLOR',
        'TORTILLA', 'TOSTADA', 'RELLENO DE FAJITAS', 'SIN TACC'
    ]
    
    # POSTRES Y HELADOS
    postres_keywords = [
        'HELADO', 'POSTRE', 'BROWNIE', 'CAKE', 'VOLCAN', 'ALFAJOR',
        'MEDIALUNA', 'CHOMP', 'ANNIE', 'GELATINA', 'CHOCOLATITO'
    ]
    
    # CONSERVAS
    conservas_keywords = [
        'ACEITUNA', 'PICKLE', 'ENCURTIDO', 'MORRON EN VINAGRE',
        'MEMBRILLO', 'PALMITO'
    ]
    
    # GRASAS Y ACEITES
    grasas_keywords = [
        'ACEITE', 'GRASA', 'GORDURA', 'MANTECA ', 'TUBO DE GRASA'
    ]
    
    # SALSAS Y CONDIMENTOS
    salsas_keywords = [
        'SALSA', 'CHIMICHURRI', 'MAYONESA', 'KETCHUP', 'MOSTAZA',
        'HUMMUS', 'BARBACOA', 'CHILI'
    ]
    
    # BEBIDAS
    bebidas_keywords = [
        'JUGO', 'LECHE UHT', 'LECHE CHOCOLATADA', 'LECHE ENTERA',
        'LECHE DESCREMADA', 'LECHE DESLACTOSADA', 'BEBIBLE'
    ]
    
    # PANADERÍA
    panaderia_keywords = [
        'PAN DE HAMBURGUESA', 'PAN DE MOLDE', 'MEDIALUNA'
    ]
    
    # Asignar tags de tipo
    for kw in embutidos_keywords:
        if kw in n:
            tags.append(TAGS['embutidos'])
            break
    
    for kw in aves_keywords:
        if kw in n:
            tags.append(TAGS['aves'])
            break
    
    for kw in cerdo_keywords:
        if kw in n:
            tags.append(TAGS['cerdo'])
            break
    
    for kw in carnes_keywords:
        if kw in n:
            tags.append(TAGS['carnes'])
            break
    
    for kw in pescados_keywords:
        if kw in n:
            tags.append(TAGS['pescados'])
            break
    
    for kw in lacteos_keywords:
        if kw in n:
            tags.append(TAGS['lacteos'])
            break
    
    # Verduras (incluye papas)
    is_verdura = False
    for kw in verduras_keywords + papas_keywords:
        if kw in n:
            tags.append(TAGS['verduras'])
            is_verdura = True
            break
    
    for kw in frutas_keywords:
        if kw in n:
            tags.append(TAGS['frutas'])
            break
    
    for kw in pastas_keywords:
        if kw in n:
            tags.append(TAGS['pastas'])
            break
    
    for kw in comidas_keywords:
        if kw in n:
            tags.append(TAGS['comidas'])
            break
    
    for kw in postres_keywords:
        if kw in n:
            tags.append(TAGS['postres'])
            break
    
    for kw in conservas_keywords:
        if kw in n:
            tags.append(TAGS['conservas'])
            break
    
    for kw in grasas_keywords:
        if kw in n:
            tags.append(TAGS['grasas'])
            break
    
    for kw in salsas_keywords:
        if kw in n:
            tags.append(TAGS['salsas'])
            break
    
    for kw in bebidas_keywords:
        if kw in n:
            tags.append(TAGS['bebidas'])
            break
    
    for kw in panaderia_keywords:
        if kw in n:
            tags.append(TAGS['panaderia'])
            break
    
    # === CLASIFICACIÓN POR CONSERVACIÓN ===
    
    # Productos que son de AMBIENTE (no necesitan frío)
    ambiente_keywords = [
        'ACEITE', 'ACEITUNA', 'PICKLE', 'MEMBRILLO', 'CHIMICHURRI',
        'MAYONESA', 'KETCHUP', 'MOSTAZA', 'SALSA BARBACOA', 'SALSA CHILI',
        'GORDURA', 'PAN DE', 'GELATINA', 'DULCE DE LECHE',
        'QUESO RALLADO'
    ]
    
    # Productos REFRIGERADOS (no congelados)
    refrigerado_keywords = [
        'FRESCO', 'FRESCA', 'CREMOSO', 'REQUESON', 'YOGUR', 'YOGURT',
        'LECHE X', 'LECHE ENTERA X', 'LECHE DESCREMADA X', 'CREMA DE LECHE',
        'MUZZARELA', 'MUZZARELLA', 'MUZZA', 'DAMBO', 'PROVOLONE', 
        'QUESO MAGRO', 'QUESO BERNA', 'QUESO LOVER', 'QUESO UNTABLE',
        'QUESO CREMOSO', 'QUESO SANDWICHERO', 'MANTECA',
        'JUGO DE NARANJA NATURAL', 'JUGO MANZANA', 'JUGO NARANJA',
        # Fiambres/embutidos refrigerados (no congelados típicamente)
        'CENTENARIO', 'CARLITOS', 'ARIZONA', 'SCHNECK', 'OTONELLO',
        'DOÑA COCA', 'BOCHA', 'VACIO', 'FETAS', 'FETEADO'
    ]
    
    # Por defecto, determinar conservación
    conservacion_tag = TAGS['congelado']  # Default para casa de congelados
    
    for kw in ambiente_keywords:
        if kw in n:
            conservacion_tag = TAGS['ambiente']
            break
    
    # Si no es ambiente, verificar si es refrigerado
    if conservacion_tag != TAGS['ambiente']:
        for kw in refrigerado_keywords:
            if kw in n:
                conservacion_tag = TAGS['refrigerado']
                break
    
    # Productos específicos que SÍ son congelados aunque tengan palabras de refrigerado
    congelado_forzado = [
        'CONGELAD', 'X2.5KG', 'X3KG', 'X6KG', 'X4KG', 'X1KG', 'X2KG',
        'ARDO', 'ODC', 'VIRTO', 'FARM FRITE', 'FROSUR', 'BAITA',
        'SADIA', 'FRANGOSUL', 'TACUAREMBO', 'SANTA CLARA',
        'CROQUETA', 'ROSTI', 'PAPA ', 'MEDALLON', 'MILANESA', 
        'NUGGET', 'HAMBURGUESA', 'RAVIOLES', 'CAPELETI', 'SORRENTINO',
        'ÑOQUI', 'TALLARIN', 'FETUCCINI', 'HELADO', 'POSTRE GIO',
        'FORMITAS', 'FILET DE', 'MIX DE MARISCOS', 'PANGASIUS',
        'ENSALADA ', 'VEGETALES', 'FRUTOS', 'FRUTILLA', 'ARANDANO'
    ]
    
    for kw in congelado_forzado:
        if kw in n:
            conservacion_tag = TAGS['congelado']
            break
    
    tags.append(conservacion_tag)
    
    # Si no tiene ningún tag de tipo, asignar uno genérico basado en conservación
    tipo_tags = [t for t in tags if t >= 4]  # Tags de tipo empiezan en 4
    if not tipo_tags:
        # Producto sin clasificar, intentar categoría por defecto
        if conservacion_tag == TAGS['congelado']:
            tags.append(TAGS['comidas'])  # Comidas preparadas por defecto
    
    return list(set(tags))  # Eliminar duplicados


def main():
    db_path = "data/ventas.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener todos los productos
    cursor.execute("""
        SELECT id, nombre FROM productos 
        WHERE nombre NOT LIKE '%Test%' 
        AND nombre NOT LIKE '%E2E%'
    """)
    productos = cursor.fetchall()
    
    print(f"📦 Analizando {len(productos)} productos...")
    print("-" * 60)
    
    # Limpiar tags existentes
    cursor.execute("DELETE FROM productos_tags")
    
    # Estadísticas
    stats = {tag_id: 0 for tag_id in TAGS.values()}
    ejemplos = {tag_id: [] for tag_id in TAGS.values()}
    
    # Clasificar cada producto
    for prod_id, nombre in productos:
        tags = clasificar_producto(nombre)
        for tag_id in tags:
            cursor.execute(
                "INSERT OR IGNORE INTO productos_tags (producto_id, tag_id) VALUES (?, ?)",
                (prod_id, tag_id)
            )
            stats[tag_id] += 1
            if len(ejemplos[tag_id]) < 3:
                ejemplos[tag_id].append(nombre)
    
    conn.commit()
    
    # Obtener nombres de tags
    cursor.execute("SELECT id, nombre, tipo FROM tags ORDER BY tipo, id")
    tags_info = cursor.fetchall()
    
    # Mostrar resultados
    print("\n📊 RESUMEN DE CLASIFICACIÓN CON MÚLTIPLES TAGS:")
    print("=" * 60)
    
    current_tipo = None
    for tag_id, tag_nombre, tipo in tags_info:
        if tipo != current_tipo:
            current_tipo = tipo
            print(f"\n{'CONSERVACIÓN' if tipo == 'conservacion' else 'TIPO DE PRODUCTO'}:")
            print("-" * 40)
        
        count = stats.get(tag_id, 0)
        if count > 0:
            print(f"  {tag_nombre}: {count} productos")
            for ej in ejemplos.get(tag_id, []):
                print(f"    → {ej[:50]}...")
    
    # Verificar productos con múltiples tags
    cursor.execute("""
        SELECT p.nombre, GROUP_CONCAT(t.nombre, ', ') as tags
        FROM productos p
        JOIN productos_tags pt ON p.id = pt.producto_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE p.nombre NOT LIKE '%Test%'
        GROUP BY p.id
        HAVING COUNT(pt.tag_id) >= 3
        LIMIT 10
    """)
    multi_tag = cursor.fetchall()
    
    print("\n\n🏷️ EJEMPLOS DE PRODUCTOS CON 3+ TAGS:")
    print("=" * 60)
    for nombre, tags in multi_tag:
        print(f"  • {nombre[:45]}...")
        print(f"    Tags: {tags}")
    
    print(f"\n✅ ¡{len(productos)} productos clasificados con múltiples tags!")
    
    conn.close()


if __name__ == "__main__":
    main()
