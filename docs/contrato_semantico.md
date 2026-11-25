# Contrato semántico

El contrato semántico describe la funcionalidad de cada uno de los 11 métodos del servicio web. La URL base es `https://<dominio>/Servicio/rest/ws`. Todas las respuestas son JSON: HTTP 200 si la operación es correcta y HTTP 400 con `{"mensaje":"<mensaje de error>"}` si ocurre un error. Los métodos protegidos llaman primero a `verifica_acceso(id_usuario, token)`, que comprueba en la tabla usuarios que el token corresponda al usuario; si no corresponde, regresan "Acceso denegado" sin modificar la base de datos.

## 1. /login (GET) · Usuarios

| Campo | Descripción |
|---|---|
| **Método HTTP** | GET |
| **Parámetros** | email y password (contraseña cifrada con SHA-256), en la URL. |
| **Funcionalidad** | Busca en la tabla usuarios un registro con ese email y esa contraseña. Si existe, genera un token aleatorio de 20 caracteres, lo guarda en el registro del usuario (reemplazando el anterior, por lo que una sesión previa deja de ser válida) y regresa el id del usuario junto con el token, que el cliente debe enviar en los métodos protegidos. |
| **Respuesta correcta** | HTTP 200 {"id_usuario":3,"token":"aB3dE5fG7hJ9kL1mN3pQ"} |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"} si el email o la contraseña no son correctos. |

## 2. /alta_usuario (POST) · Usuarios

| Campo | Descripción |
|---|---|
| **Método HTTP** | POST |
| **Parámetros** | Objeto JSON en el cuerpo: email, password, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, genero y foto (base64). |
| **Funcionalidad** | Valida que vengan los campos obligatorios (email, contraseña, nombre, apellido paterno y fecha de nacimiento). Dentro de una transacción inserta el usuario en la tabla usuarios y, si se envió fotografía, la inserta en fotos_usuarios. Si alguna instrucción falla se hace rollback y no se guarda nada. |
| **Respuesta correcta** | HTTP 200 {"mensaje":"Se dio de alta el usuario"} |
| **Errores** | HTTP 400 con el mensaje del campo faltante (por ejemplo "Se debe ingresar el email") o el error de MySQL si el email ya está registrado (índice único). |

## 3. /consulta_usuario (GET) · Usuarios

| Campo | Descripción |
|---|---|
| **Método HTTP** | GET |
| **Parámetros** | id_usuario y token, en la URL. |
| **Funcionalidad** | Verifica el acceso con verifica_acceso. Consulta los datos del usuario en usuarios junto con su fotografía de fotos_usuarios (LEFT OUTER JOIN) y los regresa. No regresa la contraseña ni el token. |
| **Respuesta correcta** | HTTP 200 con el objeto JSON del usuario: email, nombre, apellidos, fecha de nacimiento, teléfono, género y foto. |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"}. |

## 4. /modifica_usuario (PUT) · Usuarios

| Campo | Descripción |
|---|---|
| **Método HTTP** | PUT |
| **Parámetros** | id_usuario y token en la URL; objeto JSON del usuario en el cuerpo. |
| **Funcionalidad** | Verifica el acceso y los campos obligatorios. Dentro de una transacción actualiza los datos del usuario en usuarios; actualiza la contraseña solo si se envió una nueva (si viene vacía se conserva la anterior); borra la fotografía anterior de fotos_usuarios e inserta la nueva si se envió. |
| **Respuesta correcta** | HTTP 200 {"mensaje":"Se modificó el usuario"} |
| **Errores** | HTTP 400 "Acceso denegado" o el mensaje del campo obligatorio faltante. |

## 5. /borra_usuario (DELETE) · Usuarios

| Campo | Descripción |
|---|---|
| **Método HTTP** | DELETE |
| **Parámetros** | id_usuario y token, en la URL. |
| **Funcionalidad** | Verifica el acceso. Dentro de una transacción regresa al stock las cantidades de los artículos que el usuario tenía en su carrito y borra su carrito (necesario por la llave foránea de carrito_compra), borra su fotografía de fotos_usuarios y finalmente borra al usuario de usuarios. |
| **Respuesta correcta** | HTTP 200 {"mensaje":"Se borró el usuario"} |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"}. |

## 6. /alta_articulo (POST) · Artículos (RF-BE-1)

