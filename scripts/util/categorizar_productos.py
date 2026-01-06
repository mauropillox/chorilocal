#!/usr/bin/env python3
"""
Script para categorizar productos automáticamente usando IA basada en reglas.
Analiza el nombre del producto y asigna la categoría más apropiada.
"""
import sqlite3
import re

# Categorías disponibles
CATEGORIAS = {
    1: "🥩 Carnes Vacunas",
    2: "🐷 Cerdo", 
    3: "🐔 Pollo",
    4: "🌭 Embutidos",
    5: "🧀 Lácteos",
    6: "🥚 Otros",
    7: "❄️ Congelados",
    8: "📦 Mayorista"
}

# Reglas de clasificación por palabras clave (orden de prioridad)
REGLAS = [
    # EMBUTIDOS (prioridad alta - son específicos)
    (4, ["CHORIZO", "SALAME", "MORTADELA", "JAMON", "PANCETA", "BACON", "BONDIOLA", 
         "BUTIFARRA", "CAPOCUELO", "CHACARERO", "SALAMIN", "LONGANIZA", "SALAMINES",
         "FRANKFURT", "SALCHICHA", "VIENA", "HOT DOG", "PANCHO", "PATE", "LEBERWURST",
         "MORCILLA", "MONDONGO", "FIAMBRE", "PICADILLO", "PASTRAMI", "PEPPERONI",
         "CANTIMPALO", "FUET", "SOBRASADA", "COPPA", "BRESAOLA", "PROSCIUTTO",
         "SCHNECK", "AHUMADO", "ESPETO", "GOURMET", "CHICHARRON"]),
    
    # POLLO
    (3, ["POLLO", "PECHUGA", "MUSLO", "ALA ", "ALAS ", "SUPREMA", "MEDALLONES DE POLLO",
         "NUGGET", "MILANESA DE POLLO", "CHICKEN", "ARROLLADO DE POLLO", "BIFE DE POLLO"]),
    
    # CERDO
    (2, ["CERDO", "PORCINO", "LECHON", "CARRE DE CERDO", "BONDIOLA", "COSTILLA DE CERDO",
         "SOLOMILLO", "CODILLO", "SECRETO IBERICO", "LOMO DE CERDO", "PORK"]),
    
    # CARNES VACUNAS  
    (1, ["VACUNO", "RES", "BIFE", "ASADO", "COSTILLA", "ENTRAÑA", "VACIO", "LOMO",
         "NALGA", "CUADRIL", "PECETO", "PALETA", "MATAMBRE", "OSOBUCO", "MONDONGO",
         "CARNE PICADA", "HAMBURGUESA", "PICANHA", "TOMAHAWK", "T-BONE", "RIBEYE",
         "NEW YORK", "TENDERLOIN", "ROAST BEEF", "STEAK"]),
    
    # LÁCTEOS
    (5, ["QUESO", "MUZZA", "MOZZARELLA", "CHEDAR", "CHEDDAR", "PARMESANO", "PROVOLONE",
         "DAMBO", "COLONIA", "ROQUEFORT", "BRIE", "CAMEMBERT", "GOUDA", "EDAM",
         "GRUYERE", "EMMENTAL", "RICOTTA", "MASCARPONE", "CREMA", "LECHE", "YOGUR",
         "MANTECA", "DULCE DE LECHE"]),
    
    # PESCADOS Y MARISCOS -> Congelados
    (7, ["MERLUZA", "SALMON", "ATUN", "CALAMAR", "MARISCOS", "CAMARON", "LANGOSTINO",
         "PULPO", "MEJILLON", "VIEIRA", "PANGASIUS", "TILAPIA", "SURIMI", "CANGREJO",
         "FILET DE", "MEDALLON DE MERLUZA", "MILANESA DE MERLUZA"]),
    
    # VERDURAS Y PAPAS -> Congelados
    (7, ["PAPA ", "PAPAS", "ROSTI", "CROQUETA", "NOISSETE", "ACELGA", "BROCOLI", 
         "ESPINACA", "CHOCLO", "ARVEJA", "CHAUCHA", "ZANAHORIA", "COLIFLOR", "CEBOLLA",
         "AJO ", "ZAPALLO", "CALABAZA", "BONIATO", "VEGETALES", "VERDURA", "MIX DE",
         "BABY CARROTS", "PUERRO", "REMOLACHA", "NABO", "APIO", "BERENJENA"]),
    
    # FRUTAS -> Congelados
    (7, ["FRUTILLA", "ARANDANO", "FRAMBUESA", "MORA", "DURAZNO", "ANANA", "MANGO",
         "FRUTA", "PULPA DE", "BERRY", "CEREZA"]),
    
    # PASTAS -> Congelados
    (7, ["RAVIOLES", "CAPELETI", "SORRENTINO", "ÑOQUI", "FETUCCINI", "TALLARINES",
         "LASAGNA", "CANELONE", "TORTELLINI", "GNOCCHI", "PASTA"]),
    
    # COMIDAS PREPARADAS -> Congelados
    (7, ["EMPANADA", "PIZZA", "TARTA", "PASCUALINA", "TORTILLA", "CROQUETA", 
         "BURRITO", "TACO", "CANELONE", "LASAÑA", "MILANESA", "MEDALLONES",
         "FORMITAS", "BASTONES", "PALITOS", "REBOZADO", "ARROLLADITO", "BAURU",
         "CHIVITO", "HAMBURGUESA", "NUGGET", "BOCADITO"]),
    
    # HELADOS Y POSTRES -> Congelados
    (7, ["HELADO", "POSTRE", "BROWNIE", "TORTA", "ALFAJOR", "CHOCOLATE", "FLAN",
         "MOUSSE", "CHEESECAKE", "TIRAMISU", "PROFITEROL"]),
    
    # SALSAS Y CONDIMENTOS -> Otros
    (6, ["SALSA", "CHIMICHURRI", "MAYONESA", "KETCHUP", "MOSTAZA", "ACEITE",
         "VINAGRE", "ADEREZO", "CONDIMENTO", "ESPECIAS", "SAL ", "PIMIENTA"]),
    
    # ACEITUNAS Y CONSERVAS -> Otros
    (6, ["ACEITUNA", "CONSERVA", "ENCURTIDO", "PICKLE", "PALMITO"]),
]

