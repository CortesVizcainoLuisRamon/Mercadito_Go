-- =====================================================================
--  Tarea 7 - Prototipo de comercio electrónico
--  Script de creación de la base de datos "servicio_web"
--
--  Uso en la máquina virtual:
--      mysql -u TU_USUARIO -p < tarea7_bd.sql
--
--  Las tablas de la Tarea 1 (usuarios, fotos_usuarios) se crean solo si
--  no existen, así que el script se puede correr sobre la BD que ya tienes.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS servicio_web;
USE servicio_web;

-- ---------------------------------------------------------------------
--  Tablas de la Tarea 1 (sin cambios)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios
(
    id_usuario        INTEGER AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(100) NOT NULL,
    password          VARCHAR(64)  NOT NULL,
    token             VARCHAR(20),
    nombre            VARCHAR(100) NOT NULL,
    apellido_paterno  VARCHAR(100) NOT NULL,
    apellido_materno  VARCHAR(100),
    fecha_nacimiento  DATETIME     NOT NULL,
    telefono          BIGINT,
    genero            CHAR(1),
    UNIQUE INDEX usuarios_1 (email)
);

CREATE TABLE IF NOT EXISTS fotos_usuarios
(
    id_foto     INTEGER AUTO_INCREMENT PRIMARY KEY,
    foto        LONGBLOB,
    id_usuario  INTEGER NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- ---------------------------------------------------------------------
--  RNF-1.1  Tabla stock
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock
(
    id_articulo  INTEGER AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100)   NOT NULL,
    descripcion  VARCHAR(500)   NOT NULL,
    precio       DECIMAL(10,2)  NOT NULL,
    cantidad     INTEGER        NOT NULL
);

-- ---------------------------------------------------------------------
--  RNF-1.2  Tabla fotos_articulos  (FK -> stock)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fotos_articulos
(
    id_foto      INTEGER AUTO_INCREMENT PRIMARY KEY,
    foto         LONGBLOB,
    id_articulo  INTEGER NOT NULL,
    CONSTRAINT fk_fotos_articulos_stock
        FOREIGN KEY (id_articulo) REFERENCES stock(id_articulo)
);

-- ---------------------------------------------------------------------
--  RNF-1.3  Tabla carrito_compra (un carrito por usuario)
--  RNF-1.4  Índice único (id_usuario, id_articulo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrito_compra
(
    id_usuario   INTEGER NOT NULL,
    id_articulo  INTEGER NOT NULL,
    cantidad     INTEGER NOT NULL,
    CONSTRAINT fk_carrito_usuarios
        FOREIGN KEY (id_usuario)  REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_carrito_stock
        FOREIGN KEY (id_articulo) REFERENCES stock(id_articulo)
);

CREATE UNIQUE INDEX carrito_compra_1 ON carrito_compra(id_usuario, id_articulo);
