/*
  Servicio.java
  Servicio web REST
  Carlos Pineda Guerrero. 2025,2026

  Tarea 7: se agregan los end-points del prototipo de comercio electrónico
    alta_articulo, consulta_articulos, compra_articulo,
    consulta_carrito_compra, elimina_articulo_carrito_compra, elimina_carrito_compra
*/

package servicio;

import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.DELETE;
import javax.ws.rs.Path;
import javax.ws.rs.Consumes;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Application;

import java.sql.*;
import javax.sql.DataSource;
import javax.naming.Context;
import javax.naming.InitialContext;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.security.SecureRandom;

import com.fasterxml.jackson.databind.ObjectMapper;

/*
 La URL del servicio web es http://localhost:8080/Servicio/rest/ws
 Donde:
 Servicio: dominio del servicio web (es decir, el nombre de archivo Servicio.war)
 rest: se define en la etiqueta <url-pattern> de <servlet-mapping> en el archivo WEB-INF\web.xml
 ws: se define en la siguiente anotación @Path de la clase Servicio
*/

@Path("ws")
public class Servicio extends Application
{
  static DataSource pool = null;
  static
  {
    try
    {
      Context ctx = new InitialContext();
      pool = (DataSource)ctx.lookup("java:comp/env/jdbc/datasource_Servicio");
    }
    catch(Exception e)
    {
      e.printStackTrace();
    }
  }

