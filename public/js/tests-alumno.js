// Tests del alumno: lista, examen con temporizador, corrección y revisión.
import { esc, icono, traducirError } from "./util.js";
import { aviso, modal, confirmar } from "./gestion.js";
import { LETRAS } from "./temario.js";
import {
  NOTA_APROBADO, TIPOS, duracionTest, formatoDuracion, barajar,
  testsDelAlumno, leerTest, misIntentos, entregarIntento,
} from "./tests-datos.js";

const fmtNota = (n) => (Math.round(n * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaCorta = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Mientras hay un examen en curso, salir de la página pierde el intento (decisión de la v1).
export const examen = { activo: false, salir: null };
function avisoSalir(e) { if (examen.activo) { e.preventDefault(); e.returnValue = ""; } }
window.addEventListener("beforeunload", avisoSalir);

// =====================================================================
// RESUMEN (Inicio del alumno)
// =====================================================================
export async function pintarResumenAlumno(el, usuario) {
  if (!el) return;
  try {
    const its = await misIntentos(usuario.uid);
    const ap = its.filter((i) => i.aprobado).length;
    el.innerHTML = `
      <div class="resumen">
        <div><strong>${its.length}</strong><span>${its.length === 1 ? "test hecho" : "tests hechos"}</span></div>
        <div class="ok"><strong>${ap}</strong><span>${ap === 1 ? "aprobado" : "aprobados"}</span></div>
        <div class="ko"><strong>${its.length - ap}</strong><span>${its.length - ap === 1 ? "suspenso" : "suspensos"}</span></div>
      </div>`;
  } catch (e) { console.error(e); el.innerHTML = ""; }
}

// =====================================================================
// MIS TESTS
// =====================================================================
export async function vistaMisTests(cont, usuario) {
  cont.innerHTML = `
    <h1 class="titulo">Mis tests</h1>
    <p class="intro">Tests de tus promociones. Mismo formato que el examen oficial: 3 opciones, cada 2 errores restan un acierto y se aprueba con un ${NOTA_APROBADO}.</p>
    <div id="lista"><div class="spinner"></div></div>`;
  const lista = cont.querySelector("#lista");
  let tests, intentos;
  try { [tests, intentos] = await Promise.all([testsDelAlumno(usuario), misIntentos(usuario.uid)]); }
  catch (e) { console.error(e); lista.innerHTML = `<p class="nota nota-izq">No se han podido cargar tus tests. ${esc(traducirError(e))}</p>`; return; }

  if (!(usuario.cursos || []).length) {
    lista.innerHTML = `<div class="vacio-tarjeta">${icono("libro")}<p>Todavía no estás inscrito en ninguna promoción.</p><a href="#/cursos" class="btn btn-oro btn-sm">Ver cursos</a></div>`;
    return;
  }
  if (!tests.length) {
    lista.innerHTML = `<div class="vacio-tarjeta">${icono("tests")}<p>Tu profesor aún no ha publicado tests para tus promociones.</p></div>`;
    return;
  }
  lista.innerHTML = `<div class="filas">${tests.map((t) => {
    const its = intentos.filter((i) => i.testId === t.id);
    const mejor = its.length ? Math.max(...its.map((i) => i.nota)) : null;
    const n = (t.preguntas || []).length;
    const estado = mejor === null ? '<span class="chip chip-suave">Sin hacer</span>'
      : mejor >= NOTA_APROBADO ? '<span class="chip chip-ok">Aprobado</span>' : '<span class="chip chip-rojo">Suspenso</span>';
    return `
    <article class="fila" data-id="${esc(t.id)}">
      <div class="fila-info">
        <strong>${esc(t.titulo)} ${estado}</strong>
        <span>${TIPOS[t.tipo] || ""} · ${n} preguntas · ${formatoDuracion(duracionTest(n))}</span>
        <span class="fila-meta">${its.length ? `${its.length} ${its.length === 1 ? "intento" : "intentos"} · Mejor nota: <b>${fmtNota(mejor)}</b>` : "Aún no lo has hecho"}</span>
      </div>
      <div class="fila-acciones">
        ${its.length ? '<button class="btn btn-borde btn-sm" data-a="intentos">Mis intentos</button>' : ""}
        <button class="btn btn-oro btn-sm" data-a="empezar">${its.length ? "Repetir" : "Empezar"}</button>
      </div>
    </article>`;
  }).join("")}</div>`;

  lista.querySelectorAll(".fila").forEach((el) => {
    const t = tests.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-a="empezar"]').onclick = () => pantallaPrevia(cont, usuario, t);
    el.querySelector('[data-a="intentos"]')?.addEventListener("click", () => listaIntentos(cont, usuario, t, intentos.filter((i) => i.testId === t.id)));
  });
}

function listaIntentos(cont, usuario, test, its) {
  const m = modal(`Mis intentos · ${test.titulo}`, `
    <div class="filas">${its.map((i) => `
      <button class="fila fila-boton" data-id="${esc(i.id)}">
        <div class="fila-info"><strong>${fmtNota(i.nota)} ${i.aprobado ? '<span class="chip chip-ok">Aprobado</span>' : '<span class="chip chip-rojo">Suspenso</span>'}</strong>
          <span class="fila-meta">${fechaCorta(i.fecha)} · ${i.aciertos} aciertos · ${i.errores} errores · ${i.blancos} en blanco</span></div>
        <span class="enlace-flecha">Revisar ${icono("flecha")}</span>
      </button>`).join("")}</div>`, { ancho: 620 });
  m.el.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => {
    m.cerrar();
    pantallaResultado(cont, usuario, test, its.find((i) => i.id === b.dataset.id));
  }));
}

