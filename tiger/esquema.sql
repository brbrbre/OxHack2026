-- Tiger Data (Postgres + TimescaleDB): precios y predicciones calificadas.
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS precios (
    time    timestamptz      NOT NULL,
    simbolo text             NOT NULL,
    cierre  double precision NOT NULL,
    PRIMARY KEY (simbolo, time)
);
-- Pedazos de un año: la historia empieza en 1929 y con los de 7 días eran 5,000 y se acababa la memoria.
SELECT create_hypertable('precios', 'time', chunk_time_interval => INTERVAL '1 year', if_not_exists => TRUE, migrate_data => TRUE);

-- Una fila por predicción. `real` queda NULL hasta que pasa el plazo; tiger.calificar la llena.
CREATE TABLE IF NOT EXISTS predicciones (
    time          timestamptz      NOT NULL,  -- fecha de la decisión
    simbolo       text             NOT NULL,
    plazo_dias    integer          NOT NULL,
    modelo        text             NOT NULL,
    origen        text             NOT NULL,  -- 'backtest' o 'live'
    perfil        text             NOT NULL,
    esperado      double precision NOT NULL,
    bajo          double precision NOT NULL,
    alto          double precision NOT NULL,
    prob_perdida  double precision NOT NULL,
    fraccion      double precision NOT NULL,
    decision      text             NOT NULL,
    real          double precision,
    PRIMARY KEY (simbolo, time, plazo_dias, modelo, origen, perfil)
);
SELECT create_hypertable('predicciones', 'time', chunk_time_interval => INTERVAL '1 year', if_not_exists => TRUE, migrate_data => TRUE);

-- Cierre semanal, calculado por Tiger y actualizado solo.
CREATE MATERIALIZED VIEW IF NOT EXISTS precios_semanales
WITH (timescaledb.continuous) AS
SELECT time_bucket('7 days', time) AS semana, simbolo,
       first(cierre, time) AS apertura, last(cierre, time) AS cierre,
       min(cierre) AS minimo, max(cierre) AS maximo
FROM precios GROUP BY semana, simbolo
WITH NO DATA;
