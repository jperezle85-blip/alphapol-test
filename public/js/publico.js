// Web pública: Inicio, Cursos (con inscripción), Iniciar sesión y Privacidad.
import {
  auth, db,
  signInWithEmailAndPassword, sendPasswordResetEmail,
  collection, getDocs, doc, getDoc, addDoc, serverTimestamp,
} from "./firebase.js";
import { esc, icono, mostrar, traducirError, formatoPrecio, EMAIL_RE } from "./util.js";

// Datos de contacto tomados de alphapol.es
const ACADEMIA = {
  web: "https://alphapol.es/",
  direccion: "C. Corregidor Antonio de Bobadilla, 14 · 29006 Málaga",
  mapa: "https://www.google.com/maps/search/?api=1&query=Calle+Corregidor+Antonio+de+Bobadilla+14+29006+M%C3%A1laga",
  telefono: "665 270 070",
  telefonoHref: "tel:+34665270070",
  whatsapp: "https://wa.me/34665270070",
  email: "info@alphapol.es",
  instagram: "https://www.instagram.com/alphapol_formacion/",
  horario: "Lunes a viernes · 9:30–14:00 y 16:30–20:00",
};

// ---------- Cursos (lectura pública) ----------
let cacheCursos = null;
export function invalidarCursos() { cacheCursos = null; }

async function cargarCursos() {
  if (cacheCursos) return cacheCursos;
  const snap = await getDocs(collection(db, "cursos"));
  cacheCursos = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  return cacheCursos;
}

