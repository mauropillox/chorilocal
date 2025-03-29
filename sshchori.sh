#!/bin/bash
set -e

KEY_PATH="$HOME/.ssh/llavenueva.pem"
PUBLIC_IP=3.14.2.178
LOCAL_ENV_PATH=".env"

if [ ! -f "$KEY_PATH" ]; then
  echo "❌ No se encontró la clave privada en $KEY_PATH"
  exit 1
fi

if [ ! -f "$LOCAL_ENV_PATH" ]; then
  echo "⚠️ No se encontró el archivo .env local en $LOCAL_ENV_PATH"
  exit 1
fi

# Conectar por SSH directamente, instalar todo lo necesario y preparar entorno
echo "🔐 Conectando a ec2-user@$PUBLIC_IP..."
ssh -t -i "$KEY_PATH" ec2-user@"$PUBLIC_IP" <<'ENDSSH'
  set -e

  echo "🔍 Verificando herramientas necesarias..."
  if ! command -v git &>/dev/null; then
    echo "📦 Instalando git..."
    sudo yum install -y git
  fi

  if ! command -v docker &>/dev/null; then
    echo "📦 Instalando Docker..."
    sudo yum install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker ec2-user
  fi

  if ! docker compose version &>/dev/null; then
    echo "📦 Instalando Docker Compose V2..."
    sudo mkdir -p /usr/libexec/docker/cli-plugins
    sudo curl -SL https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-linux-x86_64 \
      -o /usr/libexec/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
  fi

  if ! command -v certbot &>/dev/null; then
    echo "📦 Instalando Certbot..."
    sudo yum install -y certbot
  fi

  echo "📁 Preparando proyecto..."
  if [ ! -d chorizaurio ]; then
    echo "📥 Clonando repositorio..."
    git clone https://github.com/mauropillox/chorizaurio.git
    cd chorizaurio
  else
    echo "🔄 Repositorio ya clonado. Limpiando y actualizando..."
    cd chorizaurio
    git reset --hard HEAD
    git clean -fd
    git pull
  fi

  echo "🔒 Verificando certificados SSL..."
  CERT_DIR="/etc/letsencrypt/live/pedidosfriosur.com"
  NEED_RENEW=false

  if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
    echo "🚫 Certificados no encontrados en $CERT_DIR"
    NEED_RENEW=true
  else
    echo "🧪 Probando si el certificado necesita renovación..."
    if ! sudo certbot renew --dry-run | grep -q "No renewals were attempted"; then
      echo "🔁 Certificado necesita renovación"
      NEED_RENEW=true
    else
      echo "✅ Certificado válido, sin necesidad de renovar"
    fi
  fi

  if [ "$NEED_RENEW" = true ]; then
    echo "🔧 Renovando o generando certificado SSL..."
    sudo docker compose down || true
    sudo fuser -k 80/tcp || true
    sudo fuser -k 443/tcp || true
    sudo certbot certonly --standalone -d pedidosfriosur.com -d www.pedidosfriosur.com --non-interactive --agree-tos -m contacto@pedidosfriosur.com
  else
    echo "✅ Certificados SSL ya presentes y válidos."
  fi

  echo "🗂️ Copiando certificados a carpeta certs/ del proyecto..."
  mkdir -p certs
  sudo cp /etc/letsencrypt/live/pedidosfriosur.com/fullchain.pem certs/
  sudo cp /etc/letsencrypt/live/pedidosfriosur.com/privkey.pem certs/
  sudo chown ec2-user:ec2-user certs/*.pem
  chmod 644 certs/*.pem
ENDSSH

# Subir el archivo .env al nivel adecuado del proyecto
echo "📤 Copiando .env al servidor remoto..."
scp -i "$KEY_PATH" "$LOCAL_ENV_PATH" ec2-user@"$PUBLIC_IP":/home/ec2-user/chorizaurio/.env || {
  echo "⚠️ No se pudo copiar .env automáticamente"
  exit 1
}

# Volver a conectarse y ejecutar deploy.sh desde el directorio clonado
echo "🏃 Ejecutando deploy.sh remotamente..."
ssh -t -i "$KEY_PATH" ec2-user@"$PUBLIC_IP" <<'ENDSSH'
  set -e
  cd chorizaurio
  echo "📄 Archivos disponibles:"
  ls -l

  if [ ! -f deploy.sh ]; then
    echo "❌ No se encontró deploy.sh"
    exit 1
  fi

  chmod +x deploy.sh

  if [ ! -f migrar_db.py ]; then
    sed -i '/migrar_db\.py/d' deploy.sh
  fi

  ./deploy.sh

  echo "📦 Logs de contenedores activos:"
  docker ps
  docker compose logs --tail=100
ENDSSH

# 🔁 Conexión interactiva final
echo "✅ Deploy finalizado. Conectando a la instancia para trabajar manualmente..."
ssh -i "$KEY_PATH" ec2-user@"$PUBLIC_IP"
