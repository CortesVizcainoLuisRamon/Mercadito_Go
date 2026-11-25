/*
  Articulo.java
  Representa un artículo del stock o un renglón del carrito de compra.
  Tarea 7 - Sistemas Distribuidos
*/

package servicio;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonInclude;

// NON_NULL: en las respuestas JSON no se envían los campos que valen null
// (por ejemplo id_usuario y token nunca regresan al cliente).
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Articulo
{
  public Integer id_articulo;
  public String nombre;
  public String descripcion;
  public BigDecimal precio;
  public Integer cantidad;    // en stock: existencia; en el carrito: cantidad comprada
  public BigDecimal costo;    // solo en el carrito: cantidad x precio
  public byte[] foto;         // Jackson la convierte a/desde base64

  // Solo se usan al recibir la petición de alta_articulo
  public Integer id_usuario;
  public String token;
}
