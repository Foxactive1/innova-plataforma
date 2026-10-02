# InNova Plataforma — Automotive Showroom

Plataforma de showroom e gestão comercial para revendas de veículos, com frontend público, painel administrativo e backend REST.

## Estado atual

A versão original do projeto utilizava `localStorage` para estoque, leads, configurações e autenticação no frontend.

A branch `feature/backend-foundation` inicia a migração para uma arquitetura full-stack:

- FastAPI
- SQLAlchemy 2
- SQLite para desenvolvimento
- PostgreSQL/Neon compatível via `DATABASE_URL`
- autenticação JWT
- CRUD de veículos
- CRM de leads
- configurações da loja
- cliente JavaScript centralizado para consumo da API

## Estrutura

```text
innova-plataforma/
├── backend/
│   ├── app/
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   └── settings.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   └── js/
│       └── api.js
├── index.html
├── elvis_admin.html
└── README.md
```

## Backend local

### 1. Criar ambiente virtual

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Linux / Termux:

```bash
source .venv/bin/activate
```

### 2. Instalar dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar ambiente

Copie `.env.example` para `.env` e altere obrigatoriamente:

```env
SECRET_KEY=uma-chave-forte-e-unica
ADMIN_USERNAME=admin
ADMIN_PASSWORD=uma-senha-forte
```

Para Neon/PostgreSQL:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
```

### 4. Executar

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Documentação automática:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

## API inicial

### Públicas

- `GET /health`
- `GET /vehicles`
- `POST /leads`
- `GET /config`
- `POST /auth/login`

### Protegidas por Bearer JWT

- `GET /auth/me`
- `POST /vehicles`
- `PATCH /vehicles/{id}`
- `DELETE /vehicles/{id}`
- `GET /leads`
- `PATCH /leads/{id}/status`
- `DELETE /leads/{id}`
- `PUT /config`

## Segurança

As credenciais administrativas não devem mais existir no JavaScript do painel. O backend cria o usuário administrativo inicial a partir das variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

O token é armazenado no `sessionStorage` pelo cliente JavaScript, evitando persistência indefinida no navegador.

> Antes de produção, configure `SECRET_KEY`, senha forte, domínio CORS definitivo e PostgreSQL/Neon.

## Próximos passos

1. conectar `elvis_admin.html` ao `frontend/js/api.js`;
2. migrar estoque e leads existentes do `localStorage`;
3. conectar `index.html` ao endpoint público `GET /vehicles`;
4. substituir imagens Base64 por Cloudinary/S3;
5. modularizar CSS e JavaScript;
6. adicionar migrations com Alembic;
7. testes automatizados;
8. preparar multi-tenant/white-label.
