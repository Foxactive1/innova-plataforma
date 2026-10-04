from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VehicleBase(BaseModel):
    marca: str = Field(min_length=1, max_length=80)
    modelo: str = Field(min_length=1, max_length=120)
    versao: str | None = Field(default=None, max_length=160)
    ano_fab: int | None = Field(default=None, ge=1900, le=2100)
    ano_mod: int | None = Field(default=None, ge=1900, le=2100)
    cor: str | None = Field(default=None, max_length=50)
    final_placa: str | None = Field(default=None, max_length=2)
    cambio: str | None = Field(default=None, max_length=50)
    combustivel: str | None = Field(default=None, max_length=50)
    motor: str | None = Field(default=None, max_length=50)
    portas: int | None = Field(default=None, ge=1, le=6)
    km: int = Field(default=0, ge=0)
    preco: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    fipe: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: str = "ativo"
    destaque: bool = False
    opcionais: list[str] = Field(default_factory=list)
    fotos: list[str] = Field(default_factory=list)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {"ativo", "pause", "vendido"}
        if value not in allowed:
            raise ValueError("status deve ser ativo, pause ou vendido")
        return value


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    marca: str | None = Field(default=None, min_length=1, max_length=80)
    modelo: str | None = Field(default=None, min_length=1, max_length=120)
    versao: str | None = Field(default=None, max_length=160)
    ano_fab: int | None = Field(default=None, ge=1900, le=2100)
    ano_mod: int | None = Field(default=None, ge=1900, le=2100)
    cor: str | None = Field(default=None, max_length=50)
    final_placa: str | None = Field(default=None, max_length=2)
    cambio: str | None = Field(default=None, max_length=50)
    combustivel: str | None = Field(default=None, max_length=50)
    motor: str | None = Field(default=None, max_length=50)
    portas: int | None = Field(default=None, ge=1, le=6)
    km: int | None = Field(default=None, ge=0)
    preco: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    fipe: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: str | None = None
    destaque: bool | None = None
    opcionais: list[str] | None = None
    fotos: list[str] | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"ativo", "pause", "vendido"}:
            raise ValueError("status deve ser ativo, pause ou vendido")
        return value


class VehicleOut(VehicleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadBase(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=160)
    veiculo: str | None = Field(default=None, max_length=200)
    canal: str = Field(default="whatsapp", max_length=40)
    status: str = "novo"
    observacao: str | None = None

    @field_validator("status")
    @classmethod
    def validate_lead_status(cls, value: str) -> str:
        if value not in {"novo", "atendido", "fechado", "perdido"}:
            raise ValueError("status de lead inválido")
        return value


class LeadCreate(LeadBase):
    pass


class LeadOut(LeadBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
