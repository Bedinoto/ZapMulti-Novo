echo "Iniciando Deploy..."
git pull
# 1. Reconstrua e suba tudo novamente
npm install
npm run build
pm2 restart whatsapp-manager
echo -e "\n${BLUE}===> ATUALIZAÇÃO CONCLUÍDA COM SUCESSO! <===${NC}"