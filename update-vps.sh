#!/bin/bash

# --- CONFIGURAÇÕES ---
PROJECT_DIR="zap/ZapMulti-Novo"
DOCKER_COMPOSE_FILE="docker-compose.yml"

echo "🚀 Iniciando atualização do WhatsApp Manager em $PROJECT_DIR..."

# 1. Entrar no diretório do projeto
cd $PROJECT_DIR || { echo "❌ Erro: Diretório $PROJECT_DIR não encontrado"; exit 1; }

# 2. Puxar as últimas alterações do Git
echo "📥 Puxando atualizações do repositório..."
git pull origin main

# 3. Reconstruir a imagem Docker (sem usar cache para garantir as novas alterações)
echo "🛠️ Reconstruindo imagens Docker..."
docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache

# 4. Reiniciar os containers em modo background
echo "🔄 Reiniciando containers..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# 5. Limpeza de imagens antigas (opcional, para economizar espaço na VPS)
echo "🧹 Limpando imagens antigas não utilizadas..."
docker image prune -f

echo "✅ Atualização concluída com sucesso!"
