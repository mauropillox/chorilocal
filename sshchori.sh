#!/bin/bash
set -e

KEY_PATH=~/.ssh/llavenueva.pem
PUBLIC_IP=3.14.2.178

if [ ! -f "$KEY_PATH" ]; then
  echo "❌ No se encontró la clave privada en $KEY_PATH"
  exit 1
fi

# Conectar por SSH directamente y ejecutar deploy.sh
echo "🔐 Conectando a ec2-user@$PUBLIC_IP..."
ssh -i "$KEY_PATH" ec2-user@"$PUBLIC_IP" <<'ENDSSH'
  set -e
  if [ ! -d chorizaurio ]; then
    echo "Clonando repositorio..."
    git clone https://github.com/mauropillox/chorizaurio.git
  fi
  cd chorizaurio
  echo "🏃 Ejecutando deploy.sh remotamente..."
  chmod +x deploy.sh
  ./deploy.sh
ENDSSH

echo "✅ Listo. Infra y contenedores corriendo."
