# Mercadito Go

Prototipo de un sistema de comercio electrónico que usa un servicio web REST.
Tarea 7 de **Sistemas Distribuidos**, ESCOM – IPN.

El proyecto tiene tres capas:

- **Base de datos:** MySQL, base `servicio_web`.
- **Back-end:** servicio web REST en Java (JAX-RS con Jersey), desplegado en Apache Tomcat 8.5.
- **Front-end:** aplicación web en HTML, CSS y JavaScript, sin frameworks, pensada para usarse desde el celular.

## Funcionalidades

- Registro, inicio de sesión, perfil y eliminación de usuarios. Cada inicio de sesión genera un token nuevo.
- **Captura de artículo:** nombre, descripción, precio, existencia y fotografía.
- **Compra de artículos:** búsqueda por palabra en el nombre o la descripción, con foto, precio y cantidad a comprar.
- **Carrito de compra:** costo por artículo (cantidad × precio), total, eliminar un artículo, eliminar el carrito y seguir comprando.
- Todas las operaciones que modifican el stock y el carrito se hacen dentro de transacciones.

## Estructura

```
bd/
  tarea7_bd.sql                  Script de creación de la base de datos
backend/
  servicio/                      Servicio.java, Articulo.java, Usuario.java, Respuesta.java
  WEB-INF/web.xml                Configuración de Jersey
  META-INF/context.example.xml   Plantilla de la conexión a MySQL (sin contraseña)
  compila.sh / compila.bat       Compilan y despliegan Servicio.war en Tomcat
frontend/
  prueba.html                    Las 6 pantallas de la aplicación
  estilos.css                    Estilos (paleta "Menta clara")
  app.js                         Navegación entre pantallas y llamadas al servicio web
  WSClient.js                    Cliente del servicio web proporcionado por el profesor
pruebas/
  pruebas_curl.sh                Pruebas unitarias del back-end con curl
docs/
  contrato_descripcion_openapi.yaml   Contrato de descripción (OpenAPI 3.0.3)
  contrato_semantico.md               Contrato semántico (qué hace cada método)
  pruebas.md                          Pruebas de los requerimientos funcionales
```

## Métodos del servicio web

URL base: `https://<dominio>/Servicio/rest/ws`

| Método | Verbo | Descripción |
|---|---|---|
| `/login` | GET | Inicia sesión y regresa `id_usuario` y `token` |
| `/alta_usuario` | POST | Registra un usuario |
| `/consulta_usuario` | GET | Consulta el perfil del usuario |
| `/modifica_usuario` | PUT | Modifica el perfil del usuario |
| `/borra_usuario` | DELETE | Borra al usuario y regresa su carrito al stock |
| `/alta_articulo` | POST | Da de alta un artículo y su fotografía |
| `/consulta_articulos` | GET | Busca artículos con `LIKE` en nombre y descripción |
| `/compra_articulo` | PUT | Agrega un artículo al carrito y lo resta del stock |
| `/consulta_carrito_compra` | GET | Regresa el carrito del usuario con el costo de cada artículo |
| `/elimina_articulo_carrito_compra` | DELETE | Quita un artículo del carrito y lo regresa al stock |
| `/elimina_carrito_compra` | DELETE | Vacía el carrito y regresa todo al stock |

Los detalles de cada método están en [`docs/contrato_semantico.md`](docs/contrato_semantico.md)
y en [`docs/contrato_descripcion_openapi.yaml`](docs/contrato_descripcion_openapi.yaml).

## Pruebas

Las pruebas de cada requerimiento funcional del back-end (con `curl`) y del front-end (en el celular)
están en [`docs/pruebas.md`](docs/pruebas.md).

## Instalación (máquina virtual Ubuntu con Tomcat y MySQL)

### 1. Base de datos

```bash
mysql -u TU_USUARIO -p < bd/tarea7_bd.sql
```

### 2. Back-end

En la carpeta `backend/`:

1. Copia en `WEB-INF/lib/` las bibliotecas de Jersey, Jackson y el conector de MySQL (no se incluyen en el repositorio).
2. Crea la configuración de la conexión a MySQL y escribe tu usuario y tu contraseña:

   ```bash
   cp META-INF/context.example.xml META-INF/context.xml
   ```

3. Revisa la ruta de Tomcat en `compila.sh` (`CATALINA_HOME`), luego compila y despliega:

   ```bash
   sh compila.sh
   ```

### 3. Front-end

Copia los archivos de `frontend/` a la carpeta `webapps/ROOT/` de Tomcat y abre
`https://<dominio>/prueba.html` en el celular.

## Créditos

- `WSClient.js`, `Usuario.java`, `Respuesta.java`, los scripts de compilación y la base de `Servicio.java`
  (métodos de usuarios) son del profesor Carlos Pineda Guerrero. `WSClient.js` se distribuye bajo la licencia GPL v3.
- Los métodos de artículos y carrito de compra, la base de datos de la Tarea 7, el front-end y los contratos
  se desarrollaron con ayuda de Claude, un asistente de inteligencia artificial de Anthropic.
- Luis Ramón Cortés Vizcaíno definió el diseño y la identidad de la aplicación (nombre, colores y pantallas),
  configuró la máquina virtual en Azure, MySQL, Tomcat y HTTPS, desplegó el servicio y realizó y documentó
  las pruebas del back-end y del front-end.
