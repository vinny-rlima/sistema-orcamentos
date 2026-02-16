# Usa imagem oficial do Node
FROM node:18

# Cria diretório dentro do container
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro
COPY package*.json ./

# Instala dependências
COPY . .

# Copia o restante do backend
COPY backend .

# Expõe a porta (Railway usa 3000 normalmente)
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
