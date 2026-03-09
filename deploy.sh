echo "Iniciando Deploy..."
git pull
# 1. Pare os containers
docker-compose down
# 2. Reconstrua e suba tudo novamente
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart whatsapp-manager
#docker-compose up -d --build
echo -e "\n${BLUE}===> ATUALIZAÇÃO CONCLUÍDA COM SUCESSO! <===${NC}"