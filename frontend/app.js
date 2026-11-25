/*
  app.js — Mercadito Go (front-end de la Tarea 7)
  JavaScript puro, sin frameworks. Usa WSClient.js (del profesor) para llamar al servicio web REST.

  Contenido:
    1. Configuración y estado
    2. Utilidades (SHA-256, dinero, fechas, imágenes, sesión guardada)
    3. Llamadas al servicio web (WSClient envuelto en Promises)
    4. Avisos y ventana de confirmación
    5. Sesión (usuario, piezas del carrito, errores)
    6. Navegación entre pantallas (#/entrar, #/registro, #/compra, #/carrito, #/captura, #/perfil)
    7. Pantallas: Inicio de sesión, Registro, Compra, Carrito, Captura, Perfil
    8. Arranque
*/
"use strict";

// =====================================================================
//  1. Configuración y estado
// =====================================================================

const URL_SERVICIO = "/Servicio/rest/ws";
const ESPERA_MAXIMA_MS = 20000;

let sesion = leerSesion(); // { id_usuario, token } o null si no hay sesión
let usuario = null;        // datos del perfil (para el saludo y el avatar)
let piezas = 0;            // total de piezas en el carrito (burbuja de la pestaña)

function get(id) {
  return document.getElementById(id);
}

// Evita que un texto del servicio se interprete como HTML
function escapa(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Ícono de línea (los <symbol> están al inicio de prueba.html)
function icono(nombre, tam, clase) {
  return `<svg class="i ${clase || ""}" width="${tam}" height="${tam}" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
}

// =====================================================================
//  2. Utilidades
// =====================================================================

/*
  SHA-256 en JavaScript puro (la misma función de la Tarea 1).
  Se mantiene igual para que las contraseñas ya registradas sigan funcionando.
  Solo acepta caracteres ASCII (sin acentos ni ñ).
*/
function sha256(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const maxWord = Math.pow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) throw new Error("La contraseña solo puede tener letras sin acentos, números y símbolos básicos.");
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++)
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : "") + b.toString(16);
    }
  return result;
}

const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dinero = (n) => pesos.format(Number(n) || 0);

// Foto en base64 (como la manda el servicio) -> URL para <img>
const srcFoto = (base64) => (base64 ? "data:image/jpeg;base64," + base64 : null);

// Fecha y hora de nacimiento (input datetime-local, igual que en la Tarea 1).
// "2003-03-07T08:30" -> "2003-03-07T08:30:00.000"
// Se manda tal cual la escribió el usuario (sin convertir a UTC), así la hora
// que se guarda es la misma que se vuelve a mostrar al consultar el perfil.
function fechaParaServicio(valor) {
  if (!valor) return null;
  const v = String(valor);
  return v.length === 10 ? v + "T00:00:00.000" : v.slice(0, 16) + ":00.000";
}

// "2003-03-07T08:30:00.000" (servicio) -> "2003-03-07T08:30" (input datetime-local)
const fechaParaInput = (valor) => (valor ? String(valor).slice(0, 16) : "");

const iniciales = (nombre, apellido) =>
  (((nombre || "").trim()[0] || "") + ((apellido || "").trim()[0] || "")).toUpperCase() || "?";

/*
  Lee una imagen elegida por el usuario, la reduce (máx. 900 px por lado)
  y la regresa como JPEG en base64 sin el prefijo "data:...".
  Así las fotos tomadas con el celular no pesan varios MB.
*/
function leerImagen(file, max = 900, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No se eligió ninguna imagen"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", calidad).split(",")[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Sesión guardada en el navegador (sessionStorage). En modo privado puede fallar,
// por eso va dentro de try/catch: en ese caso la sesión vive solo en memoria.
const CLAVE_SESION = "mercadito-go:sesion";

function leerSesion() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null");
    return s && s.token ? s : null;
  } catch (e) {
    return null;
  }
}

function guardarSesion(s) {
  try {
    if (s) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch (e) {
    /* sin almacenamiento */
  }
}

// =====================================================================
//  3. Llamadas al servicio web
// =====================================================================

/*
  WSClient trabaja con callbacks: function(code, result).
  Aquí lo envolvemos en Promises para poder usar "await":
    - se resuelve con el JSON de la respuesta si el código HTTP es 200
    - se rechaza con un ErrorServicio (con .message y .status) en cualquier otro caso
*/
class ErrorServicio extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

// WSClient convierte cada valor con JSON.stringify; quitamos los null/undefined
// para no mandar parámetros como "palabra=undefined".
function limpiar(args) {
  const r = {};
  for (const nombre in args || {}) {
    if (args[nombre] !== undefined && args[nombre] !== null) r[nombre] = args[nombre];
  }
  return r;
}

function llamar(metodo, operacion, opciones) {
  const query = (opciones && opciones.query) || {};
  const body = (opciones && opciones.body) || {};
  return new Promise((resolve, reject) => {
    if (typeof WSClient !== "function") {
      reject(new ErrorServicio("No se cargó WSClient.js. Revisa que esté junto a prueba.html.", 0));
      return;
    }
    const cliente = new WSClient(URL_SERVICIO);

    // WSClient muestra un alert y no llama al callback si falla la red;
    // con este límite de tiempo la pantalla no se queda esperando para siempre.
    const limite = setTimeout(
      () => reject(new ErrorServicio("El servidor no respondió. Revisa tu conexión.", 0)),
      ESPERA_MAXIMA_MS
    );

    const alResponder = (code, result) => {
      clearTimeout(limite);
      if (code === 200) resolve(result);
      else reject(new ErrorServicio((result && result.mensaje) || "Error del servidor (" + code + ")", code));
    };

    if (metodo === "GET") cliente.get(operacion, limpiar(query), alResponder);
    else if (metodo === "POST") cliente.post(operacion, body, alResponder);
    else if (metodo === "PUT") cliente.put(operacion, limpiar(query), body, alResponder);
    else if (metodo === "DELETE") cliente.delete(operacion, limpiar(query), alResponder);
  });
}

// Credenciales de la sesión actual
const cred = () => ({ id_usuario: sesion.id_usuario, token: sesion.token });

const servicio = {
  // ----- Usuarios (Tarea 1) -----
  login: (email, passwordSha256) => llamar("GET", "login", { query: { email: email, password: passwordSha256 } }),
  altaUsuario: (u) => llamar("POST", "alta_usuario", { body: u }),
  consultaUsuario: () => llamar("GET", "consulta_usuario", { query: cred() }),
  modificaUsuario: (u) => llamar("PUT", "modifica_usuario", { query: cred(), body: u }),
  borraUsuario: () => llamar("DELETE", "borra_usuario", { query: cred() }),

  // ----- Artículos y carrito (Tarea 7) -----
  altaArticulo: (articulo) => llamar("POST", "alta_articulo", { body: Object.assign({}, articulo, cred()) }),
  consultaArticulos: (palabra) =>
    llamar("GET", "consulta_articulos", { query: Object.assign({ palabra: palabra || "" }, cred()) }),
  compraArticulo: (id_articulo, cantidad) =>
    llamar("PUT", "compra_articulo", { query: Object.assign({ id_articulo: id_articulo, cantidad: cantidad }, cred()) }),
  consultaCarrito: () => llamar("GET", "consulta_carrito_compra", { query: cred() }),
  eliminaArticuloCarrito: (id_articulo) =>
    llamar("DELETE", "elimina_articulo_carrito_compra", { query: Object.assign(cred(), { id_articulo: id_articulo }) }),
  eliminaCarrito: () => llamar("DELETE", "elimina_carrito_compra", { query: cred() }),
};

// =====================================================================
//  4. Avisos y ventana de confirmación
// =====================================================================

// Mensajes cortos que aparecen arriba y se ocultan solos. tipo: "exito" | "error" | "info"
let temporizadorAviso;
function aviso(mensaje, tipo) {
  const zona = get("aviso_zona");
  clearTimeout(temporizadorAviso);
  zona.innerHTML = "";
  const div = document.createElement("div");
  div.className = "aviso aviso--" + (tipo || "info");
  div.textContent = mensaje;
  zona.appendChild(div);
  temporizadorAviso = setTimeout(() => (zona.innerHTML = ""), 3200);
}

// Ventana de confirmación propia (en lugar de window.confirm). Regresa una Promise con true/false.
// Uso: if (await confirmar({ titulo, mensaje, aceptar: "Eliminar", peligro: true })) { ... }
let resolverDialogo = null;
function confirmar(opciones) {
  return new Promise((resolve) => {
    if (resolverDialogo) resolverDialogo(false);
    resolverDialogo = resolve;
    get("dialogo_titulo").textContent = opciones.titulo;
    get("dialogo_mensaje").textContent = opciones.mensaje || "";
    get("dialogo_mensaje").hidden = !opciones.mensaje;
    get("dialogo_cancelar").textContent = opciones.cancelar || "Cancelar";
    get("dialogo_aceptar").textContent = opciones.aceptar || "Aceptar";
    get("dialogo_aceptar").className = "btn " + (opciones.peligro ? "btn--peligro" : "btn--primario");
    get("dialogo_fondo").hidden = false;
    get("dialogo_cancelar").focus();
  });
}

function cerrarDialogo(respuesta) {
  get("dialogo_fondo").hidden = true;
  const resolver = resolverDialogo;
  resolverDialogo = null;
  if (resolver) resolver(respuesta);
}

// =====================================================================
//  5. Sesión
// =====================================================================

function iniciarSesion(datos) {
  sesion = { id_usuario: datos.id_usuario, token: datos.token };
  guardarSesion(sesion);
  refrescarUsuario();
  refrescarCarrito();
}

function cerrarSesion() {
  guardarSesion(null);
  sesion = null;
  usuario = null;
  piezas = 0;
  pintarPiezas();
  pintarSaludo();
  ir("entrar", true);
}

// Si el token ya no sirve (otra persona inició sesión con la misma cuenta,
// o se borró el usuario), el servicio responde "Acceso denegado".
function manejarError(e) {
  if (e && e.status === 400 && e.message === "Acceso denegado") {
    cerrarSesion();
    aviso("Tu sesión terminó. Vuelve a entrar.", "error");
  } else {
    aviso((e && e.message) || "Ocurrió un error", "error");
  }
}

async function refrescarUsuario() {
  if (!sesion) return null;
  try {
    usuario = await servicio.consultaUsuario();
    pintarSaludo();
    return usuario;
  } catch (e) {
    manejarError(e);
    return null;
  }
}

// Consulta el carrito y actualiza el número de piezas. Regresa la lista (o null si hubo error).
async function refrescarCarrito() {
  if (!sesion) return [];
  try {
    const items = await servicio.consultaCarrito();
    piezas = items.reduce((total, a) => total + a.cantidad, 0);
    pintarPiezas();
    return items;
  } catch (e) {
    manejarError(e);
    return null;
  }
}

// Número de piezas en la pestaña "Carrito" y en el botón "Carrito de compra"
function pintarPiezas() {
  const texto = piezas > 99 ? "99+" : String(piezas);
  ["pestana_piezas", "compra_piezas"].forEach((id) => {
    get(id).textContent = texto;
    get(id).hidden = piezas <= 0;
  });
}

function pintarSaludo() {
  get("compra_saludo").textContent = "Hola" + (usuario && usuario.nombre ? ", " + usuario.nombre : "");
}

// =====================================================================
//  6. Navegación entre pantallas
// =====================================================================

/*
  Cada pantalla es un <section id="pantalla_..."> en prueba.html.
  La pantalla actual va en la dirección después de "#" (ej. prueba.html#/compra),
  así funciona el botón "atrás" del celular y Tomcat no necesita configuración extra.
*/
const SIN_SESION = ["entrar", "registro"];
const CON_SESION = ["compra", "carrito", "captura", "perfil"];
const AL_ABRIR = {
  entrar: abrirLogin,
  registro: abrirRegistro,
  compra: abrirCompra,
  carrito: abrirCarrito,
  captura: abrirCaptura,
  perfil: abrirPerfil,
};

const rutaActual = () => location.hash.replace(/^#\/?/, "");

// Cambia de pantalla. reemplazar = true no deja la pantalla anterior en el historial.
function ir(ruta, reemplazar) {
  if (rutaActual() === ruta) return mostrarPantalla();
  if (reemplazar) location.replace("#/" + ruta);
  else location.hash = "#/" + ruta;
}

function mostrarPantalla() {
  const ruta = rutaActual();
  // Sin sesión solo se puede entrar o registrarse; con sesión, solo las 4 pestañas.
  if (!sesion && SIN_SESION.indexOf(ruta) < 0) return ir("entrar", true);
  if (sesion && CON_SESION.indexOf(ruta) < 0) return ir("compra", true);

  get("zona_acceso").hidden = !!sesion;
  get("zona_app").hidden = !sesion;
  SIN_SESION.concat(CON_SESION).forEach((r) => (get("pantalla_" + r).hidden = r !== ruta));

  document.querySelectorAll(".pestana").forEach((p) => {
    const activa = p.dataset.ruta === ruta;
    p.classList.toggle("pestana--activa", activa);
    if (activa) p.setAttribute("aria-current", "page");
    else p.removeAttribute("aria-current");
  });

  window.scrollTo(0, 0);
  AL_ABRIR[ruta]();
}

// =====================================================================
//  7. Pantallas
// =====================================================================

// Foto de producto: la imagen o, si no tiene, la inicial del nombre
function fotoProducto(foto, nombre, clase) {
  const src = srcFoto(foto);
  const dentro = src
    ? `<img src="${src}" alt="" loading="lazy">`
    : `<span>${escapa((nombre || "?").trim().charAt(0).toUpperCase())}</span>`;
  return `<div class="foto-producto ${clase}">${dentro}</div>`;
}

// Botón de carga: lo deshabilita y cambia su texto mientras espera
function cargando(boton, texto) {
  if (!boton.dataset.texto) boton.dataset.texto = boton.textContent;
  boton.disabled = !!texto;
  boton.textContent = texto || boton.dataset.texto;
}

// ===================== Inicio de sesión =====================

// Cuadrícula decorativa de íconos (arriba del título)
function llenarPatron() {
  const nombres = ["carrito", "botella", "bolsa", "canasta", "casa"];
  let html = "";
  for (let i = 0; i < 120; i++) {
    html += `<span class="patron-celda">${icono(nombres[i % nombres.length], 26)}</span>`;
  }
  get("patron").innerHTML = html;
}

function abrirLogin() {
  get("form_login").reset();
}

async function entrar(e) {
  e.preventDefault();
  const boton = get("login_boton");
  cargando(boton, "Entrando…");
  try {
    const datos = await servicio.login(get("login_email").value.trim(), sha256(get("login_password").value));
    iniciarSesion(datos);
    ir("compra", true);
  } catch (err) {
    aviso(err.message === "Acceso denegado" ? "El email o la contraseña no son correctos." : err.message, "error");
  } finally {
    cargando(boton, null);
  }
}

// ===================== Registro de usuario =====================

let fotoRegistro = null;

function abrirRegistro() {
  get("form_registro").reset();
  fotoRegistro = null;
  pintarFotoRegistro();
}

function pintarFotoRegistro() {
  get("registro_avatar").innerHTML = fotoRegistro
    ? `<img src="${srcFoto(fotoRegistro)}" alt="">`
    : icono("usuario", 30);
  get("registro_texto_foto").textContent = fotoRegistro ? "Cambiar foto" : "Elegir foto";
  get("registro_quitar_foto").hidden = !fotoRegistro;
}

async function registrar(e) {
  e.preventDefault();
  const boton = get("registro_boton");
  cargando(boton, "Registrando…");
  try {
    const telefono = get("registro_telefono").value;
    await servicio.altaUsuario({
      email: get("registro_email").value.trim(),
      password: sha256(get("registro_password").value),
      nombre: get("registro_nombre").value.trim(),
      apellido_paterno: get("registro_apellido_paterno").value.trim(),
      apellido_materno: get("registro_apellido_materno").value.trim() || null,
      fecha_nacimiento: fechaParaServicio(get("registro_fecha_nacimiento").value),
      telefono: telefono ? Number(telefono) : null,
      genero: get("registro_genero").value || null,
      foto: fotoRegistro,
    });
    aviso("Se registró el usuario. Ya puedes entrar.", "exito");
    ir("entrar", true);
  } catch (err) {
    aviso(err.message, "error");
  } finally {
    cargando(boton, null);
  }
}

// ===================== Compra de artículos (RF-FE-2, 2.1, 2.2, 2.3) =====================

let articulos = null;   // resultado de la búsqueda (null = cargando)
let buscada = "";       // palabra de la última búsqueda
let filtro = "todos";   // "todos" | "existencia" | "precio"
let cantidades = {};    // cantidad capturada en cada tarjeta: { id_articulo: n }
let numeroBusqueda = 0; // para ignorar respuestas de búsquedas anteriores

// RF-FE-2: pantalla "Compra de artículos". Es la primera que ve el usuario al entrar.
function abrirCompra() {
  get("buscar_palabra").value = "";
  filtro = "todos";
  articulos = null;
  buscada = "";
  cantidades = {};
  pintarFiltros();
  pintarArticulos();
  buscar("");
}

// Busca la palabra en "nombre" y "descripcion" (RF-BE-2)
async function buscar(texto) {
  const numero = ++numeroBusqueda;
  try {
    const lista = await servicio.consultaArticulos(texto);
    if (numero !== numeroBusqueda) return;
    articulos = lista;
    buscada = texto;
  } catch (e) {
    if (numero !== numeroBusqueda) return;
    manejarError(e);
    articulos = [];
  }
  pintarArticulos();
}

function pintarFiltros() {
  document.querySelectorAll(".filtro").forEach((b) => {
    const activo = b.dataset.filtro === filtro;
    b.classList.toggle("filtro--activo", activo);
    b.setAttribute("aria-pressed", activo);
  });
}

function articulosVisibles() {
  if (!articulos) return null;
  let lista = articulos;
  if (filtro === "existencia") lista = lista.filter((a) => a.cantidad > 0);
  if (filtro === "precio") lista = lista.slice().sort((a, b) => a.precio - b.precio);
  return lista;
}

function pintarArticulos() {
  const visibles = articulosVisibles();

  const resultado = get("resultado_busqueda");
  resultado.hidden = !(buscada && articulos);
  if (buscada && articulos) {
    get("resultado_texto").textContent =
      `${articulos.length} ${articulos.length === 1 ? "resultado" : "resultados"} para “${buscada}”`;
  }

  let html;
  if (visibles === null) {
    html = '<div class="rejilla">' + '<div class="tarjeta-articulo esqueleto"></div>'.repeat(4) + "</div>";
  } else if (visibles.length === 0) {
    html = buscada
      ? `<div class="vacio"><b>Sin resultados</b>No encontramos artículos con “${escapa(buscada)}”. Prueba con otra palabra.</div>`
      : `<div class="vacio"><b>Todavía no hay artículos</b>Agrega el primero desde Captura de artículo.
           <a class="btn btn--primario" href="#/captura">Captura de artículo</a></div>`;
  } else {
    html = '<div class="rejilla">' + visibles.map(tarjetaArticulo).join("") + "</div>";
  }
  get("articulos").innerHTML = html;
}

// RF-FE-2.1: foto, nombre, descripción, precio, campo "Cantidad" (default 1) y botón "Compra"
function tarjetaArticulo(a) {
  const id = a.id_articulo;
  const agotado = a.cantidad === 0;
  const max = Math.max(1, a.cantidad == null ? 999 : a.cantidad);
  const valor = cantidades[id] === undefined ? 1 : cantidades[id];
  const existencia =
    a.cantidad == null
      ? ""
      : `<span class="existencia${agotado ? " existencia--agotado" : ""}">${agotado ? "Agotado" : a.cantidad + " en existencia"}</span>`;

  return `
    <article class="tarjeta-articulo" data-id="${id}" data-max="${max}">
      ${fotoProducto(a.foto, a.nombre, "tarjeta-articulo-foto")}
      <div class="tarjeta-articulo-cuerpo">
        <h3>${escapa(a.nombre)}</h3>
        <p class="tarjeta-articulo-desc">${escapa(a.descripcion)}</p>
        <span class="etiqueta-precio">${dinero(a.precio)}</span>
        ${existencia}
        <div class="selector">
          <label class="selector-etiqueta" for="cantidad-${id}">Cantidad</label>
          <div class="selector-control">
            <button type="button" aria-label="Menos" data-accion="menos" ${valor === "" || valor <= 1 ? "disabled" : ""}>${icono("menos", 16, "i--grueso")}</button>
            <input id="cantidad-${id}" type="number" inputmode="numeric" min="1" max="${max}" value="${valor}">
            <button type="button" aria-label="Más" data-accion="mas" ${valor !== "" && valor >= max ? "disabled" : ""}>${icono("mas", 16, "i--grueso")}</button>
          </div>
        </div>
        <button type="button" class="btn btn--primario btn--ancho btn--chico" data-accion="comprar" ${agotado ? "disabled" : ""}>Compra</button>
      </div>
    </article>`;
}

// Selector de cantidad: los botones − y + respetan la existencia (máximo). Si el usuario escribe
// más a mano, se respeta su número y el servicio responde "No hay suficientes artículos en el stock".
function fijarCantidad(tarjeta, n, respetarMax) {
  const max = Number(tarjeta.dataset.max);
  const valido = Number.isFinite(n) ? Math.max(1, n) : 1;
  const valor = respetarMax ? Math.min(max, valido) : valido;
  tarjeta.querySelector("input").value = valor;
  actualizarSelector(tarjeta);
}

function actualizarSelector(tarjeta) {
  const input = tarjeta.querySelector("input");
  const max = Number(tarjeta.dataset.max);
  const valor = input.value === "" ? "" : parseInt(input.value, 10);
  cantidades[tarjeta.dataset.id] = valor;
  tarjeta.querySelector('[data-accion="menos"]').disabled = valor === "" || valor <= 1;
  tarjeta.querySelector('[data-accion="mas"]').disabled = valor !== "" && valor >= max;
}

// RF-FE-2.2: compra el artículo con la cantidad capturada (RF-BE-3)
async function comprar(tarjeta, boton) {
  const id = Number(tarjeta.dataset.id);
  const articulo = articulos.find((a) => a.id_articulo === id);
  const n = parseInt(tarjeta.querySelector("input").value, 10);
  if (!(n > 0)) return aviso("La cantidad debe ser mayor a cero", "error");

  cargando(boton, "Comprando…");
  try {
    await servicio.compraArticulo(id, n);
    aviso(`Agregaste ${n} × ${articulo.nombre} al carrito`, "exito");
    cantidades[id] = 1;
    // Se vuelve a buscar para ver la nueva existencia y se actualizan las piezas del carrito
    await Promise.all([buscar(buscada), refrescarCarrito()]);
  } catch (e) {
    manejarError(e);
  } finally {
    cargando(boton, null);
    boton.disabled = articulo.cantidad === 0;
  }
}

// ===================== Artículos en el carrito (RF-FE-2.3 a 2.6) =====================

let itemsCarrito = null; // null = cargando
let carritoOcupado = false;

function abrirCarrito() {
  itemsCarrito = null;
  pintarCarrito();
  cargarCarrito();
}

async function cargarCarrito() {
  const lista = await refrescarCarrito();
  if (lista) {
    itemsCarrito = lista;
    pintarCarrito();
  }
}

const costo = (a) => Number(a.costo != null ? a.costo : a.cantidad * a.precio);

function pintarCarrito() {
  const items = itemsCarrito;
  const total = (items || []).reduce((s, a) => s + costo(a), 0);
  const n = (items || []).reduce((s, a) => s + a.cantidad, 0);

  get("carrito_subtitulo").textContent =
    items && items.length > 0
      ? `${items.length} ${items.length === 1 ? "artículo" : "artículos"} · ${n} ${n === 1 ? "pieza" : "piezas"}`
      : "Revisa lo que vas a llevar";

  let html;
  if (items === null) {
    html = '<div class="lista">' + '<div class="renglon esqueleto"></div>'.repeat(2) + "</div>";
  } else if (items.length === 0) {
    html = `<div class="vacio"><b>Tu carrito está vacío</b>Busca artículos y presiona Compra para agregarlos.
              <a class="btn btn--primario" href="#/compra">Seguir comprando</a></div>`;
  } else {
    // RF-FE-2.3: imagen, nombre, cantidad, precio y costo (cantidad × precio). RF-FE-2.4: "Eliminar artículo"
    html =
      '<div class="lista">' +
      items
        .map(
          (a) => `
        <article class="renglon">
          ${fotoProducto(a.foto, a.nombre, "renglon-foto")}
          <div class="renglon-info">
            <h3>${escapa(a.nombre)}</h3>
            <p>Cantidad ${a.cantidad} · ${dinero(a.precio)} c/u</p>
          </div>
          <div class="renglon-lado">
            <strong title="Costo (cantidad × precio)">${dinero(costo(a))}</strong>
            <button type="button" class="enlace enlace--peligro" data-id="${a.id_articulo}">Eliminar artículo</button>
          </div>
        </article>`
        )
        .join("") +
      "</div>";
  }
  get("carrito_lista").innerHTML = html;

  // Total de la compra y botones "Eliminar carrito" y "Seguir comprando"
  get("carrito_ticket").hidden = !(items && items.length > 0);
  get("carrito_total").textContent = dinero(total);
  ocuparCarrito(carritoOcupado);
}

// Mientras se elimina algo, los botones de eliminar quedan deshabilitados
function ocuparCarrito(ocupado) {
  carritoOcupado = ocupado;
  document.querySelectorAll("#carrito_lista button, #eliminar_carrito").forEach((b) => (b.disabled = ocupado));
}

// RF-FE-2.4: elimina un artículo del carrito (RF-BE-4)
async function eliminarArticulo(id) {
  const a = itemsCarrito.find((x) => x.id_articulo === id);
  ocuparCarrito(true);
  try {
    await servicio.eliminaArticuloCarrito(id);
    aviso(`Se eliminó ${a.nombre} del carrito`, "exito");
    await cargarCarrito();
  } catch (e) {
    manejarError(e);
  } finally {
    ocuparCarrito(false);
  }
}

// RF-FE-2.5: borra todo el carrito (RF-BE-5)
async function eliminarCarrito() {
  const ok = await confirmar({
    titulo: "¿Eliminar el carrito?",
    mensaje: "Se quitarán todos los artículos y regresarán al stock.",
    aceptar: "Eliminar carrito",
    peligro: true,
  });
  if (!ok) return;
  ocuparCarrito(true);
  try {
    await servicio.eliminaCarrito();
    aviso("Se eliminó el carrito", "exito");
    await cargarCarrito();
  } catch (e) {
    manejarError(e);
  } finally {
    ocuparCarrito(false);
  }
}

// ===================== Captura de artículo (RF-FE-1) =====================

let fotoArticulo = null;

function abrirCaptura() {
  get("form_captura").reset();
  fotoArticulo = null;
  pintarFotoArticulo();
}

function pintarFotoArticulo() {
  const hay = !!fotoArticulo;
  get("captura_foto").classList.toggle("foto-articulo--con-foto", hay);
  get("captura_foto_img").hidden = !hay;
  get("captura_foto_cambiar").hidden = !hay;
  get("captura_foto_hueco").hidden = hay;
  if (hay) get("captura_foto_img").src = srcFoto(fotoArticulo);
  else get("captura_foto_img").removeAttribute("src");
}

// Da de alta el artículo con su foto (RF-BE-1)
async function guardarArticulo(e) {
  e.preventDefault();
  const boton = get("captura_boton");
  const nombre = get("captura_nombre").value.trim();
  cargando(boton, "Guardando…");
  try {
    await servicio.altaArticulo({
      nombre: nombre,
      descripcion: get("captura_descripcion").value.trim(),
      precio: Number(get("captura_precio").value),
      cantidad: parseInt(get("captura_cantidad").value, 10),
      foto: fotoArticulo,
    });
    aviso(`Se guardó “${nombre}” en el stock`, "exito");
    abrirCaptura(); // deja el formulario limpio para capturar otro artículo
  } catch (err) {
    manejarError(err);
  } finally {
    cargando(boton, null);
  }
}

// ===================== Perfil del usuario (Salir y Eliminar perfil) =====================

let fotoPerfil = null;

async function abrirPerfil() {
  fotoPerfil = usuario ? usuario.foto || null : null;
  get("perfil_cargando").hidden = false;
  get("form_perfil").hidden = true;
  mostrarMasDatos(false);
  pintarCabeceraPerfil();

  const u = await refrescarUsuario();
  if (!u || rutaActual() !== "perfil") return;
  fotoPerfil = u.foto || null;
  get("perfil_nombre_input").value = u.nombre || "";
  get("perfil_apellido_paterno").value = u.apellido_paterno || "";
  get("perfil_apellido_materno").value = u.apellido_materno || "";
  get("perfil_email_input").value = u.email || "";
  get("perfil_password").value = "";
  get("perfil_fecha_nacimiento").value = fechaParaInput(u.fecha_nacimiento);
  get("perfil_telefono").value = u.telefono != null ? String(u.telefono) : "";
  get("perfil_genero").value = u.genero || "";
  get("perfil_cargando").hidden = true;
  get("form_perfil").hidden = false;
  pintarCabeceraPerfil();
}

function pintarCabeceraPerfil() {
  const u = usuario || {};
  const avatar = get("perfil_avatar");
  if (fotoPerfil) avatar.innerHTML = `<img src="${srcFoto(fotoPerfil)}" alt="">`;
  else avatar.textContent = iniciales(u.nombre, u.apellido_paterno);
  get("perfil_nombre").textContent =
    [u.nombre, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(" ") || "…";
  get("perfil_email").textContent = u.email || "";
  get("perfil_quitar_foto").hidden = !fotoPerfil;
}

function mostrarMasDatos(mostrar) {
  get("perfil_mas_datos").hidden = !mostrar;
  get("perfil_desplegar").setAttribute("aria-expanded", mostrar);
  get("perfil_desplegar_texto").textContent = mostrar ? "Menos datos" : "Más datos";
}

async function guardarPerfil(e) {
  e.preventDefault();
  const boton = get("perfil_boton");
  cargando(boton, "Guardando…");
  try {
    const password = get("perfil_password").value;
    const telefono = get("perfil_telefono").value;
    const cambios = {
      email: get("perfil_email_input").value.trim(),
      password: password ? sha256(password) : "",
      nombre: get("perfil_nombre_input").value.trim(),
      apellido_paterno: get("perfil_apellido_paterno").value.trim(),
      apellido_materno: get("perfil_apellido_materno").value.trim() || null,
      fecha_nacimiento: fechaParaServicio(get("perfil_fecha_nacimiento").value),
      telefono: telefono ? Number(telefono) : null,
      genero: get("perfil_genero").value || null,
      foto: fotoPerfil,
    };
    await servicio.modificaUsuario(cambios);
    usuario = Object.assign({}, usuario, cambios);
    delete usuario.password;
    get("perfil_password").value = "";
    pintarSaludo();
    pintarCabeceraPerfil();
    aviso("Se guardaron los cambios del perfil", "exito");
  } catch (err) {
    manejarError(err);
  } finally {
    cargando(boton, null);
  }
}

async function eliminarPerfil() {
  const ok = await confirmar({
    titulo: "¿Deseas eliminar el perfil del usuario?",
    mensaje: "Se borrarán tu cuenta y tus datos. Lo que tengas en el carrito regresará al stock. No se puede deshacer.",
    aceptar: "Eliminar perfil",
    peligro: true,
  });
  if (!ok) return;
  try {
    await servicio.borraUsuario();
    aviso("Se eliminó el perfil del usuario", "exito");
    cerrarSesion();
  } catch (err) {
    manejarError(err);
  }
}

// Al elegir una foto (registro, captura o perfil): se reduce y se guarda en base64
function alElegirFoto(input, guardar) {
  input.addEventListener("change", async () => {
    try {
      guardar(await leerImagen(input.files[0]));
    } catch (err) {
      aviso(err.message, "error");
    }
    input.value = ""; // permite volver a elegir la misma foto
  });
}

// =====================================================================
//  8. Arranque: se conectan los botones y formularios con sus funciones
// =====================================================================

function iniciar() {
  llenarPatron();

  // Inicio de sesión y registro
  get("form_login").addEventListener("submit", entrar);
  get("form_registro").addEventListener("submit", registrar);
  alElegirFoto(get("registro_archivo"), (f) => { fotoRegistro = f; pintarFotoRegistro(); });
  get("registro_quitar_foto").addEventListener("click", () => { fotoRegistro = null; pintarFotoRegistro(); });

  // Compra de artículos
  get("form_buscar").addEventListener("submit", (e) => {
    e.preventDefault();
    buscar(get("buscar_palabra").value.trim());
  });
  get("ver_todo").addEventListener("click", () => {
    get("buscar_palabra").value = "";
    buscar("");
  });
  document.querySelectorAll(".filtro").forEach((b) =>
    b.addEventListener("click", () => {
      filtro = b.dataset.filtro;
      pintarFiltros();
      pintarArticulos();
    })
  );
  // Las tarjetas se dibujan con innerHTML, así que sus botones se atienden desde el contenedor
  const lista = get("articulos");
  lista.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-accion]");
    if (!boton) return;
    const tarjeta = boton.closest(".tarjeta-articulo");
    const valor = parseInt(tarjeta.querySelector("input").value, 10);
    if (boton.dataset.accion === "menos") fijarCantidad(tarjeta, (valor || 0) - 1, true);
    if (boton.dataset.accion === "mas") fijarCantidad(tarjeta, (valor || 0) + 1, true);
    if (boton.dataset.accion === "comprar") comprar(tarjeta, boton);
  });
  lista.addEventListener("input", (e) => {
    if (e.target.matches("input")) actualizarSelector(e.target.closest(".tarjeta-articulo"));
  });
  lista.addEventListener("focusout", (e) => {
    if (e.target.matches("input")) fijarCantidad(e.target.closest(".tarjeta-articulo"), parseInt(e.target.value, 10), false);
  });

  // Carrito
  get("carrito_lista").addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-id]");
    if (boton) eliminarArticulo(Number(boton.dataset.id));
  });
  get("eliminar_carrito").addEventListener("click", eliminarCarrito);

  // Captura de artículo
  get("form_captura").addEventListener("submit", guardarArticulo);
  alElegirFoto(get("captura_archivo"), (f) => { fotoArticulo = f; pintarFotoArticulo(); });

  // Perfil
  get("form_perfil").addEventListener("submit", guardarPerfil);
  alElegirFoto(get("perfil_archivo"), (f) => { fotoPerfil = f; pintarCabeceraPerfil(); });
  get("perfil_quitar_foto").addEventListener("click", () => { fotoPerfil = null; pintarCabeceraPerfil(); });
  get("perfil_desplegar").addEventListener("click", () => mostrarMasDatos(get("perfil_mas_datos").hidden));
  get("perfil_salir").addEventListener("click", cerrarSesion);
  get("perfil_eliminar").addEventListener("click", eliminarPerfil);

  // Ventana de confirmación
  get("dialogo_cancelar").addEventListener("click", () => cerrarDialogo(false));
  get("dialogo_aceptar").addEventListener("click", () => cerrarDialogo(true));
  get("dialogo_fondo").addEventListener("click", (e) => {
    if (e.target === get("dialogo_fondo")) cerrarDialogo(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !get("dialogo_fondo").hidden) cerrarDialogo(false);
  });

  // Navegación
  window.addEventListener("hashchange", mostrarPantalla);
  if (sesion) {
    refrescarUsuario();
    refrescarCarrito();
  }
  mostrarPantalla();
}

iniciar(); // app.js se carga con "defer": cuando corre, la página ya está completa
