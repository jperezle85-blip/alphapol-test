// Pantalla "Tests" del profesor: lista, creación (al azar + retoques), borrador / publicación.
import { esc, icono, mostrar, traducirError } from "./util.js";
import { aviso, modal, confirmar } from "./gestion.js";
import { listarCursos } from "./datos.js";
import { BLOQUES } from "./temario.js";
import { listarTemas, asegurarTemario, listarPreguntas } from "./banco-datos.js";
import {
  TIPOS, PREGUNTAS_POR_DEFECTO, duracionTest, formatoDuracion, barajar,
  listarTests, candidatas, copiarPreguntas, guardarTest, cambiarEstado, eliminarTest,
} from "./tests-datos.js";

const normalizar = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function criterioTexto(t, temaPorId) {
  if (t.tipo === "bloque") return `Bloque ${t.bloque}) ${BLOQUES[t.bloque] || ""}`;
  if (t.tipo === "tema") { const x = temaPorId[t.temaId]; return x ? `Tema ${x.numero}. ${x.titulo}` : "Tema eliminado"; }
  return "Todo el temario";
}

export async function vistaTestsProfesor(cont, ctx) {
  cont.innerHTML = `
    <div class="cab-seccion">
      <div><h1 class="titulo">Tests</h1><p class="intro">Tests cerrados que hacen los alumnos de las promociones asignadas. Un test en borrador no lo ve ningún alumno.</p></div>
      <button class="btn btn-oro btn-sm" id="nuevo">+ Nuevo test</button>
    </div>
    <div id="lista"><div class="spinner"></div></div>`;
  const lista = cont.querySelector("#lista");
  let tests, cursos, temas, preguntas;
  try {
    await asegurarTemario();
    [tests, cursos, temas, preguntas] = await Promise.all([listarTests(), listarCursos(), listarTemas(), listarPreguntas()]);
  } catch (e) {
    console.error(e);
    lista.innerHTML = `<p class="nota nota-izq">No se han podido cargar los tests. ${esc(traducirError(e))}</p>`;
    return;
  }
  const datos = { cursos, temas, preguntas };
  const temaPorId = Object.fromEntries(temas.map((t) => [t.id, t]));
  const nombreCurso = Object.fromEntries(cursos.map((c) => [c.id, c.nombre]));
  const recargar = () => vistaTestsProfesor(cont, ctx);
  cont.querySelector("#nuevo").onclick = () => editorTest(cont, null, datos, recargar);

  if (!tests.length) {
    lista.innerHTML = `<div class="vacio-tarjeta">${icono("tests")}<p>Aún no hay tests. Crea el primero con «Nuevo test».</p></div>`;
    return;
  }
  lista.innerHTML = `<div class="filas">${tests.map((t) => {
    const n = (t.preguntas || []).length;
    const promos = (t.cursos || []).filter((c) => nombreCurso[c]).map((c) => `<span class="chip">${esc(nombreCurso[c])}</span>`).join("")
      || `<span class="chip chip-suave">Sin promoción</span>`;
    return `
    <article class="fila" data-id="${esc(t.id)}">
      <div class="fila-info">
        <strong>${esc(t.titulo)} ${t.estado === "publicado" ? '<span class="chip chip-ok">Publicado</span>' : '<span class="chip chip-suave">Borrador</span>'}</strong>
        <span>${TIPOS[t.tipo] || ""} · ${esc(criterioTexto(t, temaPorId))}</span>
        <span class="fila-meta">${n} ${n === 1 ? "pregunta" : "preguntas"} · ${formatoDuracion(duracionTest(n))}</span>
        <div class="chips">${promos}</div>
      </div>
      <div class="fila-acciones">
        <button class="btn btn-peligro-borde btn-sm" data-a="borrar">Eliminar</button>
        <button class="btn btn-borde btn-sm" data-a="estado">${t.estado === "publicado" ? "Pasar a borrador" : "Publicar"}</button>
        <button class="btn btn-oro btn-sm" data-a="editar">Editar</button>
      </div>
    </article>`;
  }).join("")}</div>`;

  lista.querySelectorAll(".fila").forEach((el) => {
    const t = tests.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-a="editar"]').onclick = () => editorTest(cont, t, datos, recargar);
    el.querySelector('[data-a="estado"]').onclick = async () => {
      const publicar = t.estado !== "publicado";
      if (publicar && !(t.cursos || []).length) return aviso("Asigna al menos una promoción antes de publicar (botón Editar).", false);
      if (publicar && !(t.preguntas || []).length) return aviso("El test no tiene preguntas.", false);
      try { await cambiarEstado(t, publicar ? "publicado" : "borrador"); aviso(publicar ? "Test publicado. Ya lo ven los alumnos de sus promociones." : "Test pasado a borrador. Los alumnos ya no lo ven."); recargar(); }
      catch (err) { aviso(traducirError(err), false); }
    };
    el.querySelector('[data-a="borrar"]').onclick = async () => {
      const ok = await confirmar("Eliminar test",
        `Se eliminará <strong>«${esc(t.titulo)}»</strong> y dejará de estar disponible para los alumnos. Las notas que ya hayan sacado se conservan en sus estadísticas.`,
        { boton: "Eliminar test", peligro: true });
      if (!ok) return;
      try { await eliminarTest(t); aviso("Test eliminado."); recargar(); }
      catch (err) { aviso(traducirError(err), false); }
    };
  });
}

