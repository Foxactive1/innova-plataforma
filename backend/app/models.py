from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(primary_key=True)
    marca: Mapped[str] = mapped_column(String(80), index=True)
    modelo: Mapped[str] = mapped_column(String(120), index=True)
    versao: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ano_fab: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ano_mod: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    final_placa: Mapped[str | None] = mapped_column(String(2), nullable=True)
    cambio: Mapped[str | None] = mapped_column(String(50), nullable=True)
    combustivel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    motor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    portas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    km: Mapped[int] = mapped_column(Integer, default=0)
    preco: Mapped[float] = mapped_column(Float)
    fipe: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ativo", index=True)
    destaque: Mapped[bool] = mapped_column(Boolean, default=False)
    opcionais_json: Mapped[str] = mapped_column(Text, default="[]")
    fotos_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), index=True)
    telefone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    veiculo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    canal: Mapped[str] = mapped_column(String(40), default="whatsapp")
    status: Mapped[str] = mapped_column(String(30), default="novo", index=True)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class StoreConfig(Base):
    __tablename__ = "store_config"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    nome: Mapped[str] = mapped_column(String(140), default="Elvis Veículos")
    endereco: Mapped[str | None] = mapped_column(String(255), nullable=True)
    horario: Mapped[str | None] = mapped_column(String(160), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    footer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    whatsapp_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_badge: Mapped[str] = mapped_column(String(10), default="3")
