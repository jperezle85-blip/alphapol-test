// Campus privado: paneles de profesor y alumno.
import {
  auth, db, signOut,
  collection, getDocs, query, where, doc, setDoc, serverTimestamp,
} from "./firebase.js";
import { esc, icono } from "./util.js";

// Secciones de cada rol. "paso" = en qué paso del plan se construye.
const MENU = {
  profesor: [
    { id: "inicio", label: "Inicio" },
    { id: "alumnos", label: "Alumnos", paso: 3, desc: "Solicitudes de inscripción, alta y baja de alumnos en cada promoción." },
    { id: "preguntas", label: "Preguntas", paso: 4, desc: "Temario oficial (45 temas en 3 bloques) y banco de preguntas con su explicación." },
    { id: "tests", label: "Tests", paso: 5, desc: "Crear tests cerrados y asignarlos a una o varias promociones." },
    { id: "resultados", label: "Resultados", paso: "v2", desc: "Notas de los alumnos, tests realizados y preguntas más falladas." },
  ],
  alumno: [
    { id: "inicio", label: "Inicio" },
    { id: "tests", label: "Mis tests", paso: 5, desc: "Los tests que tu profesor ha asignado a tus promociones." },
    { id: "amedida", label: "A medida", paso: "v2", desc: "Elige temas y número de preguntas y genera tu propio test." },
    { id: "simulacro", label: "Simulacro", paso: "v2", desc: "Examen completo: 100 preguntas en 50 minutos, de todo el temario." },
    { id: "progreso", label: "Progreso", paso: "v2", desc: "Historial de tests, notas y evolución por temas." },
  ],
};

// Curso de ejemplo: se crea solo la primera vez que entra un profesor y no hay ningún curso.
const CURSO_EJEMPLO = {
  nombre: "Policía Nacional – Escala Básica (Teórica)",
  descripcion:
    "Preparación de la prueba de conocimientos de la Escala Básica de Policía Nacional.\n\n" +
    "• Temario oficial actualizado (45 temas en 3 bloques).\n" +
    "• Pruebas semanales y simulacros con el formato del examen real: 100 preguntas, 3 opciones y penalización por error.\n" +
    "• Acceso al campus online de tests con corrección al momento y explicación de cada respuesta.\n" +
    "• Seguimiento individual de tu progreso.",
  precio: null, // se muestra "XXX €" hasta que se defina
  ejemplo: true,
};

async function asegurarCursoEjemplo() {
  const snap = await getDocs(collection(db, "cursos"));
  if (!snap.empty) return false;
  await setDoc(doc(db, "cursos", "ejemplo-escala-basica"), { ...CURSO_EJEMPLO, creado: serverTimestamp() });
  return true;
}

// Contador de solicitudes pendientes (provisional: se quitará cuando haya emails automáticos).
async function contarPendientes() {
  const snap = await getDocs(query(collection(db, "solicitudes"), where("estado", "==", "pendiente")));
  return snap.size;
}

export function pintarCampus(root, usuario, seccion, alCambiarCursos) {
  const rol = usuario.rol;
  const actual = MENU[rol].some((s) => s.id === seccion) ? seccion : "inicio";
  const items = MENU[rol]
    .map((s) => `<a href="#/campus/${s.id}" class="nav-item${s.id === actual ? " activo" : ""}" ${s.id === actual ? 'aria-current="page"' : ""}>
        ${icono(s.id)}<span>${s.label}</span></a>`)
    .join("");

  root.innerHTML = `
  <div class="panel">
    <aside class="lateral">
      <a href="#/" class="marca"><img src="img/icono.png" alt=""><div><strong>Alphapol</strong><small>Campus ${rol === "profesor" ? "profesor" : "alumno"}</small></div></a>
      <nav class="nav" aria-label="Secciones">${items}</nav>
      <a href="#/" class="nav-item">${icono("inicio")}<span>Web pública</span></a>
      <button class="nav-item salir" id="salir">${icono("salir")}<span>Cerrar sesión</span></button>
    </aside>
    <div class="contenido">
      <header class="cabecera">
        <a href="#/" class="marca-movil"><img src="img/icono.png" alt=""><strong>Alphapol</strong></a>
        <div class="usuario">
          <span class="chip-rol">${rol === "profesor" ? "Profesor" : "Alumno"}</span>
          <span class="nombre">${esc(usuario.nombre || usuario.email)}</span>
          <button class="btn-icono" id="salir-movil" aria-label="Cerrar sesión">${icono("salir")}</button>
        </div>
      </header>
      <main class="vista" id="vista">${vista(usuario, actual)}</main>
    </div>
    <nav class="nav-inferior" aria-label="Secciones">${items}</nav>
  </div>`;
  window.scrollTo(0, 0);

  const salir = async () => { await signOut(auth); location.hash = "#/"; };
  document.getElementById("salir").onclick = salir;
  document.getElementById("salir-movil").onclick = salir;

  if (rol === "profesor" && actual === "inicio") cargarAvisosProfesor(alCambiarCursos);
}

function vista(usuario, id) {
  if (id === "inicio") return vistaInicio(usuario);
  const s = MENU[usuario.rol].find((x) => x.id === id);
  return `
    <h1 class="titulo">${s.label}</h1>
    <div class="tarjeta proximamente">
      <span class="etiqueta">${s.paso === "v2" ? "Versión 2" : "Paso " + s.paso + " del plan"}</span>
      <h2>En construcción</h2>
      <p>${s.desc}</p>
    </div>`;
}

function vistaInicio(usuario) {
  const nombre = esc((usuario.nombre || "").split(" ")[0] || "");
  const accesos = MENU[usuario.rol]
    .filter((s) => s.id !== "inicio")
    .map((s) => `<a href="#/campus/${s.id}" class="acceso">${icono(s.id)}<div><strong>${s.label}</strong><p>${s.desc}</p></div></a>`)
    .join("");
  const intro = usuario.rol === "profesor"
    ? "Desde aquí gestionarás alumnos, preguntas y tests, y verás los resultados de cada promoción."
    : "Aquí encontrarás los tests de tus cursos y podrás ver tu progreso.";
  const avisos = usuario.rol === "profesor" ? `<div id="avisos" class="avisos"></div>` : "";
  return `
    <h1 class="titulo">Hola${nombre ? ", " + nombre : ""}</h1>
    <p class="intro">${intro}</p>
    ${avisos}
    <div class="rejilla">${accesos}</div>`;
}

async function cargarAvisosProfesor(alCambiarCursos) {
  const cont = document.getElementById("avisos");
  if (!cont) return;
  try {
    const [creado, pendientes] = await Promise.all([asegurarCursoEjemplo(), contarPendientes()]);
    if (creado && alCambiarCursos) alCambiarCursos();
    if (!document.body.contains(cont)) return;
    cont.innerHTML = `
      <a href="#/campus/alumnos" class="aviso${pendientes ? " aviso-activo" : ""}">
        ${icono("solicitud")}
        <div><strong>${pendientes}</strong><span>${pendientes === 1 ? "solicitud de inscripción pendiente" : "solicitudes de inscripción pendientes"}</span></div>
      </a>
      ${creado ? `<p class="nota">Se ha creado el curso de ejemplo «${esc(CURSO_EJEMPLO.nombre)}». Ya aparece en la web pública.</p>` : ""}`;
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<p class="nota">No se han podido cargar las solicitudes pendientes.</p>`;
  }
}