def clasificar_producto(nombre: str) -> int:
    """Clasifica un producto basándose en su nombre."""
    nombre_upper = nombre.upper()
    
    for categoria_id, palabras_clave in REGLAS:
        for palabra in palabras_clave:
            if palabra in nombre_upper:
                return categoria_id
    
    # Default: Congelados (es una casa de congelados después de todo)
    return 7

def main():
    db_path = "data/ventas.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener productos sin categoría
    cursor.execute("""
        SELECT id, nombre FROM productos 
        WHERE categoria_id IS NULL 
        AND nombre NOT LIKE '%Test%' 
        AND nombre NOT LIKE '%E2E%'
    """)
    productos = cursor.fetchall()
    
    print(f"📦 Encontrados {len(productos)} productos sin categoría")
    print("-" * 60)
    
    # Clasificar y mostrar estadísticas
    clasificaciones = {cat_id: [] for cat_id in CATEGORIAS.keys()}
    
    for prod_id, nombre in productos:
        cat_id = clasificar_producto(nombre)
        clasificaciones[cat_id].append((prod_id, nombre))
    
    # Mostrar resumen
    print("\n📊 RESUMEN DE CLASIFICACIÓN:")
    print("-" * 60)
    for cat_id, cat_nombre in CATEGORIAS.items():
        count = len(clasificaciones[cat_id])
        if count > 0:
            print(f"{cat_nombre}: {count} productos")
    
    # Mostrar algunos ejemplos por categoría
    print("\n📝 EJEMPLOS POR CATEGORÍA:")
    print("-" * 60)
    for cat_id, cat_nombre in CATEGORIAS.items():
        prods = clasificaciones[cat_id]
        if prods:
            print(f"\n{cat_nombre}:")
            for prod_id, nombre in prods[:5]:  # Mostrar hasta 5 ejemplos
                print(f"  - {nombre}")
            if len(prods) > 5:
                print(f"  ... y {len(prods) - 5} más")
    
    # Pedir confirmación
    print("\n" + "=" * 60)
    respuesta = input("¿Aplicar estas categorías a la base de datos? (s/n): ")
    
    if respuesta.lower() == 's':
        # Aplicar cambios
        updates = 0
        for cat_id, prods in clasificaciones.items():
            for prod_id, nombre in prods:
                cursor.execute(
                    "UPDATE productos SET categoria_id = ? WHERE id = ?",
                    (cat_id, prod_id)
                )
                updates += 1
        
        conn.commit()
        print(f"\n✅ ¡{updates} productos actualizados exitosamente!")
    else:
        print("\n❌ Operación cancelada.")
    
    conn.close()

if __name__ == "__main__":
    main()
