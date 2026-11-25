#!/bin/bash
# =====================================================================
#  Pruebas unitarias del back-end con curl (RNF-5) — correr EN LA VM
#
#  1) Primero haz login y copia id_usuario y token:
#     curl -s "http://localhost:8080/Servicio/rest/ws/login?email=TU_EMAIL&password=SHA256_DE_TU_PASSWORD"
#
#     (el password viaja como SHA-256, igual que en el front-end; para sacarlo:
#      echo -n "tupassword" | sha256sum)
#
#  2) Pon esos valores aquí abajo y ejecuta cada bloque por separado
#     para tomar la captura de pantalla de cada requerimiento.
# =====================================================================

WS="http://localhost:8080/Servicio/rest/ws"
ID=1
TOKEN="pega_aqui_tu_token"

echo "== RF-BE-1  alta_articulo (POST) =="
# Foto pequeña de prueba en base64 (opcional; puedes usar: base64 -w0 foto.jpg)
FOTO=$(base64 -w0 /home/ubuntu/apache-tomcat-8.5.99/webapps/ROOT/usuario_sin_foto.png 2>/dev/null)
curl -s -i -X POST "$WS/alta_articulo" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Mayonesa\",\"descripcion\":\"Mayonesa con limón 390 g\",\"precio\":45.50,\"cantidad\":10,\"foto\":\"$FOTO\",\"id_usuario\":$ID,\"token\":\"$TOKEN\"}"
echo; echo

echo "== RF-BE-1  alta_articulo con token incorrecto (debe dar 400) =="
curl -s -i -X POST "$WS/alta_articulo" -H "Content-Type: application/json" \
  -d "{\"nombre\":\"X\",\"descripcion\":\"X\",\"precio\":1,\"cantidad\":1,\"id_usuario\":$ID,\"token\":\"malo\"}"
echo; echo

echo "== RF-BE-2  consulta_articulos (GET) =="
curl -s -i "$WS/consulta_articulos?palabra=mayonesa&id_usuario=$ID&token=$TOKEN"
echo; echo

# Usa el id_articulo que regresó la consulta anterior
ART=1

echo "== RF-BE-3.1  compra_articulo: artículo nuevo en el carrito (PUT) =="
curl -s -i -X PUT "$WS/compra_articulo?id_articulo=$ART&cantidad=2&id_usuario=$ID&token=$TOKEN"
echo; echo

echo "== RF-BE-3.2  compra_articulo: el artículo ya estaba en el carrito (PUT) =="
curl -s -i -X PUT "$WS/compra_articulo?id_articulo=$ART&cantidad=3&id_usuario=$ID&token=$TOKEN"
echo; echo

echo "== RF-BE-3.3  compra_articulo: más de lo que hay en stock (400) =="
curl -s -i -X PUT "$WS/compra_articulo?id_articulo=$ART&cantidad=9999&id_usuario=$ID&token=$TOKEN"
echo; echo

echo "== Carrito actual (consulta_carrito_compra) =="
curl -s -i "$WS/consulta_carrito_compra?id_usuario=$ID&token=$TOKEN"
echo; echo

echo "== RF-BE-4  elimina_articulo_carrito_compra (DELETE) =="
curl -s -i -X DELETE "$WS/elimina_articulo_carrito_compra?id_usuario=$ID&id_articulo=$ART&token=$TOKEN"
echo; echo

echo "== RF-BE-5  elimina_carrito_compra (DELETE) =="
curl -s -i -X PUT "$WS/compra_articulo?id_articulo=$ART&cantidad=1&id_usuario=$ID&token=$TOKEN" > /dev/null
curl -s -i -X DELETE "$WS/elimina_carrito_compra?id_usuario=$ID&token=$TOKEN"
echo; echo

# Para demostrar en la captura que el stock y el carrito quedaron bien:
#   mysql -u TU_USUARIO -p servicio_web -e "SELECT * FROM stock; SELECT * FROM carrito_compra;"