  static ObjectMapper j = new ObjectMapper().setDateFormat(new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"));

  static final String caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  static final SecureRandom random = new SecureRandom();

  static String generarToken(int longitud)
  {
    StringBuilder sb = new StringBuilder(longitud);
    for (int i = 0; i < longitud; i++)
    {
      int index = random.nextInt(caracteres.length());
      sb.append(caracteres.charAt(index));
    }
    return sb.toString();
  }

  // Respuestas JSON de uso común
  static Response ok(Object o) throws Exception
  {
    return Response.ok(j.writeValueAsString(o)).build();
  }

  static Response error(String mensaje) throws Exception
  {
    return Response.status(400).entity(j.writeValueAsString(new Respuesta(mensaje))).build();
  }

  boolean verifica_acceso(Connection conexion,int id_usuario,String token) throws Exception
  {
    PreparedStatement stmt_1 = conexion.prepareStatement("SELECT 1 FROM usuarios WHERE id_usuario=? and token=?");
    try
    {
      stmt_1.setInt(1,id_usuario);
      stmt_1.setString(2,token);

      ResultSet rs = stmt_1.executeQuery();
      try
      {
        return rs.next();
      }
      finally
      {
        rs.close();
      }
    }
    finally
    {
      stmt_1.close();
    }
  }

  // ===================================================================
  //  USUARIOS (Tarea 1)
  // ===================================================================

  @GET
  @Path("login")
  @Produces(MediaType.APPLICATION_JSON)
  public Response login(@QueryParam("email") String email,@QueryParam("password") String password) throws Exception
  {
    try
    {
      Connection conexion= pool.getConnection();

      try
      {
        PreparedStatement stmt_1 = conexion.prepareStatement("SELECT id_usuario FROM usuarios WHERE email=? and password=?");
        try
        {
          stmt_1.setString(1,email);
          stmt_1.setString(2,password);

          ResultSet rs = stmt_1.executeQuery();
          try
          {
            if (rs.next())
            {
              int id_usuario = rs.getInt(1);
              String token = generarToken(20);

              PreparedStatement stmt_2 = conexion.prepareStatement("UPDATE usuarios SET token=? WHERE id_usuario=?");
              try
              {
                stmt_2.setString(1,token);
                stmt_2.setInt(2,id_usuario);
                stmt_2.executeUpdate();
              }
              finally
              {
                stmt_2.close();
              }

              return Response.ok("{\"id_usuario\":" + id_usuario + "," + "\"token\":\"" + token + "\"}").build();
            }
            return error("Acceso denegado");
          }
          finally
          {
            rs.close();
          }
        }
        finally
        {
          stmt_1.close();
        }
      }
      finally
      {
        conexion.close();
      }
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  @POST
  @Path("alta_usuario")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Response alta(Usuario usuario) throws Exception
  {
    try
    {
      if (usuario.email == null || usuario.email.equals(""))
        throw new Exception("Se debe ingresar el email");

      if (usuario.password == null || usuario.password.equals(""))
        throw new Exception("Se debe ingresar la contraseña");

      if (usuario.nombre == null || usuario.nombre.equals(""))
        throw new Exception("Se debe ingresar el nombre");

      if (usuario.apellido_paterno == null || usuario.apellido_paterno.equals(""))
        throw new Exception("Se debe ingresar el apellido paterno");

      if (usuario.fecha_nacimiento == null)
        throw new Exception("Se debe ingresar la fecha de nacimiento");

      // CORRECCIÓN: la conexión se pide después de validar; antes, si una
      // validación fallaba, la conexión nunca se cerraba (fuga del pool).
      Connection conexion = pool.getConnection();
      int id_usuario = 0;

      try
      {
        conexion.setAutoCommit(false);

        PreparedStatement stmt_1 = conexion.prepareStatement("INSERT INTO usuarios(id_usuario,email,password,nombre,apellido_paterno,apellido_materno,fecha_nacimiento,telefono,genero) VALUES (0,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);

        try
        {
          stmt_1.setString(1,usuario.email);
          stmt_1.setString(2,usuario.password);
          stmt_1.setString(3,usuario.nombre);
          stmt_1.setString(4,usuario.apellido_paterno);

          if (usuario.apellido_materno != null)
            stmt_1.setString(5,usuario.apellido_materno);
          else
            stmt_1.setNull(5,Types.VARCHAR);

          stmt_1.setTimestamp(6,usuario.fecha_nacimiento);

          if (usuario.telefono != null)
            stmt_1.setLong(7,usuario.telefono);
          else
            stmt_1.setNull(7,Types.BIGINT);

          if (usuario.genero != null)
            stmt_1.setString(8,usuario.genero);
          else
            stmt_1.setNull(8,Types.CHAR);

          stmt_1.executeUpdate();

          ResultSet rs = stmt_1.getGeneratedKeys();

          try
          {
            if (rs.next())
              id_usuario = rs.getInt(1); // Obtiene el ID del usuario que se insertó previamente
          }
          finally
          {
            rs.close();
          }

          if (id_usuario == 0)
            throw new Exception("No se pudo obtener el ID del usuario");
        }
        finally
        {
          stmt_1.close();
        }

        if (usuario.foto != null)
        {
          PreparedStatement stmt_2 = conexion.prepareStatement("INSERT INTO fotos_usuarios(id_foto,foto,id_usuario) VALUES (0,?,?)");

          try
          {
            stmt_2.setBytes(1,usuario.foto);
            stmt_2.setInt(2,id_usuario);
            stmt_2.executeUpdate();
          }
          finally
          {
            stmt_2.close();
          }
        }
        conexion.commit();
      }
      catch (Exception e)
      {
        conexion.rollback();
        throw new Exception(e.getMessage());
      }
      finally
      {
        conexion.setAutoCommit(true);
        conexion.close();
      }
      return ok(new Respuesta("Se dio de alta el usuario"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  @GET
  @Path("consulta_usuario")
  @Produces(MediaType.APPLICATION_JSON)
  public Response consulta(@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion= pool.getConnection();

      try
      {
        // CORRECCIÓN: verifica_acceso dentro del try para que la conexión siempre se cierre
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        PreparedStatement stmt_1 = conexion.prepareStatement("SELECT a.email,a.nombre,a.apellido_paterno,a.apellido_materno,a.fecha_nacimiento,a.telefono,a.genero,b.foto FROM usuarios a LEFT OUTER JOIN fotos_usuarios b ON a.id_usuario=b.id_usuario WHERE a.id_usuario=?");
        try
        {
          stmt_1.setInt(1,id_usuario);

          ResultSet rs = stmt_1.executeQuery();

          try
          {
            if (rs.next())
            {
              Usuario r = new Usuario();
              r.email = rs.getString(1);
              r.nombre = rs.getString(2);
              r.apellido_paterno = rs.getString(3);
              r.apellido_materno = rs.getString(4);
              r.fecha_nacimiento = rs.getTimestamp(5);
              r.telefono = rs.getObject(6) != null ? rs.getLong(6) : null;
              r.genero = rs.getString(7);
              r.foto = rs.getBytes(8);
              return ok(r);
            }
            return error("Acceso denegado");
          }
          finally
          {
            rs.close();
          }
        }
        finally
        {
          stmt_1.close();
        }
      }
      finally
      {
        conexion.close();
      }
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  @PUT
  @Path("modifica_usuario")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Response modifica(@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token,Usuario usuario) throws Exception
  {
    try
    {
      if (usuario.email == null || usuario.email.equals(""))
        throw new Exception("Se debe ingresar el email");

      if (usuario.nombre == null || usuario.nombre.equals(""))
        throw new Exception("Se debe ingresar el nombre");

      if (usuario.apellido_paterno == null || usuario.apellido_paterno.equals(""))
        throw new Exception("Se debe ingresar el apellido paterno");

      if (usuario.fecha_nacimiento == null)
        throw new Exception("Se debe ingresar la fecha de nacimiento");

      Connection conexion= pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          PreparedStatement stmt_1 = conexion.prepareStatement("UPDATE usuarios SET email=?,nombre=?,apellido_paterno=?,apellido_materno=?,fecha_nacimiento=?,telefono=?,genero=? WHERE id_usuario=?");

          try
          {
            stmt_1.setString(1,usuario.email);
            stmt_1.setString(2,usuario.nombre);
            stmt_1.setString(3,usuario.apellido_paterno);

            if (usuario.apellido_materno != null)
              stmt_1.setString(4,usuario.apellido_materno);
            else
              stmt_1.setNull(4,Types.VARCHAR);

            stmt_1.setTimestamp(5,usuario.fecha_nacimiento);

            if (usuario.telefono != null)
              stmt_1.setLong(6,usuario.telefono);
            else
              stmt_1.setNull(6,Types.BIGINT);

            if (usuario.genero != null)
              stmt_1.setString(7,usuario.genero);
            else
              stmt_1.setNull(7,Types.CHAR);

            stmt_1.setInt(8,id_usuario);

            stmt_1.executeUpdate();
          }
          finally
          {
            stmt_1.close();
          }

          // CORRECCIÓN: evita NullPointerException si no se envía password
          if (usuario.password != null && !usuario.password.equals(""))
          {
            PreparedStatement stmt_2 = conexion.prepareStatement("UPDATE usuarios SET password=? WHERE id_usuario=?");

            try
            {
              stmt_2.setString(1,usuario.password);
              stmt_2.setInt(2,id_usuario);
              stmt_2.executeUpdate();
            }
            finally
            {
              stmt_2.close();
            }
          }

          PreparedStatement stmt_3 = conexion.prepareStatement("DELETE FROM fotos_usuarios WHERE id_usuario=?");

          try
          {
            stmt_3.setInt(1,id_usuario);
            stmt_3.executeUpdate();
          }
          finally
          {
            stmt_3.close();
          }

          if (usuario.foto != null)
          {
            PreparedStatement stmt_4 = conexion.prepareStatement("INSERT INTO fotos_usuarios(id_foto,foto,id_usuario) VALUES (0,?,?)");

            try
            {
              stmt_4.setBytes(1,usuario.foto);
              stmt_4.setInt(2,id_usuario);
              stmt_4.executeUpdate();
            }
            finally
            {
              stmt_4.close();
            }
          }

          conexion.commit();
          return ok(new Respuesta("Se modificó el usuario"));
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception (e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  @DELETE
  @Path("borra_usuario")
  @Produces(MediaType.APPLICATION_JSON)
  public Response borra(@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion= pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          // NUEVO (Tarea 7): antes de borrar al usuario se regresan al stock los
          // artículos de su carrito y se borra el carrito (la tabla carrito_compra
          // tiene llave foránea hacia usuarios).
          regresa_carrito_al_stock(conexion,id_usuario);

          PreparedStatement stmt_2 = conexion.prepareStatement("DELETE FROM fotos_usuarios WHERE id_usuario=?");

          try
          {
            stmt_2.setInt(1,id_usuario);
            stmt_2.executeUpdate();
          }
          finally
          {
            stmt_2.close();
          }

          PreparedStatement stmt_3 = conexion.prepareStatement("DELETE FROM usuarios WHERE id_usuario=?");

          try
          {
            stmt_3.setInt(1,id_usuario);
            stmt_3.executeUpdate();
          }
          finally
          {
            stmt_3.close();
          }
          conexion.commit();
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception(e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
      return ok(new Respuesta("Se borró el usuario"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  // ===================================================================
  //  ARTÍCULOS Y CARRITO DE COMPRA (Tarea 7)
  // ===================================================================

  /*
    RF-BE-1  POST /alta_articulo
    Body JSON: {nombre, descripcion, precio, cantidad, foto(base64), id_usuario, token}
    INSERT en stock + INSERT en fotos_articulos dentro de una transacción.
  */
  @POST
  @Path("alta_articulo")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Response alta_articulo(Articulo articulo) throws Exception
  {
    try
    {
      if (articulo == null)
        throw new Exception("Se deben enviar los datos del artículo");

      if (articulo.id_usuario == null || articulo.token == null)
        throw new Exception("Acceso denegado");

      if (articulo.nombre == null || articulo.nombre.trim().equals(""))
        throw new Exception("Se debe ingresar el nombre del artículo");

      if (articulo.descripcion == null || articulo.descripcion.trim().equals(""))
        throw new Exception("Se debe ingresar la descripción del artículo");

      if (articulo.precio == null || articulo.precio.compareTo(BigDecimal.ZERO) < 0)
        throw new Exception("Se debe ingresar un precio válido");

      if (articulo.cantidad == null || articulo.cantidad < 0)
        throw new Exception("Se debe ingresar una cantidad válida");

      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,articulo.id_usuario,articulo.token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          int id_articulo = 0;

          PreparedStatement stmt_1 = conexion.prepareStatement("INSERT INTO stock(id_articulo,nombre,descripcion,precio,cantidad) VALUES (0,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);

          try
          {
            stmt_1.setString(1,articulo.nombre.trim());
            stmt_1.setString(2,articulo.descripcion.trim());
            stmt_1.setBigDecimal(3,articulo.precio);
            stmt_1.setInt(4,articulo.cantidad);
            stmt_1.executeUpdate();

            ResultSet rs = stmt_1.getGeneratedKeys();

            try
            {
              if (rs.next())
                id_articulo = rs.getInt(1);
            }
            finally
            {
              rs.close();
            }

            if (id_articulo == 0)
              throw new Exception("No se pudo obtener el ID del artículo");
          }
          finally
          {
            stmt_1.close();
          }

          if (articulo.foto != null)
          {
            PreparedStatement stmt_2 = conexion.prepareStatement("INSERT INTO fotos_articulos(id_foto,foto,id_articulo) VALUES (0,?,?)");

            try
            {
              stmt_2.setBytes(1,articulo.foto);
              stmt_2.setInt(2,id_articulo);
              stmt_2.executeUpdate();
            }
            finally
            {
              stmt_2.close();
            }
          }

          conexion.commit();
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception(e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
      return ok(new Respuesta("OK"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    RF-BE-2  GET /consulta_articulos?palabra=...&id_usuario=...&token=...
    Busca la palabra en nombre y descripcion con LIKE.
    Regresa [{id_articulo, foto, nombre, descripcion, precio, cantidad}]
    (cantidad = existencia en stock, la usa el front-end para mostrarla).
  */
  @GET
  @Path("consulta_articulos")
  @Produces(MediaType.APPLICATION_JSON)
  public Response consulta_articulos(@QueryParam("palabra") String palabra,@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        String patron = "%" + (palabra != null ? palabra.trim() : "") + "%";

        PreparedStatement stmt_1 = conexion.prepareStatement(
          "SELECT a.id_articulo,a.nombre,a.descripcion,a.precio,a.cantidad," +
          "(SELECT b.foto FROM fotos_articulos b WHERE b.id_articulo=a.id_articulo ORDER BY b.id_foto LIMIT 1) " +
          "FROM stock a WHERE a.nombre LIKE ? OR a.descripcion LIKE ? ORDER BY a.nombre");

        try
        {
          stmt_1.setString(1,patron);
          stmt_1.setString(2,patron);

          ResultSet rs = stmt_1.executeQuery();

          try
          {
            ArrayList<Articulo> lista = new ArrayList<Articulo>();
            while (rs.next())
            {
              Articulo r = new Articulo();
              r.id_articulo = rs.getInt(1);
              r.nombre = rs.getString(2);
              r.descripcion = rs.getString(3);
              r.precio = rs.getBigDecimal(4);
              r.cantidad = rs.getInt(5);
              r.foto = rs.getBytes(6);
              lista.add(r);
            }
            return ok(lista);
          }
          finally
          {
            rs.close();
          }
        }
        finally
        {
          stmt_1.close();
        }
      }
      finally
      {
        conexion.close();
      }
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    RF-BE-3  PUT /compra_articulo?id_articulo=...&cantidad=...&id_usuario=...&token=...
    3.1 si hay stock y el artículo no está en el carrito: INSERT carrito + UPDATE stock
    3.2 si hay stock y el artículo ya está en el carrito: UPDATE carrito + UPDATE stock
    3.3 si no hay stock suficiente: 400 {"mensaje":"No hay suficientes artículos en el stock"}
  */
  @PUT
  @Path("compra_articulo")
  @Produces(MediaType.APPLICATION_JSON)
  public Response compra_articulo(@QueryParam("id_articulo") int id_articulo,@QueryParam("cantidad") int cantidad,@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      if (cantidad <= 0)
        throw new Exception("La cantidad a comprar debe ser mayor a cero");

      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          // FOR UPDATE bloquea el renglón del stock hasta el commit,
          // así dos compras simultáneas no pueden vender la misma existencia.
          int en_stock;
          PreparedStatement stmt_1 = conexion.prepareStatement("SELECT cantidad FROM stock WHERE id_articulo=? FOR UPDATE");

          try
          {
            stmt_1.setInt(1,id_articulo);
            ResultSet rs = stmt_1.executeQuery();

            try
            {
              if (!rs.next())
                throw new Exception("El artículo no existe");
              en_stock = rs.getInt(1);
            }
            finally
            {
              rs.close();
            }
          }
          finally
          {
            stmt_1.close();
          }

          // RF-BE-3.3
          if (cantidad > en_stock)
            throw new Exception("No hay suficientes artículos en el stock");

          boolean en_carrito;
          PreparedStatement stmt_2 = conexion.prepareStatement("SELECT 1 FROM carrito_compra WHERE id_usuario=? AND id_articulo=? FOR UPDATE");

          try
          {
            stmt_2.setInt(1,id_usuario);
            stmt_2.setInt(2,id_articulo);
            ResultSet rs = stmt_2.executeQuery();

            try
            {
              en_carrito = rs.next();
            }
            finally
            {
              rs.close();
            }
          }
          finally
          {
            stmt_2.close();
          }

          PreparedStatement stmt_3;
          if (!en_carrito)  // RF-BE-3.1
            stmt_3 = conexion.prepareStatement("INSERT INTO carrito_compra(cantidad,id_usuario,id_articulo) VALUES (?,?,?)");
          else              // RF-BE-3.2
            stmt_3 = conexion.prepareStatement("UPDATE carrito_compra SET cantidad=cantidad+? WHERE id_usuario=? AND id_articulo=?");

          try
          {
            stmt_3.setInt(1,cantidad);
            stmt_3.setInt(2,id_usuario);
            stmt_3.setInt(3,id_articulo);
            stmt_3.executeUpdate();
          }
          finally
          {
            stmt_3.close();
          }

          PreparedStatement stmt_4 = conexion.prepareStatement("UPDATE stock SET cantidad=cantidad-? WHERE id_articulo=?");

          try
          {
            stmt_4.setInt(1,cantidad);
            stmt_4.setInt(2,id_articulo);
            stmt_4.executeUpdate();
          }
          finally
          {
            stmt_4.close();
          }

          conexion.commit();
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception(e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
      return ok(new Respuesta("OK"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    GET /consulta_carrito_compra?id_usuario=...&token=...
    Método de apoyo para la pantalla "Artículos en el carrito" (RF-FE-2.3).
    Regresa [{id_articulo, foto, nombre, cantidad, precio, costo}]
  */
  @GET
  @Path("consulta_carrito_compra")
  @Produces(MediaType.APPLICATION_JSON)
  public Response consulta_carrito_compra(@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        PreparedStatement stmt_1 = conexion.prepareStatement(
          "SELECT a.id_articulo,b.nombre,a.cantidad,b.precio,a.cantidad*b.precio," +
          "(SELECT c.foto FROM fotos_articulos c WHERE c.id_articulo=a.id_articulo ORDER BY c.id_foto LIMIT 1) " +
          "FROM carrito_compra a JOIN stock b ON a.id_articulo=b.id_articulo " +
          "WHERE a.id_usuario=? ORDER BY b.nombre");

        try
        {
          stmt_1.setInt(1,id_usuario);
          ResultSet rs = stmt_1.executeQuery();

          try
          {
            ArrayList<Articulo> lista = new ArrayList<Articulo>();
            while (rs.next())
            {
              Articulo r = new Articulo();
              r.id_articulo = rs.getInt(1);
              r.nombre = rs.getString(2);
              r.cantidad = rs.getInt(3);
              r.precio = rs.getBigDecimal(4);
              r.costo = rs.getBigDecimal(5);
              r.foto = rs.getBytes(6);
              lista.add(r);
            }
            return ok(lista);
          }
          finally
          {
            rs.close();
          }
        }
        finally
        {
          stmt_1.close();
        }
      }
      finally
      {
        conexion.close();
      }
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    RF-BE-4  DELETE /elimina_articulo_carrito_compra?id_usuario=...&id_articulo=...&token=...
    UPDATE stock (regresa la cantidad) + DELETE del carrito, en una transacción.
  */
  @DELETE
  @Path("elimina_articulo_carrito_compra")
  @Produces(MediaType.APPLICATION_JSON)
  public Response elimina_articulo_carrito_compra(@QueryParam("id_usuario") int id_usuario,@QueryParam("id_articulo") int id_articulo,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          int cantidad;
          PreparedStatement stmt_1 = conexion.prepareStatement("SELECT cantidad FROM carrito_compra WHERE id_usuario=? AND id_articulo=? FOR UPDATE");

          try
          {
            stmt_1.setInt(1,id_usuario);
            stmt_1.setInt(2,id_articulo);
            ResultSet rs = stmt_1.executeQuery();

            try
            {
              if (!rs.next())
                throw new Exception("El artículo no está en el carrito de compra");
              cantidad = rs.getInt(1);
            }
            finally
            {
              rs.close();
            }
          }
          finally
          {
            stmt_1.close();
          }

          PreparedStatement stmt_2 = conexion.prepareStatement("UPDATE stock SET cantidad=cantidad+? WHERE id_articulo=?");

          try
          {
            stmt_2.setInt(1,cantidad);
            stmt_2.setInt(2,id_articulo);
            stmt_2.executeUpdate();
          }
          finally
          {
            stmt_2.close();
          }

          PreparedStatement stmt_3 = conexion.prepareStatement("DELETE FROM carrito_compra WHERE id_usuario=? AND id_articulo=?");

          try
          {
            stmt_3.setInt(1,id_usuario);
            stmt_3.setInt(2,id_articulo);
            stmt_3.executeUpdate();
          }
          finally
          {
            stmt_3.close();
          }

          conexion.commit();
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception(e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
      return ok(new Respuesta("OK"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    RF-BE-5  DELETE /elimina_carrito_compra?id_usuario=...&token=...
    Un UPDATE a stock por cada artículo del carrito + un DELETE de los
    renglones del usuario (solo los suyos), en una transacción.
  */
  @DELETE
  @Path("elimina_carrito_compra")
  @Produces(MediaType.APPLICATION_JSON)
  public Response elimina_carrito_compra(@QueryParam("id_usuario") int id_usuario,@QueryParam("token") String token) throws Exception
  {
    try
    {
      Connection conexion = pool.getConnection();

      try
      {
        if (!verifica_acceso(conexion,id_usuario,token))
          return error("Acceso denegado");

        conexion.setAutoCommit(false);

        try
        {
          regresa_carrito_al_stock(conexion,id_usuario);
          conexion.commit();
        }
        catch (Exception e)
        {
          conexion.rollback();
          throw new Exception(e.getMessage());
        }
        finally
        {
          conexion.setAutoCommit(true);
        }
      }
      finally
      {
        conexion.close();
      }
      return ok(new Respuesta("OK"));
    }
    catch (Exception e)
    {
      return error(e.getMessage());
    }
  }

  /*
    Regresa al stock cada artículo del carrito del usuario (un UPDATE por artículo)
    y borra los renglones del carrito de ese usuario (un DELETE).
    Debe llamarse con autocommit=false; el commit/rollback lo hace quien la llama.
  */
  void regresa_carrito_al_stock(Connection conexion,int id_usuario) throws Exception
  {
    ArrayList<int[]> renglones = new ArrayList<int[]>();

    PreparedStatement stmt_1 = conexion.prepareStatement("SELECT id_articulo,cantidad FROM carrito_compra WHERE id_usuario=? FOR UPDATE");

    try
    {
      stmt_1.setInt(1,id_usuario);
      ResultSet rs = stmt_1.executeQuery();

      try
      {
        while (rs.next())
          renglones.add(new int[] {rs.getInt(1),rs.getInt(2)});
      }
      finally
      {
        rs.close();
      }
    }
    finally
    {
      stmt_1.close();
    }

    PreparedStatement stmt_2 = conexion.prepareStatement("UPDATE stock SET cantidad=cantidad+? WHERE id_articulo=?");

    try
    {
      for (int[] r : renglones)
      {
        stmt_2.setInt(1,r[1]);
        stmt_2.setInt(2,r[0]);
        stmt_2.executeUpdate();
      }
    }
    finally
    {
      stmt_2.close();
    }

    PreparedStatement stmt_3 = conexion.prepareStatement("DELETE FROM carrito_compra WHERE id_usuario=?");

    try
    {
      stmt_3.setInt(1,id_usuario);
      stmt_3.executeUpdate();
    }
    finally
    {
      stmt_3.close();
    }
  }
}
