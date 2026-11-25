# Pruebas

## Back-end (curl en la máquina virtual)

Las pruebas unitarias del back-end se hicieron en la máquina virtual con `curl` (RNF-5).
Antes de empezar se inicia sesión para obtener `id_usuario` y `token`:

```bash
WS="https://<dominio>/Servicio/rest/ws"
curl -i "$WS/login?email=<email>&password=<sha256_de_la_contraseña>"
# HTTP/1.1 200  {"id_usuario":<id>,"token":"<token>"}
```

En los comandos siguientes `<id>` y `<token>` son los que regresó el login.
El script [`pruebas/pruebas_curl.sh`](../pruebas/pruebas_curl.sh) tiene estas mismas pruebas listas para ejecutarse.

### RF-BE-1. `/alta_articulo` (POST)

Da de alta un artículo en `stock` y su fotografía en `fotos_articulos`, dentro de una transacción.

```bash
curl -i -X POST "$WS/alta_articulo" -H "Content-Type: application/json" \
  -d '{"nombre":"Mayonesa","descripcion":"Mayonesa con limon 390 g","precio":45.50,"cantidad":10,"foto":"<base64>","id_usuario":<id>,"token":"<token>"}'
```

| Caso | Resultado esperado |
|---|---|
| Token correcto | `HTTP 200 {"mensaje":"OK"}` |
| Token incorrecto (`"token":"malo"`) | `HTTP 400 {"mensaje":"Acceso denegado"}` y no se inserta nada |

### RF-BE-2. `/consulta_articulos` (GET)

Busca una palabra en `nombre` y `descripcion` con `SELECT ... LIKE`.

```bash
curl -i "$WS/consulta_articulos?palabra=limon&id_usuario=<id>&token=<token>"
```

| Caso | Resultado esperado |
|---|---|
| La palabra solo aparece en la descripción ("limon") | `HTTP 200` con el arreglo JSON que incluye el artículo "Mayonesa" |
| Token incorrecto | `HTTP 400 {"mensaje":"Acceso denegado"}` |

### RF-BE-3. `/compra_articulo` (PUT)

```bash
curl -i -X PUT "$WS/compra_articulo?id_articulo=<id_articulo>&cantidad=2&id_usuario=<id>&token=<token>"
```

| Caso | Resultado esperado |
|---|---|
| RF-BE-3.1: el artículo no está en el carrito (cantidad 2, stock 10) | `HTTP 200 {"mensaje":"OK"}`; se inserta en `carrito_compra` y el stock queda en 8 |
| RF-BE-3.2: el artículo ya está en el carrito (cantidad 3) | `HTTP 200 {"mensaje":"OK"}`; el carrito queda con 5 en un solo registro y el stock en 5 |
| RF-BE-3.3: cantidad mayor al stock (999) | `HTTP 400 {"mensaje":"No hay suficientes artículos en el stock"}`; stock y carrito sin cambios |
| Token incorrecto | `HTTP 400 {"mensaje":"Acceso denegado"}` |

### RF-BE-4. `/elimina_articulo_carrito_compra` (DELETE)

Regresa al stock la cantidad del artículo (UPDATE) y lo borra del carrito (DELETE), en una transacción.

```bash
curl -i -X DELETE "$WS/elimina_articulo_carrito_compra?id_usuario=<id>&id_articulo=<id_articulo>&token=<token>"
```

| Caso | Resultado esperado |
|---|---|
| El artículo está en el carrito | `HTTP 200 {"mensaje":"OK"}`; la cantidad regresa al stock |
| El artículo no está en el carrito | `HTTP 400 {"mensaje":"El artículo no está en el carrito de compra"}` |

### RF-BE-5. `/elimina_carrito_compra` (DELETE)

Un UPDATE a `stock` por cada artículo del carrito y un DELETE de los registros del usuario, en una transacción.

```bash
curl -i -X DELETE "$WS/elimina_carrito_compra?id_usuario=<id>&token=<token>"
```

| Caso | Resultado esperado |
|---|---|
| RF-BE-5.1: carrito con 4 piezas de Mayonesa y 3 de Catsup (stock 6 y 5) | `HTTP 200 {"mensaje":"OK"}`; el stock regresa a 10 y 8 y el carrito queda vacío |
| RF-BE-5.2: otros usuarios con carrito | Sus registros no se borran (el DELETE usa `WHERE id_usuario=?`) |

Para revisar la base de datos después de cada prueba:

```sql
SELECT * FROM stock;
SELECT * FROM carrito_compra;
```

## Front-end (en el celular)

Las pruebas del front-end se hicieron en un teléfono (RNF-4), abriendo `https://<dominio>/prueba.html`.

| Requerimiento | Prueba | Resultado esperado |
|---|---|---|
| RF-FE-1 | Abrir "Captura de artículo", tomar o elegir la foto, llenar nombre, descripción, precio y existencia, y presionar "Guardar artículo" | Aviso de confirmación y formulario limpio |
| RF-FE-2 | Abrir "Compra de artículos", escribir una palabra y presionar "Buscar" | Se muestran los artículos con esa palabra en el nombre o la descripción |
| RF-FE-2.1 | Revisar las tarjetas de resultados | Cada una tiene foto, nombre, descripción, precio, "Cantidad" con valor 1 y botón "Compra" |
| RF-FE-2.2 | Cambiar la cantidad y presionar "Compra"; repetir con más piezas de las que hay | Aviso de compra y número del carrito actualizado; con exceso, "No hay suficientes artículos en el stock" |
| RF-FE-2.3 | Presionar "Carrito de compra" | Pantalla "Artículos en el carrito" con imagen, nombre, cantidad, precio, costo y total de la compra |
| RF-FE-2.4 | Presionar "Eliminar artículo" en un renglón | El artículo desaparece y el total se actualiza |
| RF-FE-2.5 | Presionar "Eliminar carrito" y confirmar | El carrito queda vacío |
| RF-FE-2.6 | Presionar "Seguir comprando" | Regresa a "Compra de artículos" |