// =====================================================================
// ANTES DE EMPEZAR
// =====================================================================
function pantallaPrevia(cont, usuario, test) {
  const n = test.preguntas.length;
  cont.innerHTML = `
    <button class="volver enlace-volver" id="volver">← Mis tests</button>
    <div class="tarjeta previa">
      <h1 class="titulo">${esc(test.titulo)}</h1>
      <ul class="reglas">
        <li>${icono("preguntas")}<span><b>${n} preguntas</b> con 3 opciones; solo una es correcta.</span></li>
        <li>${icono("reloj")}<span><b>${formatoDuracion(duracionTest(n))}</b>. Cuando se acaba el tiempo, el test se entrega solo y lo que no hayas contestado cuenta en blanco.</span></li>
        <li>${icono("check")}<span>Cada acierto suma, <b>cada 2 errores restan un acierto</b> y las preguntas en blanco no restan. Apruebas con un <b>${NOTA_APROBADO}</b> sobre 10.</span></li>
        <li>${icono("salir")}<span><b>No se puede pausar.</b> Si sales de la página antes de entregar, el intento se pierde.</span></li>
      </ul>
      <button class="btn btn-oro" id="empezar">Empezar el test</button>
    </div>`;
  window.scrollTo(0, 0);
  cont.querySelector("#volver").onclick = () => vistaMisTests(cont, usuario);
  cont.querySelector("#empezar").onclick = () => pantallaExamen(cont, usuario, test);
}

