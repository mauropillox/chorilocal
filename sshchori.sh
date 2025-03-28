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

# Conectar por SSH directamente, instalar todo lo necesario y clonar repositorio
echo "🔐 Conectando a ec2-user@$PUBLIC_IP..."
ssh -t -i "$KEY_PATH" ec2-user@"$PUBLIC_IP" 'bash -c "
  set -e

  echo \"🔍 Verificando herramientas necesarias...\"
  if ! command -v git &>/dev/null; then
    echo \"📦 Instalando git...\"
    sudo yum install -y git
  fi

  if ! command -v docker &>/dev/null; then
    echo \"📦 Instalando Docker...\"
    sudo yum install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker ec2-user
  fi

  if ! docker compose version &>/dev/null; then
    echo \"📦 Instalando Docker Compose V2...\"
    sudo mkdir -p /usr/libexec/docker/cli-plugins
    sudo curl -SL https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-linux-x86_64 \
      -o /usr/libexec/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
  fi

  echo \"📁 Preparando proyecto...\"
  if [ ! -d chorizaurio ]; then
    echo \"📥 Clonando repositorio...\"
    git clone https://github.com/mauropillox/chorizaurio.git
    cd chorizaurio
  else
    echo \"🔄 Repositorio ya clonado. Actualizando...\"
    cd chorizaurio
    git pull
  fi
"'

# Subir el archivo .env ahora que el repositorio ya está clonado en la instancia
echo "📤 Copiando .env al servidor remoto..."
scp -i "$KEY_PATH" "$LOCAL_ENV_PATH" ec2-user@"$PUBLIC_IP":/home/ec2-user/chorizaurio/.env || {
  echo "⚠️ No se pudo copiar .env automáticamente"
  exit 1
}

# Volver a conectarse y ejecutar deploy
echo "🏃 Ejecutando deploy.sh remotamente..."
ssh -t -i "$KEY_PATH" ec2-user@"$PUBLIC_IP" 'bash -c "
  set -e
  cd chorizaurio
  chmod +x deploy.sh
  ./deploy.sh
  exec bash
"'

echo "✅ Todo listo. Ya estás conectado a la instancia."
