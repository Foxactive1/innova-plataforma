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

1. ✅ `elvis_admin.html` conectado ao `frontend/js/api.js` com JWT;
2. ✅ estoque, leads e configurações administrativas persistidos pela API;
3. conectar `index.html` ao endpoint público `GET /vehicles`;
4. substituir imagens Base64 por Cloudinary/S3;
5. modularizar CSS e JavaScript;
6. adicionar migrations com Alembic;
7. testes automatizados;
8. preparar multi-tenant/white-label.


## Fase 2 — Painel conectado à API

O painel administrativo já utiliza a API para login, restauração de sessão, CRUD de veículos, leads e configurações.

As credenciais antigas hardcoded foram removidas do HTML.

> As imagens ainda usam Base64 temporariamente. A próxima etapa é conectar o showroom público à API e depois migrar imagens para Cloudinary/S3.


## Fase 3 — Showroom público conectado à API

O `index.html` agora consome dados do backend:

- `GET /vehicles` para carregar o estoque público;
- `GET /config` para nome da loja, WhatsApp, endereço, horário, e-mail e rodapé;
- apenas veículos com status `ativo` são exibidos;
- filtros continuam funcionando no frontend;
- o veículo em destaque vem do backend;
- caso a API esteja indisponível, o showroom entra em modo demonstração com dados de contingência.

O showroom não depende mais de `localStorage` para estoque ou configuração.


## Neon PostgreSQL

O backend agora usa tipos adequados ao PostgreSQL/Neon:

- `JSONB` para opcionais e fotos;
- `NUMERIC(12,2)` para preço e FIPE;
- `TIMESTAMPTZ` para datas;
- índice único parcial garantindo apenas um veículo em destaque;
- fallback local compatível com SQLite via SQLAlchemy.

### Banco Neon já existente

Como as tabelas foram criadas antes dessa refatoração, execute uma única vez no SQL Editor do Neon:

```text
backend/migrations/neon_001_native_types.sql
```

Depois configure o arquivo `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/neondb?sslmode=require
SECRET_KEY=uma-chave-forte
ADMIN_USERNAME=admin
ADMIN_PASSWORD=uma-senha-forte
```

A aplicação também aceita URLs iniciadas em `postgres://` ou `postgresql://` e normaliza automaticamente para o driver `psycopg`.

### Ordem recomendada

1. executar `neon_001_native_types.sql` no Neon;
2. configurar `backend/.env`;
3. instalar `backend/requirements.txt`;
4. iniciar com `uvicorn app.main:app --reload`;
5. abrir `GET /health`;
6. confirmar resposta com `database: "postgresql"`;
7. testar login e CRUD pelo `/docs`.

> Nunca versione a `DATABASE_URL` real nem credenciais do Neon. O arquivo `.env` permanece ignorado pelo Git.
