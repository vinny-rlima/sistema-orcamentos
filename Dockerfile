# Usa imagem oficial do Python
FROM python:3.11

# Define diretório de trabalho
WORKDIR /app

# Copia requirements do backend
COPY backend/requirements.txt .

# Instala dependências
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do backend
COPY backend .

# Expõe a porta usada pelo Railway
EXPOSE 8080

# Comando para iniciar FastAPI
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
