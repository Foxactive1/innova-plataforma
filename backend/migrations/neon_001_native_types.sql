-- InNova Plataforma
-- Migração Neon/PostgreSQL: tipos nativos
-- Execute uma única vez no SQL Editor do Neon antes de subir o backend refatorado.

BEGIN;

-- JSON armazenado anteriormente como TEXT.
ALTER TABLE vehicles
    ALTER COLUMN opcionais_json DROP DEFAULT,
    ALTER COLUMN fotos_json DROP DEFAULT;

ALTER TABLE vehicles
    ALTER COLUMN opcionais_json TYPE JSONB
        USING COALESCE(NULLIF(opcionais_json, ''), '[]')::jsonb,
    ALTER COLUMN fotos_json TYPE JSONB
        USING COALESCE(NULLIF(fotos_json, ''), '[]')::jsonb;

ALTER TABLE vehicles
    ALTER COLUMN opcionais_json SET DEFAULT '[]'::jsonb,
    ALTER COLUMN fotos_json SET DEFAULT '[]'::jsonb,
    ALTER COLUMN opcionais_json SET NOT NULL,
    ALTER COLUMN fotos_json SET NOT NULL;

-- Valores financeiros deixam de usar ponto flutuante.
ALTER TABLE vehicles
    ALTER COLUMN preco TYPE NUMERIC(12,2)
        USING preco::numeric(12,2),
    ALTER COLUMN fipe TYPE NUMERIC(12,2)
        USING fipe::numeric(12,2);

-- Os timestamps existentes foram gerados sem timezone.
-- A aplicação tratava esses valores como UTC.
ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at AT TIME ZONE 'UTC';

ALTER TABLE vehicles
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ
        USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE leads
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at AT TIME ZONE 'UTC';

-- Defaults coerentes com os novos tipos.
ALTER TABLE users
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE vehicles
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE leads
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- Garante no banco a mesma regra aplicada pela API:
-- apenas um veículo pode estar em destaque.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_single_featured
    ON vehicles (destaque)
    WHERE destaque IS TRUE;

COMMIT;

-- Verificações rápidas após a migração:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'vehicles'
-- ORDER BY ordinal_position;
--
-- SELECT id, marca, modelo, preco, fipe, opcionais_json, fotos_json
-- FROM vehicles
-- ORDER BY id;
