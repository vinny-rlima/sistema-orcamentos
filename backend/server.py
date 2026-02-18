from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import base64
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
import io
import tempfile
from bson import ObjectId
import hashlib
import jwt
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Pydantic models
class User(BaseModel):
    id: Optional[str] = None
    username: str
    email: str
    password_hash: str
    role: str = "user"  # "admin" or "user"
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    is_active: bool = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class CompanySettings(BaseModel):
    id: Optional[str] = None
    company_name: str
    cpf_cnpj: str
    ie: str
    address: str
    neighborhood: str
    city: str
    state: str
    cep: str
    phone: str
    phone2: Optional[str] = None
    email: str
    website: Optional[str] = None
    logo_base64: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Client(BaseModel):
    id: Optional[str] = None
    name: str
    phone: str
    phone2: Optional[str] = None
    email: str
    cpf_cnpj: Optional[str] = None
    rg_ie: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    cep: Optional[str] = None
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str

class QuoteItem(BaseModel):
    description: str
    quantity: int
    unit_price: float

class Quote(BaseModel):
    id: Optional[str] = None
    quote_number: Optional[int] = None
    client_id: str
    items: List[QuoteItem]
    subtotal: float
    discount: float = 0.0
    additional: float = 0.0
    total: float
    payment_terms: Optional[str] = None
    observations: Optional[str] = None
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    created_by_name: Optional[str] = None
    valid_until: Optional[datetime] = None

# Helper functions
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash

