#!/bin/bash
# Script para verificar backups automáticos en producción
# Ejecutar: ./check-backups-prod.sh

echo "=== VERIFICACIÓN DE BACKUPS AUTOMÁTICOS ==="
echo ""

echo "1️⃣ Configuración esperada:"
echo "   - Hora alineada: 01:00 UTC (22:00 Uruguay)"
echo "   - Intervalo: cada 6 horas"
echo "   - Retención: 10 backups"
echo ""

echo "2️⃣ Último backup esperado:"
# Calcular última hora alineada (01:00 UTC o 22:00 del día anterior Uruguay)
CURRENT_UTC_HOUR=$(date -u +%H)
if [ "$CURRENT_UTC_HOUR" -ge 1 ]; then
    LAST_BACKUP_DATE=$(date -u +"%Y-%m-%d 01:00 UTC")
else
    LAST_BACKUP_DATE=$(date -u -d "yesterday" +"%Y-%m-%d 01:00 UTC")
fi
echo "   $LAST_BACKUP_DATE"
echo ""

echo "3️⃣ Verificando endpoint de backups:"
TOKEN="${ADMIN_TOKEN:-}"
if [ -z "$TOKEN" ]; then
    echo "   ⚠️  Variable ADMIN_TOKEN no configurada"
    echo "   Ejecuta: export ADMIN_TOKEN=tu_token_admin"
    echo ""
    echo "   Para obtener token:"
    echo "   curl -X POST https://api.pedidosfriosur.com/api/login \\"
    echo "     -H 'Content-Type: application/x-www-form-urlencoded' \\"
    echo "     -d 'username=admin&password=TU_PASSWORD'"
else
    echo "   Listando backups disponibles..."
    curl -s -H "Authorization: Bearer $TOKEN" \
        "https://api.pedidosfriosur.com/api/backups" | \
        python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'backups' in data:
        backups = data['backups']
        print(f'   ✅ {len(backups)} backups encontrados')
        if backups:
            print('\n   Últimos 3 backups:')
            for b in backups[:3]:
                print(f'   - {b[\"filename\"]} ({b[\"size_human\"]}) - {b[\"created_at\"]}')
    else:
        print('   ❌ Respuesta inesperada:', data)
except Exception as e:
    print(f'   ❌ Error: {e}')
" || echo "   ❌ Error al consultar backups"
fi

echo ""
echo "4️⃣ Estado del scheduler:"
echo "   Verificar logs de Render para mensajes como:"
echo "   - 'backup_scheduler': 'started'"
echo "   - 'Backup completed successfully'"
echo "   - 'Triggering aligned backup at 01:00 UTC'"
echo ""

echo "=== FIN DE VERIFICACIÓN ==="
