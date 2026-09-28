# Protocolo Cero

## Datos de la estudiante

- **Nombre:** Jocelin Ramirez Flores
- **Número de control:** 21200662
- **Materia:** Desarrollo de soluciones en ambientes virtuales

## Descripción

Videojuego web 3D en tercera persona ambientado en un laboratorio de contención. El sistema de bioseguridad ha fallado. El jugador debe recuperar muestras, enfrentar o evitar a los sujetos infectados y llegar al elevador de extracción.

La partida contiene **cuatro niveles progresivos**. Cada nivel tiene su propio objetivo, número de muestras y cantidad/dificultad de enemigos. Al llegar al elevador con las muestras requeridas se habilita el botón para continuar. La misión se completa al superar el nivel 4; si la integridad del traje llega a cero, se pierde la partida.

## Personajes

Antes de iniciar, usa las flechas del selector para elegir entre tres operadores: **EVA-07**, **GUARDIA-12** y **BIO-03**. Cada uno tiene uniforme y colores propios. Desde el menú de pausa puedes volver a la selección; hacerlo reinicia la misión.

## Cómo jugar

1. Pulsa **Iniciar misión**.
2. Muévete con **W/A/S/D**. Mantén **Shift** para correr.
3. Arrastra el mouse sobre la escena para orientar la cámara; usa la rueda para ajustar la distancia.
4. Acércate a las muestras y pulsa **E** o **R** para recuperarlas.
5. Haz clic o pulsa **F** para disparar el impulsor. El deslizador **Potencia** modifica la fuerza del disparo.
6. Cuando hayas recogido las muestras requeridas, llega al elevador para completar el nivel y pulsa **Continuar al nivel siguiente**.
7. Evita a los sujetos infectados. Sus ataques reducen la integridad del traje; si llega a cero, la misión termina.
8. Pulsa **Esc** para pausar o reanudar. Desde la pausa puedes reiniciar el nivel o cambiar de personaje.

## Niveles

| Nivel | Misión | Desafío |
| --- | --- | --- |
| 1. Despertar | Recuperar la primera muestra y alcanzar la salida | Un enemigo y una muestra |
| 2. Cultivos inestables | Recuperar dos muestras | Dos enemigos con más resistencia |
| 3. Zona de cuarentena | Asegurar tres muestras | Tres enemigos más rápidos |
| 4. Extracción final | Recuperar las muestras y escapar | Cuatro enemigos, más resistentes y veloces |

## Organización del proyecto

- `index.html`: interfaz, selector de personaje, HUD, pantallas del juego e import map.
- `assets/css/styles.css`: estilos adaptables y componentes de la interfaz.
- `assets/js/main.js`: escena 3D, física, controles, personajes, enemigos, niveles y reglas de la misión.

## Tecnologías

- **Three.js** renderiza el escenario, los personajes, la cámara, la iluminación y los efectos.
- **GLTFLoader** carga el modelo animado RobotExpressive. **AnimationMixer** administra los estados Idle, Walk, Run y Attack; hay un avatar geométrico de respaldo si no se puede cargar el GLB.
- **Rapier 3D** proporciona gravedad, colisionadores y cuerpos rígidos dinámicos para las cajas, tambores, viales y proyectiles.
- HTML, CSS y JavaScript conforman la interfaz web. Se usan módulos y rutas relativas compatibles con GitHub Pages.

## Ejecutar en Windows

No abras `index.html` directamente: el navegador bloquea los módulos JavaScript y la física cuando se usa la ruta `file://`. Abre **`abrir-juego.bat`** con doble clic. El iniciador levanta un servidor local en `127.0.0.1:8765` y abre el juego en el navegador. Cuando termines, usa **`detener-juego.bat`** para cerrar el servidor.

## Ejecutar en otros sistemas

Como el juego usa módulos JavaScript, sírvelo por HTTP en vez de abrirlo como archivo:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio público de GitHub y conserva los commits para mantener el historial de versiones.
2. En **Settings → Pages**, selecciona **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
3. Espera a que GitHub Pages termine la publicación y abre la URL del sitio.

Three.js, Rapier, las fuentes y el modelo del personaje se descargan desde CDN, por lo que necesitan conexión a Internet.

## Recursos y atribuciones

- RobotExpressive, Khronos Group, [modelo GLB y animaciones](https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb), distribuido con los ejemplos de Three.js. Consultar el recurso de origen para su atribución/licencia.
- Three.js, [licencia MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
- Rapier, [licencia Apache-2.0](https://github.com/dimforge/rapier.js/blob/master/LICENSE).
- Barlow Condensed, DM Mono y Manrope, Google Fonts, bajo las licencias OFL de sus familias.
- El escenario, el HUD, los operadores de respaldo y los enemigos se generan mediante código para este proyecto.