async function cargarCurso(id) {
  if (cacheCursos) {
    const c = cacheCursos.find((x) => x.id === id);
    if (c) return c;
  }
  const snap = await getDoc(doc(db, "cursos", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Estructura común ----------
function cabecera(actual, usuario) {
  const enlace = (href, id, texto) =>
    `<a href="${href}" class="pub-link${actual === id ? " activo" : ""}"${actual === id ? ' aria-current="page"' : ""}>${texto}</a>`;
  const acceso = usuario
    ? `<a href="#/campus" class="btn btn-oro btn-sm">Mi campus</a>`
    : `<a href="#/acceso" class="btn btn-oro btn-sm${actual === "acceso" ? " activo" : ""}">Iniciar sesión</a>`;
  return `
  <header class="pub-cabecera">
    <div class="pub-ancho pub-cabecera-in">
      <a href="#/" class="pub-marca" aria-label="Alphapol, inicio"><img src="img/icono.png" alt=""><span>Alphapol</span></a>
      <nav class="pub-nav" aria-label="Principal">
        ${enlace("#/", "inicio", "Inicio")}
        ${enlace("#/cursos", "cursos", "Cursos")}
        ${acceso}
      </nav>
    </div>
  </header>`;
}

function pie() {
  return `
  <footer class="pub-pie">
    <div class="pub-ancho pub-pie-in">
      <div class="pub-pie-marca"><img src="img/icono.png" alt=""><div><strong>Alphapol</strong><span>Centro de formación · Málaga</span></div></div>
      <ul class="pub-contacto">
        <li>${icono("mapa")}<a href="${ACADEMIA.mapa}" target="_blank" rel="noopener">${ACADEMIA.direccion}</a></li>
        <li>${icono("telefono")}<a href="${ACADEMIA.telefonoHref}">${ACADEMIA.telefono}</a> · <a href="${ACADEMIA.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>
        <li>${icono("email")}<a href="mailto:${ACADEMIA.email}">${ACADEMIA.email}</a></li>
        <li>${icono("instagram")}<a href="${ACADEMIA.instagram}" target="_blank" rel="noopener">@alphapol_formacion</a></li>
      </ul>
    </div>
    <div class="pub-ancho pub-legal">
      <span>© ${new Date().getFullYear()} Alphapol</span>
      <a href="#/privacidad">Política de privacidad</a>
      <a href="${ACADEMIA.web}" target="_blank" rel="noopener">alphapol.es</a>
    </div>
  </footer>`;
}

function pintarPagina(root, actual, usuario, contenido) {
  root.innerHTML = `<div class="pub">${cabecera(actual, usuario)}<main class="pub-main">${contenido}</main>${pie()}</div>`;
  window.scrollTo(0, 0);
}

function tarjetaCurso(c) {
  return `
  <article class="curso">
    <div class="curso-cab">
      <h3>${esc(c.nombre)}</h3>
      <span class="curso-precio">${esc(formatoPrecio(c.precio))}</span>
    </div>
    <p class="curso-desc">${esc((c.descripcion || "").split(/\n\s*\n/)[0])}</p>
    <a href="#/cursos/${encodeURIComponent(c.id)}" class="btn btn-oro">Ver curso e inscribirme</a>
  </article>`;
}

// ---------- Inicio ----------
export async function pintarInicio(root, usuario) {
  pintarPagina(root, "inicio", usuario, `
  <section class="hero">
    <img src="img/aula.jpg" alt="Alumnos de Alphapol haciendo un test en el aula" class="hero-img">
    <div class="hero-velo"></div>
    <div class="pub-ancho hero-in">
      <p class="hero-pre">Academia de Policía Nacional · Málaga</p>
      <h1>Te preparamos, te acompañamos y te llevamos al apto.</h1>
      <p class="hero-sub">Practica online con los tests de tu academia: mismo formato que el examen oficial, corrección al momento y la explicación de cada respuesta.</p>
      <div class="hero-acciones">
        <a href="#/cursos" class="btn btn-oro">Ver cursos</a>
        <a href="${usuario ? "#/campus" : "#/acceso"}" class="btn btn-borde">${usuario ? "Ir a mi campus" : "Acceder al campus"}</a>
      </div>
    </div>
  </section>

  <section class="pub-ancho bloque">
    <h2 class="bloque-tit">El método Alphapol</h2>
    <div class="pilares">
      <article class="pilar">
        <img src="img/teoria.jpg" alt="Clase teórica en Alphapol" loading="lazy">
        <div><h3>${icono("libro")}Teoría y tests</h3><p>Temario actualizado, pruebas semanales y simulacros con el formato real del examen.</p></div>
      </article>
      <article class="pilar">
        <img src="img/fisica.jpg" alt="Entrenamiento de preparación física" loading="lazy">
        <div><h3>${icono("fisico")}Preparación física</h3><p>Entrenamiento por objetivos para las pruebas físicas, con correcciones técnicas.</p></div>
      </article>
    </div>
  </section>

  <section class="pub-ancho bloque">
    <div class="bloque-cab">
      <h2 class="bloque-tit">Cursos</h2>
      <a href="#/cursos" class="enlace-flecha">Ver todos ${icono("flecha")}</a>
    </div>
    <div class="cursos" id="cursos-destacados"><div class="spinner"></div></div>
  </section>`);

  const cont = document.getElementById("cursos-destacados");
  try {
    const cursos = await cargarCursos();
    cont.innerHTML = cursos.length
      ? cursos.slice(0, 3).map(tarjetaCurso).join("")
      : `<p class="vacio">Pronto publicaremos nuevos cursos.</p>`;
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<p class="vacio">No se han podido cargar los cursos.</p>`;
  }
}

// ---------- Cursos ----------
export async function pintarCursos(root, usuario) {
  pintarPagina(root, "cursos", usuario, `
  <section class="pub-ancho bloque">
    <h1 class="pub-titulo">Cursos</h1>
    <p class="pub-intro">Elige tu curso y solicita la inscripción. La academia revisará tu solicitud y, cuando la apruebe, te enviaremos un email para crear tu contraseña y entrar al campus.</p>
    <div class="cursos" id="lista-cursos"><div class="spinner"></div></div>
  </section>`);
  const cont = document.getElementById("lista-cursos");
  try {
    const cursos = await cargarCursos();
    cont.innerHTML = cursos.length
      ? cursos.map(tarjetaCurso).join("")
      : `<p class="vacio">Ahora mismo no hay cursos abiertos.</p>`;
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<p class="vacio">No se han podido cargar los cursos.</p>`;
  }
}

// ---------- Detalle de curso + inscripción ----------
export async function pintarCurso(root, usuario, id) {
  pintarPagina(root, "cursos", usuario, `<section class="pub-ancho bloque" id="detalle"><div class="spinner"></div></section>`);
  const cont = document.getElementById("detalle");
  let curso;
  try { curso = await cargarCurso(id); } catch (e) { console.error(e); }
  if (!curso) {
    cont.innerHTML = `<h1 class="pub-titulo">Curso no encontrado</h1><p class="pub-intro">Puede que ya no esté disponible.</p><a href="#/cursos" class="btn btn-borde">Ver cursos</a>`;
    return;
  }

  cont.innerHTML = `
    <a href="#/cursos" class="volver">← Todos los cursos</a>
    <div class="detalle">
      <div class="detalle-info">
        <h1 class="pub-titulo">${esc(curso.nombre)}</h1>
        <p class="detalle-precio">${esc(formatoPrecio(curso.precio))}</p>
        <div class="detalle-desc">${esc(curso.descripcion || "").replace(/\n/g, "<br>")}</div>
      </div>
      <div class="detalle-form" id="zona-inscripcion">${formularioInscripcion(curso, usuario)}</div>
    </div>`;
  activarInscripcion(curso, usuario);
}

function formularioInscripcion(curso, usuario) {
  if (usuario && usuario.rol !== "alumno") {
    return `<div class="tarjeta-form"><h2>Inscripción</h2><p class="nota">Has iniciado sesión con una cuenta de <strong>${usuario.rol === "admin" ? "administrador" : "profesor"}</strong>. La inscripción es para alumnos.</p></div>`;
  }
  if (usuario && (usuario.cursos || []).includes(curso.id)) {
    return `<div class="tarjeta-form"><h2>Ya estás inscrito</h2><p class="nota">Tienes este curso en tu campus.</p><a href="#/campus" class="btn btn-oro">Ir a mi campus</a></div>`;
  }
  if (usuario) {
    return `
    <form class="tarjeta-form" id="form-insc" novalidate>
      <h2>Solicitar inscripción</h2>
      <p class="nota">Te inscribirás con tu cuenta <strong>${esc(usuario.email)}</strong>.</p>
      <div class="msg" id="msg" role="alert"></div>
      <button type="submit" class="btn btn-oro" id="btn-insc">Solicitar inscripción</button>
    </form>`;
  }
  return `
  <form class="tarjeta-form" id="form-insc" novalidate>
    <h2>Solicitar inscripción</h2>
    <label>Nombre<input id="f-nombre" autocomplete="given-name" maxlength="60" required></label>
    <label>Apellidos<input id="f-apellidos" autocomplete="family-name" maxlength="80" required></label>
    <label>Email<input id="f-email" type="email" autocomplete="email" maxlength="120" required placeholder="tu@email.com"></label>
    <label class="check"><input type="checkbox" id="f-privacidad"><span>He leído y acepto la <a href="#/privacidad" target="_blank">política de privacidad</a>.</span></label>
    <div class="msg" id="msg" role="alert"></div>
    <button type="submit" class="btn btn-oro" id="btn-insc">Solicitar inscripción</button>
    <p class="nota nota-peq">¿Ya tienes cuenta? <a href="#/acceso">Inicia sesión</a> y solicita el curso desde aquí.</p>
  </form>`;
}

function activarInscripcion(curso, usuario) {
  const form = document.getElementById("form-insc");
  if (!form) return;
  const msg = document.getElementById("msg");
  const btn = document.getElementById("btn-insc");

  form.onsubmit = async (e) => {
    e.preventDefault();
    let datos;
    if (usuario) {
      datos = {
        nombre: usuario.nombre || "",
        apellidos: usuario.apellidos || "",
        email: auth.currentUser.email,
        uid: auth.currentUser.uid,
      };
    } else {
      const nombre = document.getElementById("f-nombre").value.trim();
      const apellidos = document.getElementById("f-apellidos").value.trim();
      const email = document.getElementById("f-email").value.trim().toLowerCase();
      const acepta = document.getElementById("f-privacidad").checked;
      if (!nombre || !apellidos || !email) return mostrar(msg, "Rellena nombre, apellidos y email.");
      if (!EMAIL_RE.test(email)) return mostrar(msg, "El email no tiene un formato válido.");
      if (!acepta) return mostrar(msg, "Debes aceptar la política de privacidad.");
      datos = { nombre, apellidos, email };
    }

    btn.disabled = true;
    try {
      await addDoc(collection(db, "solicitudes"), {
        ...datos,
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        estado: "pendiente",
        aceptaPrivacidad: true,
        creado: serverTimestamp(),
      });
      document.getElementById("zona-inscripcion").innerHTML = `
        <div class="tarjeta-form enviada">
          <div class="ok-icono">${icono("check")}</div>
          <h2>Solicitud enviada</h2>
          <p>Hemos recibido tu solicitud para <strong>${esc(curso.nombre)}</strong>.</p>
          <p class="nota">${usuario
            ? "Cuando la academia la apruebe, verás el curso en tu campus."
            : `Cuando la academia la apruebe, recibirás un email en <strong>${esc(datos.email)}</strong> para crear tu contraseña y entrar al campus. Revisa también la carpeta de spam.`}</p>
          <a href="#/cursos" class="btn btn-borde">Volver a cursos</a>
        </div>`;
    } catch (err) {
      mostrar(msg, traducirError(err));
      btn.disabled = false;
    }
  };
}

// ---------- Iniciar sesión ----------
export function pintarAcceso(root, modo = "login", aviso = "") {
  const esReset = modo === "reset";
  pintarPagina(root, "acceso", null, `
  <section class="login">
    <div class="login-card">
      <img src="img/logo.png" alt="Alphapol · Centro de formación" class="login-logo">
      <h1>${esReset ? "Recuperar contraseña" : "Acceso al campus"}</h1>
      <p class="login-sub">${esReset
        ? "Escribe tu email y te enviaremos un enlace para crear una contraseña nueva."
        : "Entra con el email y la contraseña de tu cuenta de Alphapol."}</p>
      <form id="form-login" novalidate>
        <label>Email
          <input type="email" id="email" autocomplete="email" required placeholder="tu@email.com">
        </label>
        ${esReset ? "" : `
        <label>Contraseña
          <input type="password" id="password" autocomplete="current-password" required placeholder="••••••••">
        </label>`}
        <div class="msg${aviso ? " visible" : ""}" id="msg" role="alert">${esc(aviso)}</div>
        <button type="submit" class="btn btn-oro" id="btn-enviar">${esReset ? "Enviar enlace" : "Entrar"}</button>
      </form>
      <button class="enlace" id="cambiar-modo">${esReset ? "← Volver al acceso" : "¿Olvidaste tu contraseña?"}</button>
    </div>
    <p class="login-pie">¿Aún no tienes cuenta? <a href="#/cursos">Inscríbete en un curso</a>.</p>
  </section>`);

  const msg = document.getElementById("msg");
  const btn = document.getElementById("btn-enviar");
  document.getElementById("cambiar-modo").onclick = () => pintarAcceso(root, esReset ? "login" : "reset");

  document.getElementById("form-login").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    if (!email) return mostrar(msg, "Escribe tu email.");
    btn.disabled = true;
    try {
      if (esReset) {
        await sendPasswordResetEmail(auth, email);
        // Mismo mensaje exista o no la cuenta, para no revelar qué emails están dados de alta.
        mostrar(msg, "Si ese email tiene cuenta en Alphapol, recibirás un enlace en unos minutos. Revisa también la carpeta de spam.", true);
      } else {
        const pass = document.getElementById("password").value;
        if (!pass) { btn.disabled = false; return mostrar(msg, "Escribe tu contraseña."); }
        await signInWithEmailAndPassword(auth, email, pass);
        return; // al cargar el perfil, la ruta #/acceso redirige al campus

      }
    } catch (err) {
      mostrar(msg, traducirError(err));
    }
    btn.disabled = false;
  };
}

// ---------- Política de privacidad (BORRADOR) ----------
export function pintarPrivacidad(root, usuario) {
  pintarPagina(root, "privacidad", usuario, `
  <section class="pub-ancho bloque legal">
    <p class="borrador">BORRADOR – pendiente de revisión legal</p>
    <h1 class="pub-titulo">Política de privacidad</h1>
    <p>Este texto es provisional y debe ser revisado y completado por la academia o su asesor legal antes de abrir el campus al público.</p>

    <h2>Responsable del tratamiento</h2>
    <p>Alphapol – Centro de formación. ${ACADEMIA.direccion}. Email: <a href="mailto:${ACADEMIA.email}">${ACADEMIA.email}</a>. <em>[Pendiente: razón social y NIF/CIF.]</em></p>

    <h2>Qué datos tratamos</h2>
    <p>Nombre, apellidos y email que nos facilitas al solicitar la inscripción, los cursos en los que estás inscrito, tus respuestas y resultados en los tests y la fecha de tu último acceso.</p>

    <h2>Para qué los usamos</h2>
    <p>Para gestionar tu solicitud de inscripción, darte acceso al campus de tests, corregir tus tests y mostrar tu progreso, y que tu profesor pueda hacer seguimiento de tus resultados.</p>

    <h2>Base legal</h2>
    <p>Tu consentimiento al enviar la solicitud y la ejecución de la relación de formación con la academia. <em>[Pendiente de confirmar.]</em></p>

    <h2>Cuánto tiempo los conservamos</h2>
    <p>Los resultados de un curso se eliminan cuando la promoción finaliza. Tu cuenta se conserva para que puedas inscribirte en otros cursos y se eliminará tras un periodo prolongado sin uso. <em>[Pendiente: plazo exacto.]</em></p>

    <h2>Con quién los compartimos</h2>
    <p>No cedemos tus datos a terceros. El campus funciona sobre los servicios de Google Firebase, que actúa como proveedor tecnológico (encargado del tratamiento). <em>[Pendiente: detallar ubicación de los servidores y garantías.]</em></p>

    <h2>Tus derechos</h2>
    <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:${ACADEMIA.email}">${ACADEMIA.email}</a>. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
  </section>`);
}
