# Alphapol · Campus de tests

Portal web de tests para Alphapol (oposiciones a Policía Nacional), con perfiles de profesor y alumno.

- **Tecnología:** HTML + JavaScript sin compilación. Firebase (login y base de datos) se carga desde su CDN oficial.
- **Alojamiento:** Firebase Hosting (proyecto `alphapol-4fa0e`). Se publica solo al subir a la rama `main` (GitHub Actions).
- **Seguridad:** `firestore.rules`.

## Estructura

```
public/                  Lo que se publica en la web
  index.html             Página única del portal
  css/styles.css         Estilos (paleta azul noche + dorado del logo)
  js/firebase.js         Conexión con Firebase
  js/app.js              Rutas (#/...) y sesión
  js/publico.js          Web pública: Inicio, Cursos, inscripción, acceso, privacidad
  js/campus.js           Campus privado: menú por rol e Inicio
  js/gestion.js          Pantallas de gestión: Solicitudes, Alumnos, Promociones, Profesores, Mi cuenta
  js/datos.js            Lectura y escritura en Firestore (altas de cuentas incluidas)
  js/util.js             Utilidades e iconos
  img/                   Logo, icono y fotos de la academia (con su permiso)
firestore.rules          Reglas de seguridad de la base de datos
firebase.json            Configuración de Firebase Hosting
.firebaserc              Proyecto de Firebase al que se publica
.github/workflows/       Publicación automática de la web al subir a main
```

## Rutas

| Dirección | Página |
|---|---|
| `#/` | Inicio (presentación corta + cursos destacados) |
| `#/cursos` | Listado de cursos |
| `#/cursos/{id}` | Detalle del curso y solicitud de inscripción |
| `#/acceso` | Iniciar sesión / recuperar contraseña |
| `#/privacidad` | Política de privacidad (BORRADOR) |
| `#/campus[/sección]` | Campus privado (requiere sesión) |

## Datos (Firestore)

- `users/{uid}`: `{ nombre, apellidos, email, rol: "admin" | "profesor" | "alumno", cursos: [ids], activo, creado, ultimoAcceso }`
- `cursos/{id}`: `{ nombre, descripcion, precio, creado }` — lectura pública. `precio: null` se muestra como "XXX €".
- `solicitudes/{id}`: `{ cursoId, cursoNombre, nombre, apellidos, email, uid?, estado: "pendiente", aceptaPrivacidad, creado }`
  — cualquiera puede crearla (formulario público, con validación en las reglas); solo los profesores la leen.

## Decisiones

- Sin inscripción no hay cuenta: la cuenta se crea **al aprobar** la solicitud y el alumno recibe un email para crear su contraseña.
- Un alumno puede estar en varias promociones. Un alumno con cuenta solicita otro curso desde la ficha del curso, sin rellenar datos.
- Al eliminar una promoción se borran sus inscripciones y resultados; la cuenta del alumno y los tests se conservan.
- Roles: **administrador** (todo + alta/desactivación de profesores), **profesor** (solicitudes, alumnos, promociones, preguntas, tests) y **alumno**.
- Profesores: los da de alta el administrador desde el portal (pantalla Profesores).
- Rechazar una solicitud = eliminarla (sin aviso al alumno).
- Las cuentas no se borran desde el portal: se **desactivan** (no pueden entrar).
- El profesor puede corregir nombre y apellidos del alumno; el email solo se cambia desde la consola de Firebase.
- "Mi cuenta": datos, promociones del alumno y cambio de contraseña por email.
- Las altas de cuentas se hacen desde el navegador con una segunda conexión a Firebase (sin cerrar la sesión del profesor)
  y se envía el email de "restablecer contraseña" para que el usuario cree la suya.
- Tipografía: Montserrat (titulares y marca) + Source Sans 3 (texto).

## Plan de la v1

1. ✅ Base: login con roles e imagen de marca
2. ✅ Web pública (Inicio, Cursos con inscripción por solicitud, privacidad en borrador)
3. ✅ Roles (administrador/profesor/alumno) y gestión de promociones, solicitudes, alumnos y profesores; Mi cuenta
4. Temario precargado y banco de preguntas
5. Tests cerrados (temporizador, corrección A − E/2, nota sobre 10, revisión)
6. Importación de preguntas desde Excel
7. Panel del administrador (alumnos con acceso en los últimos 1/3/6/12 meses, altas del mes, nº de profesores, boceto de ingresos)

## v2

- Tests a medida y simulacros (100 preguntas / 50 min)
- Historial y estadísticas del alumno
- Panel de resultados del profesor

## Pendientes (al pasar a plan Blaze, si el proyecto sigue adelante)

- **Pasarela de pago** (Stripe o TPV Redsys, a decidir con la academia): sustituye la aprobación manual de solicitudes.
- **Corrección en el servidor (opción B).** En la v1 los tests se corrigen en el navegador del alumno,
  por lo que un alumno con conocimientos técnicos podría ver la respuesta correcta antes de contestar (F12).
  Mover la corrección a Cloud Functions. Para facilitarlo, desde el paso 4 las respuestas correctas se guardan
  **separadas** de los enunciados.
- **Emails automáticos al profesor** cuando llega una solicitud → entonces **quitar el contador provisional** de solicitudes pendientes del panel.
- **Rol de administrador validado en servidor** (custom claims).
- **Limpieza automática** de cuentas sin acceso en 5 años (con aviso previo por email). El campo `ultimoAcceso` ya se guarda.
- **Protección antispam** del formulario público de inscripción (Firebase App Check).

## Pendientes generales

- **RGPD:** sustituir la política de privacidad en BORRADOR por el texto revisado por la academia/asesor legal
  (razón social, NIF, base legal, plazos) y firmar contrato de encargado del tratamiento.
- **Precio real** del curso de ejemplo y resto de cursos.
- **Dominio propio** (por ejemplo `campus.alphapol.es`) y remitente de emails con ese dominio.

## Publicar

- **Web:** se publica sola al subir a la rama `main` (GitHub Actions).
- **Reglas de seguridad:** cada vez que cambie `firestore.rules`, ejecutar `npx firebase-tools deploy --only firestore:rules`.
