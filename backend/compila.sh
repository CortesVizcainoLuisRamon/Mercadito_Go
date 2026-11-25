# Ruta de Tomcat en la máquina virtual (Tarea 1)
export CATALINA_HOME=/home/ubuntu/apache-tomcat-8.5.99
javac -encoding UTF-8 -cp "WEB-INF/lib/*:." servicio/Servicio.java
rm -f WEB-INF/classes/servicio/*
cp servicio/*.class WEB-INF/classes/servicio/.
jar cvf Servicio.war WEB-INF META-INF
rm -rf $CATALINA_HOME/webapps/Servicio.war $CATALINA_HOME/webapps/Servicio
cp Servicio.war $CATALINA_HOME/webapps/.