def create_jwt_token(user_id: str, company_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "company_id": company_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token validation failed")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_jwt_token(token)
    
    user = await db.users.find_one({"_id": ObjectId(payload["user_id"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User is inactive")
    
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "company_id": user["company_id"]
    }

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Authentication routes
@api_router.post("/auth/setup-admin")
async def setup_admin():
    """Setup inicial - criar primeiro admin"""
    # Verificar se já existe admin
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin já existe")
    
    
    company_result = await db.company_settings.insert_one(company_data)
    company_id = str(company_result.inserted_id)
    
    # Criar admin padrão
    admin_data = {
        "username": "admin",
        "email": "admin@empresa.com",
        "password_hash": hash_password("HZTABIL4367@"),
        "role": "admin",
        "company_id": company_id,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    user_result = await db.users.insert_one(admin_data)
    token = create_jwt_token(str(user_result.inserted_id), company_id, "admin")
    
    return {
        "message": "Admin criado com sucesso",
        "token": token,
        "user": {
            "id": str(user_result.inserted_id),
            "username": "admin",
            "role": "admin"
        }
    }

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"username": login_data.username})
    
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Usuário inativo")
    
    token = create_jwt_token(str(user["_id"]), user["company_id"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

# User management routes (Admin only)
@api_router.post("/users", dependencies=[Depends(require_admin)])
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    # Verificar se usuário já existe
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    user_dict = {
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "role": user_data.role,
        "company_id": current_user["company_id"],
        "created_at": datetime.utcnow(),
        "created_by": current_user["id"],
        "is_active": True
    }
    
    result = await db.users.insert_one(user_dict)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    
    return {
        "id": str(created_user["_id"]),
        "username": created_user["username"],
        "email": created_user["email"],
        "role": created_user["role"],
        "created_at": created_user["created_at"]
    }

@api_router.get("/users", dependencies=[Depends(require_admin)])
async def get_users(current_user: dict = Depends(require_admin)):
    users = await db.users.find({"company_id": current_user["company_id"]}).to_list(1000)
    return [{
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"]
    } for user in users]

@api_router.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({
        "_id": ObjectId(user_id),
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return {"message": "Usuário excluído com sucesso"}

# Company settings routes
@api_router.post("/company")
async def save_company_settings(settings: CompanySettings, current_user: dict = Depends(get_current_user)):
    settings_dict = settings.dict()
    if settings_dict.get("id"):
        del settings_dict["id"]
    
    # Update company settings for current user's company
    result = await db.company_settings.update_one(
        {"_id": ObjectId(current_user["company_id"])}, 
        {"$set": settings_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    updated_company = await db.company_settings.find_one({"_id": ObjectId(current_user["company_id"])})
    return CompanySettings(**serialize_doc(updated_company))

@api_router.get("/company")
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one({"_id": ObjectId(current_user["company_id"])})
    if not settings:
        raise HTTPException(status_code=404, detail="Configurações da empresa não encontradas")
    return CompanySettings(**serialize_doc(settings))

# Client routes
@api_router.post("/clients")
async def create_client(client: Client, current_user: dict = Depends(get_current_user)):
    client_dict = client.dict()
    if client_dict.get("id"):
        del client_dict["id"]
    
    client_dict["company_id"] = current_user["company_id"]
    client_dict["created_by"] = current_user["id"]
    
    result = await db.clients.insert_one(client_dict)
    created_client = await db.clients.find_one({"_id": result.inserted_id})
    return Client(**serialize_doc(created_client))

@api_router.get("/clients")
async def get_clients(current_user: dict = Depends(get_current_user)):
    clients = await db.clients.find({"company_id": current_user["company_id"]}).to_list(1000)
    return [Client(**serialize_doc(client)) for client in clients]

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    try:
        client = await db.clients.find_one({
            "_id": ObjectId(client_id),
            "company_id": current_user["company_id"]
        })
        if not client:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        return Client(**serialize_doc(client))
    except Exception as e:
        raise HTTPException(status_code=400, detail="ID inválido")

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, client: Client, current_user: dict = Depends(get_current_user)):
    try:
        client_dict = client.dict()
        if client_dict.get("id"):
            del client_dict["id"]
        client_dict["updated_at"] = datetime.utcnow()
        client_dict["company_id"] = current_user["company_id"]
        
        result = await db.clients.update_one(
            {
                "_id": ObjectId(client_id),
                "company_id": current_user["company_id"]
            }, 
            {"$set": client_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
            
        updated_client = await db.clients.find_one({"_id": ObjectId(client_id)})
        return Client(**serialize_doc(updated_client))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Erro ao atualizar cliente")

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(get_current_user)):
    try:
        result = await db.clients.delete_one({
            "_id": ObjectId(client_id),
            "company_id": current_user["company_id"]
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        return {"message": "Cliente excluído com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Erro ao excluir cliente")

# Quote routes
@api_router.post("/quotes")
async def create_quote(quote: Quote, current_user: dict = Depends(get_current_user)):
    quote_dict = quote.dict()
    if quote_dict.get("id"):
        del quote_dict["id"]
    
    # Generate quote number
    last_quote = await db.quotes.find_one(
        {"company_id": current_user["company_id"]}, 
        sort=[("quote_number", -1)]
    )
    quote_dict["quote_number"] = (last_quote["quote_number"] if last_quote else 0) + 1
    quote_dict["company_id"] = current_user["company_id"]
    quote_dict["created_by"] = current_user["id"]
    quote_dict["created_by_name"] = current_user["username"]
    
    result = await db.quotes.insert_one(quote_dict)
    created_quote = await db.quotes.find_one({"_id": result.inserted_id})
    return Quote(**serialize_doc(created_quote))

@api_router.get("/quotes")
async def get_quotes(current_user: dict = Depends(get_current_user)):
    quotes = await db.quotes.find({"company_id": current_user["company_id"]}).sort("created_at", -1).to_list(1000)
    return [Quote(**serialize_doc(quote)) for quote in quotes]

@api_router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, current_user: dict = Depends(get_current_user)):
    try:
        quote = await db.quotes.find_one({
            "_id": ObjectId(quote_id),
            "company_id": current_user["company_id"]
        })
        if not quote:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")
        return Quote(**serialize_doc(quote))
    except Exception as e:
        raise HTTPException(status_code=400, detail="ID inválido")

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, current_user: dict = Depends(require_admin)):
    try:
        result = await db.quotes.delete_one({
            "_id": ObjectId(quote_id),
            "company_id": current_user["company_id"]
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")
        return {"message": "Orçamento excluído com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Erro ao excluir orçamento")

@api_router.get("/quotes/{quote_id}/pdf")
async def generate_quote_pdf(quote_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Get quote data
        quote = await db.quotes.find_one({
            "_id": ObjectId(quote_id),
            "company_id": current_user["company_id"]
        })
        if not quote:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")
        
        # Get client data
        client = await db.clients.find_one({"_id": ObjectId(quote["client_id"])})
        if not client:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
        # Get company data
        company = await db.company_settings.find_one({"_id": ObjectId(current_user["company_id"])})
        if not company:
            raise HTTPException(status_code=404, detail="Configurações da empresa não encontradas")
        
        # Generate PDF using simpler approach
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Add logo if exists
        y = height - 30
        if company.get('logo_base64'):
            try:
                # Decode base64 logo
                logo_data = base64.b64decode(company['logo_base64'].split(',')[1] if ',' in company['logo_base64'] else company['logo_base64'])
                logo_buffer = io.BytesIO(logo_data)
                
                # Create temporary file for logo
                temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                temp_logo.write(logo_data)
                temp_logo.close()
                
                # Draw logo
                p.drawImage(temp_logo.name, width/2 - 50, y, width=100, height=50, mask='auto')
                y -= 70
                
                # Clean up
                os.unlink(temp_logo.name)
            except:
                # If logo fails, continue without it
                y -= 20
        else:
            y -= 20
        
        # Header - Company Info
        p.setFont("Helvetica-Bold", 16)
        p.drawCentredString(width/2, y, company['company_name'])
        
        y -= 20
        p.setFont("Helvetica", 10)
        p.drawCentredString(width/2, y, f"CPF/CNPJ: {company['cpf_cnpj']} - IE: {company['ie']}")
        
        y -= 15
        p.drawCentredString(width/2, y, company['address'])
        
        y -= 15
        p.drawCentredString(width/2, y, f"{company['neighborhood']} - {company['city']} - {company['state']} - {company['cep']}")
        
        y -= 15
        p.drawCentredString(width/2, y, f"Tel: {company['phone']} - E-mail: {company['email']}")
        
        if company.get('website'):
            y -= 15
            p.drawCentredString(width/2, y, f"Website: {company['website']}")

        # Quote Info Box
        y -= 40
        p.setStrokeColor(colors.black)
        p.setFillColor(colors.lightgrey)
        p.rect(50, y-20, width-100, 25, fill=1)
        
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 10)
        p.drawString(60, y-15, f"Orçamento nº: {quote['quote_number']}")
        p.drawString(200, y-15, f"Emitido em: {quote['created_at'].strftime('%d/%m/%Y')}")
        p.drawString(350, y-15, "Válido até: ____/____/____")
        
        # Client Section
        y -= 60
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y, "CLIENTE")
        
        y -= 25
        p.setFont("Helvetica", 10)
        
        # Client info table
        client_info = [
            ("NOME", client['name']),
            ("TELEFONE", f"{client['phone']} - {client.get('phone2', '')}"),
            ("EMAIL", client['email']),
            ("CPF/CNPJ", client.get('cpf_cnpj', '')),
            ("ENDEREÇO", client.get('address', '')),
            ("CIDADE", client.get('city', '')),
            ("ESTADO", client.get('state', '')),
            ("CEP", client.get('cep', ''))
        ]
        
        for label, value in client_info:
            if y < 100:  # Check if we need a new page
                p.showPage()
                y = height - 50
                
            p.setFont("Helvetica-Bold", 9)
            p.drawString(50, y, label + ":")
            p.setFont("Helvetica", 9)
            p.drawString(120, y, str(value))
            y -= 20
        
        # Items Section
        y -= 20
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y, "ORÇAMENTO")
        
        y -= 30
        # Items header
        p.setStrokeColor(colors.black)
        p.setFillColor(colors.lightgrey)
        p.rect(50, y-15, width-100, 20, fill=1)
        
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 9)
        p.drawString(60, y-10, "ITEM")
        p.drawString(120, y-10, "PRODUTO/SERVIÇO")
        p.drawString(400, y-10, "QUANT.")
        p.drawString(470, y-10, "VALOR")
        
        y -= 25
        # Items data
        for i, item in enumerate(quote['items'], 1):
            if y < 100:  # Check if we need a new page
                p.showPage()
                y = height - 50
                
            p.setFont("Helvetica", 9)
            p.drawString(60, y, str(i))
            p.drawString(120, y, item['description'][:40])  # Limit description length
            p.drawString(400, y, str(item['quantity']))
            p.drawString(470, y, f"R$ {item['unit_price']:.2f}")
            
            # Draw line
            p.line(50, y-5, width-50, y-5)
            y -= 20
        
        # Totals Section
        y -= 20
        p.setStrokeColor(colors.black)
        p.setFillColor(colors.lightgrey)
        p.rect(50, y-15, width-100, 20, fill=1)
        
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 10)
        
        # Draw totals in boxes
        col_width = (width-100) / 4
        p.drawString(60, y-10, f"SUBTOTAL: R$ {quote['subtotal']:.2f}")
        p.drawString(60 + col_width, y-10, f"DESCONTO: R$ {quote['discount']:.2f}")
        p.drawString(60 + 2*col_width, y-10, f"ACRÉSCIMO: R$ {quote['additional']:.2f}")
        p.drawString(60 + 3*col_width, y-10, f"TOTAL: R$ {quote['total']:.2f}")
        
        # Observations
        if quote.get('payment_terms') or quote.get('observations'):
            y -= 40
            p.setFont("Helvetica-Bold", 12)
            p.drawString(50, y, "OBSERVAÇÕES")
            
            y -= 20
            p.setFont("Helvetica", 9)
            
            if quote.get('payment_terms'):
                p.drawString(50, y, f"Forma de Pagamento: {quote['payment_terms']}")
                y -= 15
            
            if quote.get('observations'):
                # Split observations into lines
                obs_lines = quote['observations'].split('\n')
                for line in obs_lines:
                    if y < 50:
                        p.showPage()
                        y = height - 50
                    p.drawString(50, y, line[:80])  # Limit line length
                    y -= 15
        
        # Company signature footer
        y = 80
        p.line(50, y, 250, y)
        p.line(350, y, 550, y)
        
        y -= 15
        p.setFont("Helvetica", 10)
        p.drawCentredString(150, y, company['company_name'])
        p.drawCentredString(450, y, client['name'])
        
        p.save()
        buffer.seek(0)
        
        # Save to temp file and return
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(buffer.getvalue())
        temp_file.close()
        
        return FileResponse(
            temp_file.name,
            media_type='application/pdf',
            filename=f'orcamento_{quote["quote_number"]}.pdf'
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
