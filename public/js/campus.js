// Campus privado: menú por rol y pantallas.
import { auth, db, signOut, collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "./firebase.js";
import { esc, icono } from "./util.js";
import { contarPendientes, esStaff, nombreCompleto } from "./datos.js";
import {
  vistaSolicitudes, vistaAlumnos, vistaPromociones, vistaProfesores, vistaMiCuenta, pintarMisCursos,
} from "./gestion.js";

// Secciones de cada rol. "paso" = en qué paso del plan se construye (las que aún no existen).
const SECCIONES_STAFF = [
  { id: "inicio", label: "Inicio" },
  { id: "solicitudes", label: "Solicitudes", desc: "Aprobar o rechazar las solicitudes de inscripción enviadas desde la web." },
  { id: "alumnos", label: "Alumnos", desc: "Alta de alumnos, sus promociones y acceso a su cuenta." },
  { id: "promociones", label: "Promociones", desc: "Crear, editar y eliminar los cursos que aparecen en la web." },
  { id: "preguntas", label: "Preguntas", paso: 4, desc: "Temario oficial (45 temas en 3 bloques) y banco de preguntas con su explicación." },
  { id: "tests", label: "Tests", paso: 5, desc: "Crear tests cerrados y asignarlos a una o varias promociones." },
];
const MENU = {
  admin: [...SECCIONES_STAFF, { id: "profesores", label: "Profesores", desc: "Alta y desactivación de profesores." }, { id: "cuenta", label: "Mi cuenta" }],
  profesor: [...SECCIONES_STAFF, { id: "cuenta", label: "Mi cuenta" }],
  alumno: [
    { id: "inicio", label: "Inicio" },
    { id: "tests", label: "Mis tests", paso: 5, desc: "Los tests que tu profesor ha asignado a tus promociones." },
    { id: "amedida", label: "A medida", paso: "v2", desc: "Elige temas y número de preguntas y genera tu propio test." },
    { id: "simulacro", label: "Simulacro", paso: "v2", desc: "Examen completo: 100 preguntas en 50 minutos, de todo el temario." },
    { id: "progreso", label: "Progreso", paso: "v2", desc: "Historial de tests, notas y evolución por temas." },
    { id: "cuenta", label: "Mi cuenta" },
  ],
};
const ICONO_SECCION = { cuenta: "persona", profesores: "escudo", promociones: "libro", solicitudes: "solicitud" };
const ROL_TEXTO = { admin: "Administrador", profesor: "Profesor", alumno: "Alumno" };

// Curso de ejemplo: se crea una sola vez, la primera vez que entra el administrador y no hay ningún curso.
const CURSO_EJEMPLO = {
  nombre: "Policía Nacional – Escala Básica (Teórica)",
  descripcion:
    "Preparación de la prueba de conocimientos de la Escala Básica de Policía Nacional.\n\n" +
    "• Temario oficial actualizado (45 temas en 3 bloques).\n" +
    "• Pruebas semanales y simulacros con el formato del examen real: 100 preguntas, 3 opciones y penalización por error.\n" +
    "• Acceso al campus online de tests con corrección al momento y explicación de cada respuesta.\n" +
    "• Seguimiento individual de tu progreso.",
  precio: null, // se muestra "XXX €" hasta que se defina
};

async function asegurarCursoEjemplo(usuario) {
  if (usuario.rol !== "admin" || usuario.ejemploCreado) return false;
  const snap = await getDocs(collection(db, "cursos"));
  if (snap.empty) await setDoc(doc(db, "cursos", "ejemplo-escala-basica"), { ...CURSO_EJEMPLO, creado: serverTimestamp() });
  await updateDoc(doc(db, "users", usuario.uid), { ejemploCreado: true });
  usuario.ejemploCreado = true;
  return snap.empty;
}

export function pintarCampus(root, usuario, seccion, ctx = {}) {
  const menu = MENU[usuario.rol] || MENU.alumno;
  const actual = menu.some((s) => s.id === seccion) ? seccion : "inicio";
  const items = menu
    .map((s) => `<a href="#/campus/${s.id}" class="nav-item${s.id === actual ? " activo" : ""}" ${s.id === actual ? 'aria-current="page"' : ""} data-sec="${s.id}">
        ${icono(ICONO_SECCION[s.id] || s.id)}<span>${s.label}</span>${s.id === "solicitudes" ? '<b class="insignia" hidden></b>' : ""}</a>`)
    .join("");

  root.innerHTML = `
  <div class="panel">
    <aside class="lateral">
      <a href="#/" class="marca"><img src="img/icono.png" alt=""><div><strong>Alphapol</strong><small>Campus · ${ROL_TEXTO[usuario.rol]}</small></div></a>
      <nav class="nav" aria-label="Secciones">${items}</nav>
      <a href="#/" class="nav-item">${icono("inicio")}<span>Web pública</span></a>
      <button class="nav-item salir" id="salir">${icono("salir")}<span>Cerrar sesión</span></button>
    </aside>
    <div class="contenido">
      <header class="cabecera">
        <a href="#/" class="marca-movil"><img src="img/icono.png" alt=""><strong>Alphapol</strong></a>
        <div class="usuario">
          <span class="chip-rol">${ROL_TEXTO[usuario.rol]}</span>
          <span class="nombre">${esc(nombreCompleto(usuario))}</span>
          <button class="btn-icono" id="salir-movil" aria-label="Cerrar sesión">${icono("salir")}</button>
        </div>
      </header>
      <main class="vista" id="vista"></main>
    </div>
    <nav class="nav-inferior" aria-label="Secciones">${items}</nav>
  </div>`;
  window.scrollTo(0, 0);
  root.querySelector(".nav-inferior .activo")?.scrollIntoView({ inline: "center", block: "nearest" });

  const salir = async () => { await signOut(auth); location.hash = "#/"; };
  document.getElementById("salir").onclick = salir;
  document.getElementById("salir-movil").onclick = salir;

  const vista = document.getElementById("vista");
  const s = menu.find((x) => x.id === actual);
  switch (actual) {
    case "inicio": vistaInicio(vista, usuario, menu, ctx); break;
    case "solicitudes": vistaSolicitudes(vista, ctx).then(() => actualizarInsignia()); break;
    case "alumnos": vistaAlumnos(vista, ctx); break;
    case "promociones": vistaPromociones(vista, ctx); break;
    case "profesores": vistaProfesores(vista, ctx); break;
    case "cuenta": vistaMiCuenta(vista, usuario); break;
    default: vista.innerHTML = vistaPendiente(s);
  }
  if (esStaff(usuario)) actualizarInsignia();
}

// Número de solicitudes pendientes junto a "Solicitudes" en el menú.
// Provisional: se quitará cuando haya emails automáticos (ver README).
async function actualizarInsignia() {
  try {
    const n = await contarPendientes();
    document.querySelectorAll(".insignia").forEach((b) => { b.textContent = n; b.hidden = !n; });
    return n;
  } catch (e) { console.warn(e); return 0; }
}

function vistaPendiente(s) {
  return `
    <h1 class="titulo">${s.label}</h1>
    <div class="tarjeta proximamente">
      <span class="etiqueta">${s.paso === "v2" ? "Versión 2" : "Paso " + s.paso + " del plan"}</span>
      <h2>En construcción</h2>
      <p>${s.desc}</p>
    </div>`;
}

function vistaInicio(vista, usuario, menu, ctx) {
  const nombre = esc((usuario.nombre || "").split(" ")[0] || "");
  const accesos = menu
    .filter((s) => !["inicio", "cuenta"].includes(s.id))
    .map((s) => `<a href="#/campus/${s.id}" class="acceso">${icono(ICONO_SECCION[s.id] || s.id)}<div><strong>${s.label}</strong><p>${s.desc}</p></div></a>`)
    .join("");

  if (usuario.rol === "alumno") {
    vista.innerHTML = `
      <h1 class="titulo">Hola${nombre ? ", " + nombre : ""}</h1>
      <p class="intro">Aquí encontrarás los tests de tus cursos y podrás ver tu progreso.</p>
      <h2 class="seccion-tit">Mis promociones</h2>
      <div id="mis-cursos" class="bloque-campus"><div class="spinner"></div></div>
      <div class="rejilla">${accesos}</div>`;
    pintarMisCursos(document.getElementById("mis-cursos"), usuario);
    return;
  }

  vista.innerHTML = `
    <h1 class="titulo">Hola${nombre ? ", " + nombre : ""}</h1>
    <p class="intro">Desde aquí gestionas solicitudes, alumnos, promociones, preguntas y tests.</p>
    <div id="avisos" class="avisos"></div>
    <div class="rejilla">${accesos}</div>`;
  (async () => {
    const cont = document.getElementById("avisos");
    try {
      const [creado, pendientes] = await Promise.all([asegurarCursoEjemplo(usuario), actualizarInsignia()]);
      if (creado) ctx.invalidarCursos?.();
      if (!document.body.contains(cont)) return;
      cont.innerHTML = `
        <a href="#/campus/solicitudes" class="aviso${pendientes ? " aviso-activo" : ""}">
          ${icono("solicitud")}
          <div><strong>${pendientes}</strong><span>${pendientes === 1 ? "solicitud de inscripción pendiente" : "solicitudes de inscripción pendientes"}</span></div>
        </a>
        ${creado ? `<p class="nota nota-izq">Se ha creado el curso de ejemplo «${esc(CURSO_EJEMPLO.nombre)}». Ya aparece en la web pública.</p>` : ""}`;
    } catch (e) {
      console.error(e);
      cont.innerHTML = `<p class="nota nota-izq">No se han podido cargar las solicitudes pendientes.</p>`;
    }
  })();
}
