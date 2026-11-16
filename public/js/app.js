// Arranque: decide qué página mostrar según la dirección (#/...) y la sesión.
//
//   #/                  Inicio (web pública)
//   #/cursos            Listado de cursos
//   #/cursos/{id}       Detalle del curso + solicitud de inscripción
//   #/acceso            Iniciar sesión
//   #/privacidad        Política de privacidad (borrador)
//   #/campus[/seccion]  Campus privado (requiere sesión)
import {
  auth, db, ADMIN_INICIAL,
  signOut, onAuthStateChanged,
  doc, getDoc, setDoc, serverTimestamp,
} from "./firebase.js";
import { pintarInicio, pintarCursos, pintarCurso, pintarAcceso, pintarPrivacidad, invalidarCursos } from "./publico.js";
import { pintarCampus } from "./campus.js";
import { esc } from "./util.js";

const root = document.getElementById("app");
let usuario = null;   // perfil del usuario conectado { uid, email, nombre, rol, ... }
let listo = false;    // ya sabemos si hay sesión o no

// ---------- Perfil y rol ----------
async function cargarPerfil(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Fecha del último acceso (para estadísticas y limpieza por inactividad).
    setDoc(ref, { ultimoAcceso: serverTimestamp() }, { merge: true }).catch((e) => console.warn(e));
    return { uid: user.uid, email: user.email, ...snap.data() };
  }

  // Primer acceso del administrador inicial: se crea su perfil automáticamente.
  if ((user.email || "").toLowerCase() === ADMIN_INICIAL) {
    const perfil = { nombre: "Administrador", apellidos: "", email: user.email, rol: "admin", activo: true, cursos: [], creado: serverTimestamp(), ultimoAcceso: serverTimestamp() };
    await setDoc(ref, perfil);
    return { uid: user.uid, ...perfil };
  }
  return null; // cuenta sin perfil: no tiene acceso
}

// ---------- Rutas ----------
function rutaActual() {
  const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { pagina: partes[0] || "", param: decodeURIComponent(partes[1] || "") };
}

function pintar() {
  if (!listo) return pintarCarga();
  const { pagina, param } = rutaActual();

  switch (pagina) {
    case "":
    case "inicio": // dirección antigua del campus
      return pintarInicio(root, usuario);
    case "cursos":
      return param ? pintarCurso(root, usuario, param) : pintarCursos(root, usuario);
    case "privacidad":
      return pintarPrivacidad(root, usuario);
    case "acceso":
      if (usuario) { location.hash = "#/campus"; return; }
      return pintarAcceso(root);
    case "campus":
      if (!usuario) { location.hash = "#/acceso"; return; }
      return pintarCampus(root, usuario, param || "inicio", { invalidarCursos });
    default:
      location.hash = "#/";
  }
}

function pintarCarga() {
  root.innerHTML = `<div class="carga"><img src="img/logo.png" alt="Alphapol" class="carga-logo"><div class="spinner"></div></div>`;
}

function pintarSinAcceso(email) {
  root.innerHTML = `
  <section class="login">
    <div class="login-card">
      <img src="img/logo.png" alt="Alphapol" class="login-logo">
      <h1>Cuenta sin acceso</h1>
      <p class="login-sub">La cuenta <strong>${esc(email)}</strong> no está dada de alta en el campus. Contacta con tu academia.</p>
      <button class="btn btn-oro" id="volver">Volver a la web</button>
    </div>
  </section>`;
  document.getElementById("volver").onclick = async () => { await signOut(auth); location.hash = "#/"; };
}

// ---------- Arranque ----------
window.addEventListener("hashchange", pintar);
pintarCarga();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    usuario = null;
    listo = true;
    return pintar();
  }
  listo = false; // mientras se carga el perfil, pantalla de carga
  pintarCarga();
  try {
    const perfil = await cargarPerfil(user);
    if (!perfil || perfil.activo === false) {
      usuario = null;
      listo = true;
      return pintarSinAcceso(user.email);
    }
    usuario = perfil;
    listo = true;
    pintar();
  } catch (err) {
    console.error(err);
    await signOut(auth);
    usuario = null;
    listo = true;
    pintarAcceso(root, "login", "No se ha podido cargar tu perfil. Inténtalo de nuevo.");
  }
});