| Campo | Descripción |
|---|---|
| **Método HTTP** | POST |
| **Parámetros** | Objeto JSON en el cuerpo: nombre, descripcion, precio, cantidad (existencia), foto (base64), id_usuario y token. |
| **Funcionalidad** | Verifica el acceso con verifica_acceso y valida nombre, descripción, precio y cantidad. Dentro de una transacción inserta el artículo en la tabla stock y, si se envió fotografía, la inserta en fotos_articulos, relacionada por id_articulo. Si alguna instrucción falla se hace rollback. |
| **Respuesta correcta** | HTTP 200 {"mensaje":"OK"} |
| **Errores** | HTTP 400 con "Acceso denegado", "Se debe ingresar el nombre del artículo", "Se debe ingresar la descripción del artículo", "Se debe ingresar un precio válido" o "Se debe ingresar una cantidad válida". |

## 7. /consulta_articulos (GET) · Artículos (RF-BE-2)

| Campo | Descripción |
|---|---|
| **Método HTTP** | GET |
| **Parámetros** | palabra, id_usuario y token, en la URL. |
| **Funcionalidad** | Verifica el acceso. Busca la palabra en los campos nombre y descripcion de la tabla stock mediante una instrucción SELECT con LIKE (%palabra%) y regresa los artículos encontrados ordenados por nombre, cada uno con su fotografía. Si la palabra está vacía regresa todos los artículos. |
| **Respuesta correcta** | HTTP 200 con un arreglo JSON de artículos: id_articulo, foto, nombre, descripcion, precio y cantidad en existencia. Arreglo vacío si no hay coincidencias. |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"}. |

## 8. /compra_articulo (PUT) · Carrito de compra (RF-BE-3)

| Campo | Descripción |
|---|---|
| **Método HTTP** | PUT |
| **Parámetros** | id_articulo, cantidad, id_usuario y token, en la URL. |
| **Funcionalidad** | Verifica el acceso y que la cantidad sea mayor a cero. Dentro de una transacción consulta la existencia del artículo en stock (bloqueando el renglón con FOR UPDATE para evitar ventas simultáneas). Si la cantidad es menor o igual a la existencia: si el artículo no está en el carrito del usuario lo inserta en carrito_compra (RF-BE-3.1), y si ya está suma la cantidad (RF-BE-3.2); en ambos casos resta la cantidad del stock. Si la cantidad es mayor a la existencia no realiza la compra (RF-BE-3.3). |
| **Respuesta correcta** | HTTP 200 {"mensaje":"OK"} |
| **Errores** | HTTP 400 con "No hay suficientes artículos en el stock", "El artículo no existe", "La cantidad a comprar debe ser mayor a cero" o "Acceso denegado". |

## 9. /consulta_carrito_compra (GET) · Carrito de compra (apoyo a RF-FE-2.3)

| Campo | Descripción |
|---|---|
| **Método HTTP** | GET |
| **Parámetros** | id_usuario y token, en la URL. |
| **Funcionalidad** | Método adicional que usa la pantalla “Artículos en el carrito”. Verifica el acceso y consulta los artículos del carrito del usuario uniendo carrito_compra con stock; calcula el costo de cada artículo (cantidad × precio) y agrega su fotografía. |
| **Respuesta correcta** | HTTP 200 con un arreglo JSON: id_articulo, foto, nombre, cantidad, precio y costo. Arreglo vacío si el carrito no tiene artículos. |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"}. |

## 10. /elimina_articulo_carrito_compra (DELETE) · Carrito de compra (RF-BE-4)

| Campo | Descripción |
|---|---|
| **Método HTTP** | DELETE |
| **Parámetros** | id_usuario, id_articulo y token, en la URL. |
| **Funcionalidad** | Verifica el acceso. Dentro de una transacción obtiene la cantidad del artículo en el carrito del usuario, la regresa al stock con una instrucción UPDATE y borra el renglón de carrito_compra con una instrucción DELETE. |
| **Respuesta correcta** | HTTP 200 {"mensaje":"OK"} |
| **Errores** | HTTP 400 con "El artículo no está en el carrito de compra" o "Acceso denegado". |

## 11. /elimina_carrito_compra (DELETE) · Carrito de compra (RF-BE-5)

| Campo | Descripción |
|---|---|
| **Método HTTP** | DELETE |
| **Parámetros** | id_usuario y token, en la URL. |
| **Funcionalidad** | Verifica el acceso. Dentro de una transacción ejecuta una instrucción UPDATE a stock por cada artículo del carrito del usuario para regresar su cantidad, y después una instrucción DELETE que borra los renglones de carrito_compra de ese usuario (sin afectar los carritos de otros usuarios). |
| **Respuesta correcta** | HTTP 200 {"mensaje":"OK"} |
| **Errores** | HTTP 400 {"mensaje":"Acceso denegado"}. |