// =====================================================================
// EDITOR
// =====================================================================
function editorTest(cont, test, { cursos, temas, preguntas }, alTerminar) {
  const temaPorId = Object.fromEntries(temas.map((t) => [t.id, t]));
  const bancoPorId = Object.fromEntries(preguntas.map((p) => [p.id, p]));
  // Estado del editor
  const st = {
    titulo: test?.titulo || "",
    tipo: test?.tipo || "general",
    bloque: test?.bloque || "A",
    temaId: test?.temaId || temas[0]?.id || "",
    numero: PREGUNTAS_POR_DEFECTO,
    cursos: new Set(test?.cursos || []),
    // Preguntas elegidas: las del banco cuando existen; si no, la copia guardada en el test.
    seleccion: (test?.preguntas || []).map((q) => bancoPorId[q.id] || q),
  };
  const candidatasActuales = () => candidatas(preguntas, temas, st);

  cont.innerHTML = `
    <button class="volver enlace-volver" id="volver">← Volver a la lista de tests</button>
    <h1 class="titulo">${test ? "Editar test" : "Nuevo test"}</h1>
    <section class="tarjeta editor-bloque">
      <h2 class="seccion-tit">1. Datos del test</h2>
      <div class="form">
        <label>Título<input id="e-titulo" maxlength="150" value="${esc(st.titulo)}" placeholder="Ej.: Simulacro general nº 3 · Test del tema 14"></label>
        <fieldset class="casillas">
          <legend>Tipo de test</legend>
          <div class="segmentos">${Object.entries(TIPOS).map(([k, v]) => `
            <label class="segmento"><input type="radio" name="tipo" value="${k}"${st.tipo === k ? " checked" : ""}><span>${v}</span></label>`).join("")}</div>
          <label id="e-bloque-l">Bloque<select id="e-bloque">${Object.entries(BLOQUES).map(([k, v]) => `<option value="${k}"${st.bloque === k ? " selected" : ""}>${k}) ${esc(v)}</option>`).join("")}</select></label>
          <label id="e-tema-l">Tema<select id="e-tema">${temas.map((t) => `<option value="${esc(t.id)}"${st.temaId === t.id ? " selected" : ""}>${t.numero}. ${esc(t.titulo)}</option>`).join("")}</select></label>
        </fieldset>
        <div class="fila-generar">
          <label>Número de preguntas<input id="e-num" type="number" min="1" step="1" value="${st.numero}"></label>
          <p class="nota nota-izq" id="e-disp"></p>
          <button class="btn btn-borde" id="e-generar">${icono("simulacro")} Generar al azar</button>
        </div>
        ${cursos.length ? `<fieldset class="casillas"><legend>Promociones que verán el test</legend>
          ${cursos.map((c) => `<label class="check"><input type="checkbox" name="e-curso" value="${esc(c.id)}"${st.cursos.has(c.id) ? " checked" : ""}><span>${esc(c.nombre)}</span></label>`).join("")}</fieldset>`
          : `<p class="nota nota-izq">No hay promociones. Créalas en «Promociones» para poder publicar el test.</p>`}
      </div>
    </section>
    <section class="tarjeta editor-bloque">
      <div class="cab-seccion"><h2 class="seccion-tit" id="e-ntit"></h2><button class="btn btn-borde btn-sm" id="e-anadir">+ Añadir pregunta</button></div>
      <div id="e-preguntas"></div>
    </section>
    <div class="barra-guardar">
      <span id="e-resumen" class="fila-meta"></span>
      <div class="msg" id="e-msg" role="alert"></div>
      <div class="fila-acciones">
        <button class="btn btn-borde" id="e-borrador">Guardar borrador</button>
        <button class="btn btn-oro" id="e-publicar">${test?.estado === "publicado" ? "Guardar (publicado)" : "Guardar y publicar"}</button>
      </div>
    </div>`;
  window.scrollTo(0, 0);
  const $ = (s) => cont.querySelector(s);
  const msg = $("#e-msg");

  const pintarCriterio = () => {
    $("#e-bloque-l").hidden = st.tipo !== "bloque";
    $("#e-tema-l").hidden = st.tipo !== "tema";
    const n = candidatasActuales().length;
    $("#e-disp").textContent = `${n} ${n === 1 ? "pregunta disponible" : "preguntas disponibles"} en el banco para este criterio.`;
  };

  const pintarPreguntas = () => {
    const n = st.seleccion.length;
    $("#e-ntit").textContent = `2. Preguntas (${n})`;
    $("#e-resumen").textContent = `${n} ${n === 1 ? "pregunta" : "preguntas"} · Duración ${formatoDuracion(duracionTest(n))}`;
    const cont2 = $("#e-preguntas");
    if (!n) {
      cont2.innerHTML = `<div class="vacio-tarjeta">${icono("preguntas")}<p>Elige el tipo y pulsa «Generar al azar», o añade preguntas una a una.</p></div>`;
      return;
    }
    cont2.innerHTML = `<ol class="lista-test">${st.seleccion.map((p, i) => `
      <li data-i="${i}">
        <span class="num-tema">${i + 1}</span>
        <div class="lt-texto"><span>${esc(p.enunciado)}</span>
          <span class="chips">${(p.temas || []).map((id) => `<span class="chip chip-suave">${temaPorId[id] ? "T" + temaPorId[id].numero : "?"}</span>`).join("")}${bancoPorId[p.id] ? "" : '<span class="chip chip-rojo">Ya no está en el banco</span>'}</span>
        </div>
        <div class="lt-acciones">
          <button class="btn-icono-txt" data-a="cambiar" title="Cambiar por otra al azar">Cambiar</button>
          <button class="btn-icono-txt peligro" data-a="quitar" title="Quitar del test">Quitar</button>
        </div>
      </li>`).join("")}</ol>`;
    cont2.querySelectorAll("li").forEach((li) => {
      const i = Number(li.dataset.i);
      li.querySelector('[data-a="quitar"]').onclick = () => { st.seleccion.splice(i, 1); pintarPreguntas(); };
      li.querySelector('[data-a="cambiar"]').onclick = () => {
        const usadas = new Set(st.seleccion.map((p) => p.id));
        const libres = candidatasActuales().filter((p) => !usadas.has(p.id));
        if (!libres.length) return aviso("No quedan más preguntas de este criterio en el banco.", false);
        st.seleccion[i] = libres[Math.floor(Math.random() * libres.length)];
        pintarPreguntas();
      };
    });
  };

  cont.querySelectorAll('input[name="tipo"]').forEach((r) => (r.onchange = () => { st.tipo = r.value; pintarCriterio(); }));
  $("#e-bloque").onchange = (e) => { st.bloque = e.target.value; pintarCriterio(); };
  $("#e-tema").onchange = (e) => { st.temaId = e.target.value; pintarCriterio(); };
  $("#volver").onclick = alTerminar;

  $("#e-generar").onclick = async () => {
    const n = Math.floor(Number($("#e-num").value));
    if (!Number.isFinite(n) || n < 1) return mostrar(msg, "Indica cuántas preguntas quieres (mínimo 1).");
    const disp = candidatasActuales();
    if (!disp.length) return mostrar(msg, "No hay preguntas en el banco para este criterio.");
    if (st.seleccion.length) {
      const ok = await confirmar("Generar de nuevo", "Se sustituirán las preguntas actuales del test por otras elegidas al azar.", { boton: "Generar" });
      if (!ok) return;
    }
    st.seleccion = barajar(disp).slice(0, n);
    msg.className = "msg";
    pintarPreguntas();
    if (disp.length < n) aviso(`Solo hay ${disp.length} preguntas para este criterio: el test tendrá ${disp.length} y durará ${formatoDuracion(duracionTest(disp.length))}.`);
  };

  $("#e-anadir").onclick = () => {
    const usadas = new Set(st.seleccion.map((p) => p.id));
    const m = modal("Añadir pregunta", `
      <div class="form">
        <label class="check"><input type="checkbox" id="a-todo"><span>Buscar en todo el banco (no solo en el criterio del test)</span></label>
        <input type="search" id="a-buscar" placeholder="Buscar por texto" aria-label="Buscar pregunta">
        <div id="a-res" class="anadir-lista"></div>
      </div>`, { ancho: 720 });
    const pintarRes = () => {
      const q = normalizar(m.el.querySelector("#a-buscar").value.trim());
      const base = m.el.querySelector("#a-todo").checked ? preguntas : candidatasActuales();
      const res = base.filter((p) => !usadas.has(p.id) && (!q || normalizar(p.enunciado).includes(q))).slice(0, 40);
      m.el.querySelector("#a-res").innerHTML = res.length ? res.map((p) => `
        <button class="anadir-item" data-id="${esc(p.id)}"><span>${esc(p.enunciado)}</span><b>+ Añadir</b></button>`).join("")
        : `<p class="nota nota-izq">No hay preguntas disponibles con esa búsqueda.</p>`;
      m.el.querySelectorAll(".anadir-item").forEach((b) => (b.onclick = () => {
        st.seleccion.push(bancoPorId[b.dataset.id]); usadas.add(b.dataset.id); pintarPreguntas(); b.remove();
        aviso("Pregunta añadida al final del test.");
      }));
    };
    m.el.querySelector("#a-buscar").oninput = pintarRes;
    m.el.querySelector("#a-todo").onchange = pintarRes;
    pintarRes();
  };

  const guardar = async (estado) => {
    const titulo = $("#e-titulo").value.trim();
    const cursosSel = [...cont.querySelectorAll('input[name="e-curso"]:checked')].map((c) => c.value);
    if (!titulo) return mostrar(msg, "Escribe un título para el test.");
    if (!st.seleccion.length) return mostrar(msg, "El test no tiene preguntas.");
    if (estado === "publicado" && !cursosSel.length) return mostrar(msg, "Para publicar, marca al menos una promoción.");
    cont.querySelectorAll(".barra-guardar button").forEach((b) => (b.disabled = true));
    try {
      // Copia de las preguntas con su respuesta: se reutiliza la del test si ya existía.
      const previas = Object.fromEntries((test?.preguntas || []).map((q) => [q.id, q]));
      const nuevas = st.seleccion.filter((p) => !previas[p.id]);
      const copiadas = Object.fromEntries((await copiarPreguntas(nuevas)).map((q) => [q.id, q]));
      const copia = st.seleccion.map((p) => previas[p.id] || copiadas[p.id]);
      await guardarTest(test?.id, { titulo, tipo: st.tipo, bloque: st.tipo === "bloque" ? st.bloque : null, temaId: st.tipo === "tema" ? st.temaId : null, preguntas: copia, cursos: cursosSel, estado }, test);
      aviso(estado === "publicado" ? "Test guardado y publicado." : "Test guardado como borrador.");
      alTerminar();
    } catch (err) {
      mostrar(msg, traducirError(err));
      cont.querySelectorAll(".barra-guardar button").forEach((b) => (b.disabled = false));
    }
  };
  $("#e-borrador").onclick = () => guardar("borrador");
  $("#e-publicar").onclick = () => guardar("publicado");

  pintarCriterio();
  pintarPreguntas();
}
