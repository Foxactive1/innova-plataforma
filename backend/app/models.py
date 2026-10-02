from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    marca: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    modelo: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    versao: Mapped[str | None] = mapped_column(String(160))
    ano_fab: Mapped[int | None] = mapped_column(Integer)
    ano_mod: Mapped[int | None] = mapped_column(Integer)
    cor: Mapped[str | None] = mapped_column(String(50))
    final_placa: Mapped[str | None] = mapped_column(String(2))
    cambio: Mapped[str | None] = mapped_column(String(50))
    combustivel: Mapped[str | None] = mapped_column(String(50))
    motor: Mapped[str | None] = mapped_column(String(50))
    portas: Mapped[int | None] = mapped_column(Integer)
    km: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    preco: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    fipe: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ativo", server_default="ativo", index=True
    )
    destaque: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    opcionais: Mapped[list[str]] = mapped_column(
        MutableList.as_mutable(JSONB),
        nullable=False,
        default=list,
        server_default="[]",
    )
    fotos: Mapped[list[str]] = mapped_column(
        MutableList.as_mutable(JSONB),
        nullable=False,
        default=list,
        server_default="[]",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(160))
    veiculo: Mapped[str | None] = mapped_column(String(200))
    canal: Mapped[str] = mapped_column(
        String(40), nullable=False, default="whatsapp", server_default="whatsapp"
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="novo", server_default="novo", index=True
    )
    observacao: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StoreConfig(Base):
    __tablename__ = "store_config"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    nome: Mapped[str] = mapped_column(
        String(140), nullable=False, default="Elvis Veículos", server_default="Elvis Veículos"
    )
    endereco: Mapped[str | None] = mapped_column(String(255))
    horario: Mapped[str | None] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(160))
    footer: Mapped[str | None] = mapped_column(String(255))
    whatsapp: Mapped[str | None] = mapped_column(String(30))
    whatsapp_msg: Mapped[str | None] = mapped_column(Text)
    whatsapp_badge: Mapped[str] = mapped_column(
        String(10), nullable=False, default="3", server_default="3"
    )
