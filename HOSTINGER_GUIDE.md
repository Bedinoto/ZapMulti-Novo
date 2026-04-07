# Guia de Instalação na Hostinger (Hospedagem Compartilhada)

Como você não está usando uma VPS, o processo é mais simples. Siga estes passos:

### 1. Banco de Dados (phpMyAdmin)
1. No painel da Hostinger, crie um banco de dados MySQL (você já fez isso).
2. **IMPORTANTE:** Vá em **Remote MySQL** e adicione o IP `34.96.52.88` (ou use `%` para todos) para permitir que o AI Studio se conecte ao seu banco.
3. Abra o **phpMyAdmin**.
3. Selecione o seu banco de dados.
4. Vá na aba **Importar**.
5. Selecione o arquivo `setup.sql` que está na raiz deste projeto e clique em **Executar**.
   *Isso criará todas as tabelas e o usuário administrador automaticamente.*

### 2. Configuração do Node.js na Hostinger
1. No painel da Hostinger, procure por **Configuração do Node.js**.
2. Selecione a versão do Node.js (recomendo a 20 ou 22).
3. No campo **Application Entry Point**, coloque: `dist/server.js`.
4. No campo **Application Root**, coloque a pasta onde você subiu os arquivos.

### 3. Variáveis de Ambiente
No painel da Hostinger, adicione as seguintes variáveis (as do banco não precisam mais, pois já integramos o IP 193.203.175.236 no código):
- `NODE_ENV`: `production`
- `JWT_SECRET`: `uma-frase-longa-e-aleatoria`
- `UAZAPI_SERVER_URL`: `https://bedinoto.uazapi.com`
- `UAZAPI_ADMIN_TOKEN`: `FGizKQFZpeTF4JqniyftBamjjEV0ZWgAMIApkIaOnsN9yZjsXe`
- `UAZAPI_INSTANCE_NAME`: `celular`
- `UAZAPI_INSTANCE_TOKEN`: `a5fdab6f-0e1d-407c-aa4e-e6b44f935509`
- `UAZAPI_WEBHOOK_URL`: `https://[SEU-DOMINIO]/api/uazapi/webhook`

### 4. Como subir os arquivos
1. Faça o download do projeto completo aqui no AI Studio.
2. Certifique-se de que a pasta `dist` e a pasta `.next` existam (eu já gerei o build para você).
3. Suba todos os arquivos via FTP ou Gerenciador de Arquivos da Hostinger.
4. Clique em **Run NPM Install** no painel da Hostinger (se disponível) ou apenas inicie a aplicação.

**Nota:** O arquivo `dist/server.js` é o arquivo compilado que a Hostinger vai rodar. Ele já contém toda a lógica do servidor e do Next.js integrada.