// =====================================================================
// EXAMEN
// =====================================================================
function pantallaExamen(cont, usuario, test) {
  // Orden de preguntas y de opciones mezclado en cada intento.
  const orden = barajar(test.preguntas).map((p) => ({ p, ops: barajar([0, 1, 2]) }));
  const respuestas = {};                 // preguntaId → índice ORIGINAL de la opción elegida
  const total = duracionTest(orden.length);
  const inicio = Date.now();
  let entregado = false;

  cont.innerHTML = `
    <div class="barra-examen" role="region" aria-label="Estado del test">
      <div class="reloj" id="reloj" aria-live="off">${icono("reloj")}<span>${mmss(total)}</span></div>
      <div class="progreso"><span><b id="contestadas">0</b> / ${orden.length} contestadas</span><div class="barra"><i id="barra"></i></div></div>
      <button class="btn btn-oro btn-sm" id="entregar">Entregar</button>
    </div>
    <h1 class="titulo titulo-examen">${esc(test.titulo)}</h1>
    <ol class="examen">${orden.map(({ p, ops }, i) => `
      <li class="ex-preg" id="ex-${i}" data-id="${esc(p.id)}">
        <p class="ex-enun"><span class="num-tema">${i + 1}</span>${esc(p.enunciado)}</p>
        <div class="ex-ops" role="radiogroup" aria-label="Respuestas de la pregunta ${i + 1}">
          ${ops.map((o, j) => `<button type="button" role="radio" aria-checked="false" class="ex-op" data-o="${o}"><b>${LETRAS[j]})</b><span>${esc(p.opciones[o])}</span></button>`).join("")}
        </div>
        <p class="ex-nota">Pulsa otra vez la opción marcada para dejarla en blanco.</p>
      </li>`).join("")}
    </ol>
    <div class="fin-examen"><button class="btn btn-oro" id="entregar2">Entregar el test</button></div>`;
  window.scrollTo(0, 0);
  examen.activo = true;

  const contar = () => {
    const n = Object.values(respuestas).filter((v) => v !== -1).length;
    cont.querySelector("#contestadas").textContent = n;
    cont.querySelector("#barra").style.width = `${(n / orden.length) * 100}%`;
    return n;
  };
  cont.querySelectorAll(".ex-preg").forEach((li) => {
    const id = li.dataset.id;
    li.querySelectorAll(".ex-op").forEach((b) => (b.onclick = () => {
      const o = Number(b.dataset.o);
      const yaMarcada = respuestas[id] === o;
      respuestas[id] = yaMarcada ? -1 : o;
      li.querySelectorAll(".ex-op").forEach((x) => x.setAttribute("aria-checked", String(!yaMarcada && x === b)));
      li.classList.toggle("contestada", !yaMarcada);
      contar();
    }));
  });

  const relojEl = cont.querySelector("#reloj");
  const tic = () => {
    const quedan = Math.max(0, total - Math.floor((Date.now() - inicio) / 1000));
    relojEl.querySelector("span").textContent = mmss(quedan);
    relojEl.classList.toggle("poco", quedan <= 300);
    if (quedan === 0) entregar(true);
  };
  const temporizador = setInterval(tic, 1000);

  const entregar = async (porTiempo = false) => {
    if (entregado) return;
    if (!porTiempo) {
      const enBlanco = orden.length - contar();
      const ok = await confirmar("Entregar el test",
        enBlanco ? `${enBlanco === 1 ? "Te queda <strong>1 pregunta sin contestar</strong>, que contará" : `Te quedan <strong>${enBlanco} preguntas sin contestar</strong>, que contarán`} en blanco. ¿Quieres entregar ya?` : "Has contestado todas las preguntas. ¿Entregamos?",
        { boton: "Entregar" });
      if (!ok || entregado) return;
    }
    entregado = true;
    clearInterval(temporizador);
    examen.activo = false;
    cont.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const segundos = Math.min(total, Math.round((Date.now() - inicio) / 1000));
    if (porTiempo) aviso("Se ha acabado el tiempo. Test entregado.");
    try {
      const intento = await entregarIntento(usuario, test, respuestas, segundos);
      pantallaResultado(cont, usuario, test, intento);
    } catch (err) {
      console.error(err);
      cont.insertAdjacentHTML("afterbegin", `<div class="msg visible">No se ha podido guardar el resultado: ${esc(traducirError(err))}</div>`);
    }
  };
  cont.querySelector("#entregar").onclick = () => entregar(false);
  cont.querySelector("#entregar2").onclick = () => entregar(false);

  // Si se navega a otra sección del campus, el intento se pierde.
  examen.salir = () => { clearInterval(temporizador); examen.activo = false; examen.salir = null; };
}

