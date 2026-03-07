#!/bin/bash

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # Sem cor

echo -e "${BLUE}===> Iniciando Atualização Automática <===${NC}"

# 1. Puxar código do Git
echo -e "\n${GREEN}[1/5] Puxando mudanças do Git...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao puxar código do Git. Verifique sua conexão ou credenciais.${NC}"
    exit 1
fi

# 2. Instalar dependências
echo -e "\n${GREEN}[2/5] Instalando dependências...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao instalar dependências.${NC}"
    exit 1
fi

# 3. Gerar Prisma Client
echo -e "\n${GREEN}[3/5] Gerando Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao gerar Prisma Client.${NC}"
    exit 1
fi

# 4. Build do Next.js
echo -e "\n${GREEN}[4/5] Compilando o projeto (Build)...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao compilar o projeto.${NC}"
    exit 1
fi

# 5. Reiniciar PM2
echo -e "\n${GREEN}[5/5] Reiniciando o servidor no PM2...${NC}"
# Tenta reiniciar pelo nome comum, se falhar reinicia tudo
pm2 restart whatsapp-manager || pm2 restart all

echo -e "\n${BLUE}===> ATUALIZAÇÃO CONCLUÍDA COM SUCESSO! <===${NC}"
