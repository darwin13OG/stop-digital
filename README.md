# 🚫 Stop Digital - P2P Multiplayer

**Stop Digital** es una aplicación web progresiva (PWA) diseñada para jugar al clásico "STOP" (Tutti Frutti) en tiempo real con amigos. La aplicación utiliza tecnología **Peer-to-Peer**, lo que permite una conexión directa entre jugadores sin necesidad de intermediarios.

🚀 **Juega ahora aquí:** [https://stop-digital.pages.dev](https://stop-digital.pages.dev)

![Icono de la App](icon-192.png)

## ✨ Características Principales

- **Conexión Directa (P2P):** Utiliza [PeerJS](https://peerjs.com/) para conectar a los jugadores mediante WebRTC.
- **Experiencia de App Nativa (PWA):** Instalable en Android e iOS, con pantalla completa y carga rápida desde el inicio.
- **Modo Oscuro Moderno:** Interfaz estética diseñada para reducir la fatiga visual.
- **Lobby de Control:** El anfitrión (Host) decide el tiempo de ronda y la meta de puntos.
- **Sistema de Puntos Inteligente:**
  - `100 pts`: Palabra única válida.
  - `50 pts`: Palabra repetida con otro jugador.
  - `0 pts`: Palabra inválida o campo vacío.
- **Moderación en Vivo:** El Host puede invalidar respuestas de cualquier jugador tocando la palabra en la tabla de resultados.

## 🎮 Cómo Jugar

1. **Entra al sitio:** Accede a [stop-digital.pages.dev](https://stop-digital.pages.dev).
2. **Crea una Sala:** Si eres el anfitrión, escribe tu apodo y pulsa "Crear Sala Pro". Comparte el código generado (`STOP-XXXX`) con tus amigos.
3. **Únete a una Sala:** Si eres invitado, escribe tu apodo, pega el código de tu amigo y pulsa "Unirse".
4. **¡STOP!:** El primero en completar las categorías debe pulsar el botón central de STOP para congelar las pantallas de los demás.
5. **Revisión:** El anfitrión revisa la tabla y pulsa "Siguiente Ronda" hasta que alguien alcance la meta de victoria.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3 (Variables dinámicas, Flexbox, Animaciones).
- **Lógica:** JavaScript Vanilla (ES6+).
- **Comunicación:** PeerJS / WebRTC.
- **PWA:** Service Workers y Manifest.json.
- **Hosting:** Cloudflare Pages.

## 📦 Estructura del Proyecto

El proyecto es extremadamente ligero y consta de solo 4 archivos principales:

```text
├── index.html      # Interfaz de usuario, Estilos y Lógica (Single File)
├── manifest.json   # Configuración para instalación en móviles
├── sw.js           # Service Worker para funcionamiento Offline
└── icon.png        # Icono oficial de la aplicación (512x512)
````

## 🔧 Requisitos para Despliegue Local

Si deseas clonar este proyecto y subirlo a tu propio servidor, recuerda que:

1.  **Certificado SSL (HTTPS):** Es obligatorio. PeerJS y las funcionalidades de PWA (Service Workers) no funcionan en conexiones inseguras `http`.
2.  **Archivos en la Raíz:** Todos los archivos (`index.html`, `manifest.json`, `sw.js`, `icon.png`) deben estar en la misma carpeta raíz para que las rutas relativas funcionen.
3.  **Navegadores Soportados:** Chrome, Safari, Edge y Firefox (versiones recientes).

## 📄 Licencia

Este proyecto es de código abierto. Puedes usarlo, modificarlo y compartirlo libremente para jugar con tus amigos.

---
**Stop Digital P2P** - *Diversión en tiempo real, sin registros ni servidores.*