// =====================================================================
// RESULTADO Y REVISIÓN
// =====================================================================
async function pantallaResultado(cont, usuario, testOriginal, intento) {
  window.scrollTo(0, 0);
  let test = testOriginal;
  if (!test?.preguntas) {
    try { test = await leerTest(intento.testId); } catch { test = null; }
  }
  const t = intento;
  cont.innerHTML = `
    <button class="volver enlace-volver" id="volver">← Mis tests</button>
    <section class="tarjeta resultado ${t.aprobado ? "res-ok" : "res-ko"}">
      <div class="res-nota">
        <span class="res-etq">${t.aprobado ? "Aprobado" : "Suspenso"}</span>
        <strong>${fmtNota(t.nota)}</strong><span>sobre 10</span>
      </div>
      <div class="res-datos">
        <h1 class="titulo">${esc(t.testTitulo)}</h1>
        <div class="res-cifras">
          <div><b class="c-ok">${t.aciertos}</b><span>aciertos</span></div>
          <div><b class="c-ko">${t.errores}</b><span>errores</span></div>
          <div><b>${t.blancos}</b><span>en blanco</span></div>
          <div><b>${mmss(t.segundos || 0)}</b><span>tiempo</span></div>
        </div>
        <p class="fila-meta">Nota = (${t.aciertos} − ${t.errores} ÷ 2) × 10 ÷ ${t.total}${t.aciertos - t.errores / 2 < 0 ? " (mínimo 0)" : ""} · ${fechaCorta(t.fecha)}</p>
        <div class="fila-acciones izq">
          ${test?.estado === "publicado" ? '<button class="btn btn-oro btn-sm" id="repetir">Repetir test</button>' : ""}
          <button class="btn btn-borde btn-sm" id="otros">Volver a mis tests</button>
        </div>
      </div>
    </section>
    <div class="pestanas" role="tablist" id="filtros">
      <button class="pestana activa" data-f="todas">Todas (${t.total})</button>
      <button class="pestana" data-f="falladas">Falladas (${t.errores})</button>
      <button class="pestana" data-f="blanco">En blanco (${t.blancos})</button>
      <button class="pestana" data-f="acertadas">Acertadas (${t.aciertos})</button>
    </div>
    <div id="revision"></div>`;

  cont.querySelector("#volver").onclick = () => vistaMisTests(cont, usuario);
  cont.querySelector("#otros").onclick = () => vistaMisTests(cont, usuario);
  cont.querySelector("#repetir")?.addEventListener("click", () => pantallaPrevia(cont, usuario, test));

  const rev = cont.querySelector("#revision");
  if (!test?.preguntas) {
    rev.innerHTML = `<p class="nota nota-izq">Este test ya no está disponible, así que no se puede revisar pregunta a pregunta.</p>`;
    return;
  }
  const estadoDe = (p) => {
    const r = t.respuestas?.[p.id];
    if (r === undefined || r === -1) return "blanco";
    return r === p.correcta ? "acertadas" : "falladas";
  };
  const pintar = (f) => {
    const ps = test.preguntas.filter((p) => t.respuestas && p.id in t.respuestas && (f === "todas" || estadoDe(p) === f));
    rev.innerHTML = ps.length ? `<ol class="examen revision">${ps.map((p) => {
      const r = t.respuestas[p.id];
      const est = estadoDe(p);
      return `
      <li class="ex-preg rev-${est}">
        <p class="ex-enun"><span class="num-tema">${test.preguntas.indexOf(p) + 1}</span>${esc(p.enunciado)}
          <span class="chip ${est === "acertadas" ? "chip-ok" : est === "falladas" ? "chip-rojo" : "chip-suave"}">${est === "acertadas" ? "Acierto" : est === "falladas" ? "Error" : "En blanco"}</span></p>
        <ol class="opciones">${p.opciones.map((o, i) => `
          <li class="${i === p.correcta ? "correcta" : i === r ? "elegida-mal" : ""}"><b>${LETRAS[i]})</b><span>${esc(o)}</span>
            ${i === p.correcta ? `<em>${icono("check")} Correcta</em>` : i === r ? "<em class=\"mal\">Tu respuesta</em>" : ""}</li>`).join("")}
        </ol>
        <div class="explicacion"><strong>Explicación</strong><p>${esc(p.explicacion || "")}</p></div>
      </li>`;
    }).join("")}</ol>` : `<p class="nota nota-izq">No hay preguntas en este apartado.</p>`;
  };
  cont.querySelectorAll("#filtros .pestana").forEach((b) => (b.onclick = () => {
    cont.querySelectorAll("#filtros .pestana").forEach((x) => x.classList.toggle("activa", x === b));
    pintar(b.dataset.f);
  }));
  pintar("todas");
}
