# Here are your Instructions

Vou continuar explicando as melhores opções para hospedar sua plataforma **100% GRATUITA**:

## 🎯 **RECOMENDAÇÃO PRINCIPAL: RAILWAY** 

### ✅ **Por que Railway é a MELHOR opção:**
- ✅ **Deploy automático** - só fazer upload do código
- ✅ **Suporte nativo** a Python + MongoDB
- ✅ **$5/mês GRATUITO** (suficiente para uso pessoal)
- ✅ **Zero configuração** - funciona direto
- ✅ **URL personalizada** - ex: `meus-orcamentos.railway.app`

---

## 📂 **ARQUIVOS QUE VOCÊ PRECISA BAIXAR**

### **Backend (server.py):**
```python
# O arquivo /app/backend/server.py que desenvolvemos
# Contém toda a API FastAPI com autenticação
```

### **Frontend (app):**
```typescript  
# O arquivo /app/frontend/app/index.tsx
# Interface React completa com login
```

### **Dependências:**
```txt
# /app/backend/requirements.txt
# /app/frontend/package.json
```

---

## 🚀 **PASSO A PASSO COMPLETO - RAILWAY**

### **PASSO 1: Preparar os arquivos**
1. **Crie uma pasta** no seu computador: `meus-orcamentos`
2. **Dentro dela, crie duas pastas**: `backend` e `frontend`

### **PASSO 2: Backend**
Na pasta `backend`, crie estes arquivos:

**📄 server.py** (copie o código do backend que desenvolvemos)
**📄 requirements.txt:**
```txt
fastapi==0.104.1
motor==3.3.1
pymongo==4.5.0
uvicorn==0.24.0
python-dotenv==1.0.0
pydantic==2.4.2
python-multipart==0.0.6
reportlab==4.0.7
pyjwt==2.8.0
pillow==10.1.0
```

### **PASSO 3: Frontend**  
Na pasta `frontend`, crie:

**📄 package.json:**
```json
{
  "name": "orcamentos-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "expo export:web",
    "start": "expo start --web"
  },
  "dependencies": {
    "expo": "^52.0.0",
    "react": "19.0.0",
    "react-native": "0.79.5",
    "react-native-web": "^0.20.0",
    "@react-native-async-storage/async-storage": "^2.1.0"
  }
}
```

**📄 app/index.tsx** (copie todo o código frontend que desenvolvemos)

### **PASSO 4: Arquivo de configuração Railway**
Na raiz do projeto, crie:

**📄 railway.json:**
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd backend && python -m uvicorn server:app --host 0.0.0.0 --port $PORT"
  }
}
```

---

## 🌐 **FAZENDO O DEPLOY NO RAILWAY**

### **1. Criar conta:**
- Acesse: https://railway.app
- Clique "Sign up with GitHub"
- Autorize o Railway

### **2. Subir arquivos pro GitHub:**
```bash
# No seu computador:
git init
git add .
git commit -m "Sistema de orçamentos"
git remote add origin https://github.com/SEUUSERNAME/meus-orcamentos.git
git push -u origin main
```

### **3. Deploy no Railway:**
1. No Railway: "New Project"
2. "Deploy from GitHub repo"  
3. Selecione seu repositório
4. **Pronto!** Railway detecta Python automaticamente

### **4. Adicionar MongoDB:**
1. No painel do projeto: "Add Service"
2. Escolha "MongoDB"
3. Será criado automaticamente
4. Copie a URL de conexão

### **5. Configurar variáveis:**
Na aba "Variables" do seu projeto:
```
MONGO_URL=mongodb://mongo:27017/orcamentos
DB_NAME=orcamentos_db
JWT_SECRET=minha-chave-super-secreta-123
PORT=8000
```

### **6. Acessar sua aplicação:**
- URL será: `https://meus-orcamentos-production.railway.app`
- Login: **admin** / **admin123**

---

## ⚡ **ALTERNATIVAS GRATUITAS**

### **OPÇÃO 2: Render + MongoDB Atlas**
```
1. Backend: https://render.com (gratuito)
2. Database: https://mongodb.com/atlas (512MB gratuito)  
3. Frontend: Netlify/Vercel (gratuito)
```

### **OPÇÃO 3: Heroku (se voltar gratuito)**
```
1. heroku create meus-orcamentos
2. heroku addons:create mongolab:sandbox
3. git push heroku main
```

### **OPÇÃO 4: Google Cloud (créditos grátis)**
```
$300 em créditos por 90 dias
Cloud Run + Cloud SQL
```

---

## 💡 **DICAS IMPORTANTES**

### **✅ Vantagens do Railway:**
- **Mais fácil** para iniciantes
- **MongoDB incluso** (não precisa configurar separado)
- **Deploy automático** a cada commit
- **Logs em tempo real**
- **SSL gratuito** (HTTPS)

### **📊 Limites gratuitos:**
- **Railway**: $5/mês (∼500 horas de execução)
- **Render**: 750 horas/mês
- **Vercel**: Ilimitado para sites estáticos

### **🔒 Segurança:**
- Troque a `JWT_SECRET` para algo único
- Use senhas fortes para admin
- Configure domínio próprio (opcional)

---

## 🆘 **PROBLEMAS COMUNS E SOLUÇÕES**

### **Erro "Port already in use":**
```python
# Mude no server.py:
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
```

### **Banco não conecta:**
```python
# Verifique a MONGO_URL nas variáveis
# Exemplo correto: mongodb://username:password@host:port/database
```

### **Frontend não carrega:**
```
# Verifique se EXPO_PUBLIC_BACKEND_URL aponta para sua API
# Exemplo: https://meu-backend.railway.app
```

---

## 🎉 **RESULTADO FINAL**

Após seguir esses passos, você terá:

✅ **Aplicação online 24/7**
✅ **Acesso de qualquer lugar**  
✅ **URL própria** (ex: meus-orcamentos.railway.app)
✅ **Banco de dados na nuvem**
✅ **Sistema de login funcional**
✅ **Zero custo** (tier gratuito)

**🚀 Tempo estimado: 15-30 minutos**

Quer que eu ajude com algum passo específico ou tem dúvidas sobre alguma dessas plataformas?