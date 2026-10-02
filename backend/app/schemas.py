from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class VehicleBase(BaseModel):
    marca: str
    modelo: str
    versao: str | None = None
    ano_fab: int | None = None
    ano_mod: int | None = None
    cor: str | None = None
    final_placa: str | None = Field(default=None, max_length=2)
    cambio: str | None = None
    combustivel: str | None = None
    motor: str | None = None
    portas: int | None = None
    km: int = 0
    preco: float
    fipe: float | None = None
    status: str = "ativo"
    destaque: bool = False
    opcionais: list[str] = []
    fotos: list[str] = []

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    marca: str | None = None
    modelo: str | None = None
    versao: str | None = None
    ano_fab: int | None = None
    ano_mod: int | None = None
    cor: str | None = None
    final_placa: str | None = None
    cambio: str | None = None
    combustivel: str | None = None
    motor: str | None = None
    portas: int | None = None
    km: int | None = None
    preco: float | None = None
    fipe: float | None = None
    status: str | None = None
    destaque: bool | None = None
    opcionais: list[str] | None = None
    fotos: list[str] | None = None

class VehicleOut(VehicleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class LeadBase(BaseModel):
    nome: str
    telefone: str | None = None
    email: str | None = None
    veiculo: str | None = None
    canal: str = "whatsapp"
    status: str = "novo"
    observacao: str | None = None

class LeadCreate(LeadBase):
    pass

class LeadOut(LeadBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
