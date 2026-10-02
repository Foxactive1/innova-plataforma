import json

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db
from .models import Lead, StoreConfig, User, Vehicle
from .schemas import LeadCreate, LeadOut, Token, VehicleCreate, VehicleUpdate
from .security import authenticate_user, create_access_token, get_current_user, hash_password
from .settings import settings

app = FastAPI(title=settings.app_name, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def vehicle_to_dict(v: Vehicle) -> dict:
    return {
        "id": v.id,
        "marca": v.marca,
        "modelo": v.modelo,
        "versao": v.versao,
        "ano_fab": v.ano_fab,
        "ano_mod": v.ano_mod,
        "cor": v.cor,
        "final_placa": v.final_placa,
        "cambio": v.cambio,
        "combustivel": v.combustivel,
        "motor": v.motor,
        "portas": v.portas,
        "km": v.km,
        "preco": v.preco,
        "fipe": v.fipe,
        "status": v.status,
        "destaque": v.destaque,
        "opcionais": json.loads(v.opcionais_json or "[]"),
        "fotos": json.loads(v.fotos_json or "[]"),
        "created_at": v.created_at,
        "updated_at": v.updated_at,
    }

def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == settings.admin_username))
        if not user:
            db.add(User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            ))
        if not db.get(StoreConfig, 1):
            db.add(StoreConfig(id=1))
        db.commit()

@app.on_event("startup")
def on_startup() -> None:
    bootstrap()

@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.post("/auth/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos.")
    return Token(access_token=create_access_token(user.username))

@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}

@app.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    rows = db.scalars(select(Vehicle).order_by(Vehicle.destaque.desc(), Vehicle.created_at.desc())).all()
    return [vehicle_to_dict(v) for v in rows]

@app.post("/vehicles", status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.destaque:
        for item in db.scalars(select(Vehicle).where(Vehicle.destaque.is_(True))).all():
            item.destaque = False
    data = payload.model_dump(exclude={"opcionais", "fotos"})
    vehicle = Vehicle(
        **data,
        opcionais_json=json.dumps(payload.opcionais, ensure_ascii=False),
        fotos_json=json.dumps(payload.fotos, ensure_ascii=False),
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)

@app.patch("/vehicles/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    opcionais = data.pop("opcionais", None)
    fotos = data.pop("fotos", None)

    if data.get("destaque") is True:
        for item in db.scalars(select(Vehicle).where(Vehicle.destaque.is_(True), Vehicle.id != vehicle_id)).all():
            item.destaque = False

    for key, value in data.items():
        setattr(vehicle, key, value)
    if opcionais is not None:
        vehicle.opcionais_json = json.dumps(opcionais, ensure_ascii=False)
    if fotos is not None:
        vehicle.fotos_json = json.dumps(fotos, ensure_ascii=False)

    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)

@app.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado.")
    db.delete(vehicle)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

@app.get("/leads", response_model=list[LeadOut])
def list_leads(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Lead).order_by(Lead.created_at.desc())).all()

@app.patch("/leads/{lead_id}/status", response_model=LeadOut)
def update_lead_status(lead_id: int, lead_status: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado.")
    if lead_status not in {"novo", "atendido", "fechado", "perdido"}:
        raise HTTPException(status_code=422, detail="Status de lead inválido.")
    lead.status = lead_status
    db.commit()
    db.refresh(lead)
    return lead

@app.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado.")
    db.delete(lead)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/config")
def get_config(db: Session = Depends(get_db)):
    cfg = db.get(StoreConfig, 1)
    return {
        "nome": cfg.nome,
        "endereco": cfg.endereco,
        "horario": cfg.horario,
        "email": cfg.email,
        "footer": cfg.footer,
        "whatsapp": cfg.whatsapp,
        "whatsapp_msg": cfg.whatsapp_msg,
        "whatsapp_badge": cfg.whatsapp_badge,
    }

@app.put("/config")
def update_config(payload: dict, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cfg = db.get(StoreConfig, 1)
    allowed = {"nome", "endereco", "horario", "email", "footer", "whatsapp", "whatsapp_msg", "whatsapp_badge"}
    for key, value in payload.items():
        if key in allowed:
            setattr(cfg, key, value)
    db.commit()
    db.refresh(cfg)
    return get_config(db)
