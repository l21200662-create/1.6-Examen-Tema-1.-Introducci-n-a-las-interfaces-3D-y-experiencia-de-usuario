# Protocolo Cero

## Datos de la estudiante

- **Nombre:** Jocelin Ramirez Flores
- **Número de control:** 21200662
- **Materia:** Desarrollo de soluciones en ambientes virtuales

## Descripción

Videojuego web 3D en tercera persona ambientado en un laboratorio de contención. El sistema de bioseguridad ha fallado. El jugador debe recuperar muestras, enfrentar o evitar a los sujetos infectados y llegar al elevador de extracción. Cada fase transcurre en un escenario distinto, con obstáculos y amenazas más difíciles.

La partida contiene **cuatro niveles progresivos**, cada uno con su propio escenario, límite de tiempo, cantidad de muestras, obstáculos y enemigos. Completa el objetivo y llega al elevador antes de que termine el tiempo. La misión se completa al superar el nivel 4; si la integridad del traje llega a cero o se agota el tiempo, se pierde la partida.

## Personajes

La partida inicia con **Abuela Deportiva** (`Sporty Granny (1).fbx`) y espera a que el modelo esté listo antes de mostrar el menú. En el selector puedes elegir también a **Sujeto CH-17** (`Ch17_nonPBR.fbx`) o **BIO-03**. La abuela y CH-17 usan animaciones de espera, caminar, correr y lanzamiento, con movimiento complementario de extremidades. Desde el menú de pausa puedes volver a la selección; hacerlo reinicia la misión.

## Cómo jugar

1. Pulsa **Iniciar misión**. Los efectos de sonido se activan al comenzar.
2. Usa **W** para avanzar, **S** para retroceder, **A** para moverte a la derecha y **D** para moverte a la izquierda. Mantén **Shift** para correr.
3. Mueve el mouse para orientar la cámara. Al iniciar, el puntero queda capturado; pulsa **Esc** para pausar y soltarlo. Si no se captura, arrastra sobre la escena. La cámara acompaña el rumbo del personaje y la rueda ajusta la distancia.
4. Acércate a las muestras y pulsa **E** o **R** para recuperarlas.
5. Haz clic o pulsa **F** para disparar el impulsor. El deslizador **Potencia** modifica la fuerza del disparo.
6. Completa el objetivo antes del límite de tiempo, después llega al elevador y pulsa **Continuar al nivel siguiente**.
7. Los infectados persiguen al personaje. Sus ataques y las zonas de riesgo reducen la integridad del traje.
8. Pulsa **Esc** para pausar o reanudar. Desde la pausa puedes reiniciar el nivel o cambiar de personaje.
9. Sigue la flecha **ELEVADOR** en el HUD y los indicadores luminosos del suelo; el HUD muestra la distancia y avisa cuando la salida está desbloqueada. Usa **♫** para silenciar o activar la música ambiental.

## Niveles

| Nivel | Misión | Desafío |
| --- | --- | --- |
| 1. Despertar | Recuperar una muestra y alcanzar la salida | Laboratorio inicial · 1 infectado · 2:30 minutos |
| 2. Cultivos inestables | Recuperar dos muestras | Cámara criogénica con depósitos y barricadas · 3 infectados · 2:15 minutos |
| 3. Zona de cuarentena | Asegurar tres muestras | Recinto de cuarentena con barreras y zonas contaminadas · 5 infectados · 2:00 minutos |
| 4. Extracción final | Recuperar cuatro muestras y escapar | Cámara del reactor con obstáculos y fugas térmicas · 7 infectados · 1:45 minutos |

## Organización del proyecto

- `index.html`: interfaz, selector de personaje, HUD, pantallas del juego e import map.
- `assets/css/styles.css`: estilos adaptables y componentes de la interfaz.
- `assets/js/main.js`: escena 3D, física, controles, personajes, música, enemigos, niveles y reglas de la misión.
- `assets/characters/`: modelos FBX y clips de animación GLTF usados por Abuela Deportiva y CH-17.

## Tecnologías

- **Three.js** renderiza los escenarios, los modelos, la cámara, la iluminación y los efectos. `GLTFLoader` y `FBXLoader` cargan los personajes.
- Las animaciones de espera, caminar, correr y lanzar proceden de los clips GLTF de Mixamo y se aplican a los esqueletos FBX. El BIO-03 usa animación procedural. La música ambiental y los efectos se sintetizan con Web Audio.
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

1. Sube los cambios a la rama `main` de GitHub.
2. El flujo `.github/workflows/publicar-juego.yml` publica automáticamente `index.html` y `assets/` en GitHub Pages.
3. Abre la URL de GitHub Pages del repositorio.

Three.js y Rapier se descargan desde CDN, por lo que necesitan conexión a Internet. Los personajes, enemigos, escenarios y sonidos se generan dentro del juego.

## Recursos y atribuciones

- Three.js, [licencia MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
- Rapier, [licencia Apache-2.0](https://github.com/dimforge/rapier.js/blob/master/LICENSE).
- Barlow Condensed, DM Mono y Manrope, Google Fonts, bajo las licencias OFL de sus familias.
- Los escenarios, el HUD, los operadores y los enemigos se generan mediante código para este proyecto.
