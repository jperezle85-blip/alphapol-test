// Pantalla "Preguntas": banco de preguntas y temario.
import { esc, icono, mostrar, traducirError } from "./util.js";
import { aviso, modal, confirmar } from "./gestion.js";
import { BLOQUES, DIFICULTADES, LETRAS } from "./temario.js";
import {
  listarTemas, asegurarTemario, guardarTema, eliminarTema, TemaConPreguntas,
  listarPreguntas, leerRespuesta, guardarPregunta, eliminarPregunta,
} from "./banco-datos.js";

const POR_PAGINA = 50;
const normalizar = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mensajeError = (err) => (err instanceof TemaConPreguntas ? err.message : traducirError(err));

export async function vistaPreguntas(cont, ctx, pestana = "banco") {
  cont.innerHTML = `
    <div class="cab-seccion">
      <div><h1 class="titulo">Preguntas</h1><p class="intro">Banco de preguntas tipo test (3 opciones, una correcta) organizado por el temario oficial.</p></div>
      <button class="btn btn-oro btn-sm" id="nueva" ${pestana === "banco" ? "" : "hidden"}>+ Nueva pregunta</button>
      <button class="btn btn-oro btn-sm" id="nuevo-tema" ${pestana === "temario" ? "" : "hidden"}>+ Añadir tema</button>
    </div>
    <div class="pestanas" role="tablist">
      <button role="tab" class="pestana${pestana === "banco" ? " activa" : ""}" aria-selected="${pestana === "banco"}" data-p="banco">Banco de preguntas</button>
      <button role="tab" class="pestana${pestana === "temario" ? " activa" : ""}" aria-selected="${pestana === "temario"}" data-p="temario">Temario</button>
    </div>
    <div id="zona"><div class="spinner"></div></div>`;
  cont.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => vistaPreguntas(cont, ctx, b.dataset.p)));
  const zona = cont.querySelector("#zona");

  let temas, preguntas;
  try {
    await asegurarTemario();
    [temas, preguntas] = await Promise.all([listarTemas(), listarPreguntas()]);
  } catch (e) {
    console.error(e);
    zona.innerHTML = `<p class="nota nota-izq">No se han podido cargar los datos. ${esc(traducirError(e))}</p>`;
    return;
  }
  const recargar = (p = pestana) => vistaPreguntas(cont, ctx, p);

  if (pestana === "temario") {
    pintarTemario(zona, temas, preguntas, recargar);
    cont.querySelector("#nuevo-tema").onclick = () => formularioTema(null, temas, recargar);
  } else {
    pintarBanco(zona, temas, preguntas, recargar);
    cont.querySelector("#nueva").onclick = () => formularioPregunta(null, null, temas, () => recargar("banco"));
  }
}

// =====================================================================
// BANCO
// =====================================================================
function etiquetaTema(t) { return t ? `T${t.numero}` : "?"; }

function pintarBanco(zona, temas, preguntas, recargar) {
  const temaPorId = Object.fromEntries(temas.map((t) => [t.id, t]));
  const opcionesTema = (bloque) => temas
    .filter((t) => !bloque || t.bloque === bloque)
    .map((t) => `<option value="${esc(t.id)}">Tema ${t.numero}. ${esc(t.titulo)}</option>`).join("");

  zona.innerHTML = `
    <div class="herramientas">
      <input type="search" id="b-buscar" placeholder="Buscar en enunciados y respuestas" aria-label="Buscar pregunta">
      <select id="b-bloque" aria-label="Bloque"><option value="">Todos los bloques</option>${Object.entries(BLOQUES).map(([k, v]) => `<option value="${k}">${k}) ${esc(v)}</option>`).join("")}</select>
      <select id="b-tema" aria-label="Tema"><option value="">Todos los temas</option>${opcionesTema("")}</select>
      <select id="b-dif" aria-label="Dificultad"><option value="">Cualquier dificultad</option>${Object.entries(DIFICULTADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    </div>
    <div id="b-lista"></div>`;

  const $ = (s) => zona.querySelector(s);
  const lista = $("#b-lista");
  let limite = POR_PAGINA;

  const filtradas = () => {
    const q = normalizar($("#b-buscar").value.trim());
    const bloque = $("#b-bloque").value, tema = $("#b-tema").value, dif = $("#b-dif").value;
    return preguntas.filter((p) => {
      if (dif && p.dificultad !== dif) return false;
      if (tema && !(p.temas || []).includes(tema)) return false;
      if (bloque && !(p.temas || []).some((id) => temaPorId[id]?.bloque === bloque)) return false;
      return !q || normalizar([p.enunciado, ...(p.opciones || [])].join(" ")).includes(q);
    });
  };

  const pintar = () => {
    if (!preguntas.length) {
      lista.innerHTML = `<div class="vacio-tarjeta">${icono("preguntas")}<p>El banco está vacío. Crea la primera pregunta con «Nueva pregunta».</p><p class="nota">En el paso 6 podrás importarlas desde Excel.</p></div>`;
      return;
    }
    const vis = filtradas();
    lista.innerHTML = `<p class="contador">${vis.length} de ${preguntas.length} preguntas</p>
      <div class="filas">${vis.slice(0, limite).map((p) => `
        <article class="preg" data-id="${esc(p.id)}">
          <button class="preg-cab" aria-expanded="false">
            <span class="preg-texto">${esc(p.enunciado)}</span>
            <span class="chips">
              ${(p.temas || []).map((id) => `<span class="chip chip-suave" title="${esc(temaPorId[id] ? `Tema ${temaPorId[id].numero}. ${temaPorId[id].titulo}` : "Tema eliminado")}">${etiquetaTema(temaPorId[id])}</span>`).join("")}
              <span class="chip dif-${esc(p.dificultad)}">${DIFICULTADES[p.dificultad] || "—"}</span>
            </span>
          </button>
          <div class="preg-detalle" hidden></div>
        </article>`).join("") || `<p class="nota nota-izq">Ninguna pregunta coincide con los filtros.</p>`}</div>
      ${vis.length > limite ? `<button class="btn btn-borde mas" id="b-mas">Mostrar ${Math.min(POR_PAGINA, vis.length - limite)} más</button>` : ""}`;

    $("#b-mas")?.addEventListener("click", () => { limite += POR_PAGINA; pintar(); });
    lista.querySelectorAll(".preg").forEach((art) => {
      const p = preguntas.find((x) => x.id === art.dataset.id);
      const cab = art.querySelector(".preg-cab");
      const det = art.querySelector(".preg-detalle");
      cab.onclick = async () => {
        const abrir = det.hidden;
        det.hidden = !abrir;
        cab.setAttribute("aria-expanded", String(abrir));
        if (!abrir || det.dataset.cargado) return;
        det.innerHTML = `<div class="spinner"></div>`;
        try {
          const r = await leerRespuesta(p.id);
          det.dataset.cargado = "1";
          det.innerHTML = `
            <ol class="opciones">${(p.opciones || []).map((o, i) => `
              <li class="${r?.correcta === i ? "correcta" : ""}"><b>${LETRAS[i]})</b> <span>${esc(o)}</span>${r?.correcta === i ? `<em>${icono("check")} Correcta</em>` : ""}</li>`).join("")}
            </ol>
            <div class="explicacion"><strong>Explicación</strong><p>${esc(r?.explicacion || "Sin explicación.")}</p></div>
            <div class="fila-acciones">
              <button class="btn btn-peligro-borde btn-sm" data-a="borrar">Eliminar</button>
              <button class="btn btn-borde btn-sm" data-a="editar">Editar</button>
            </div>`;
          det.querySelector('[data-a="editar"]').onclick = () => formularioPregunta(p, r, temas, () => recargar("banco"));
          det.querySelector('[data-a="borrar"]').onclick = async () => {
            const ok = await confirmar("Eliminar pregunta",
              `Se borrará esta pregunta y su respuesta. Si está en algún test, también se quitará de él.<br><br><em>«${esc(p.enunciado.slice(0, 160))}${p.enunciado.length > 160 ? "…" : ""}»</em>`,
              { boton: "Eliminar pregunta", peligro: true });
            if (!ok) return;
            try { await eliminarPregunta(p.id); aviso("Pregunta eliminada."); recargar("banco"); }
            catch (err) { aviso(mensajeError(err), false); }
          };
        } catch (err) {
          det.innerHTML = `<p class="nota nota-izq">${esc(traducirError(err))}</p>`;
        }
      };
    });
  };

  $("#b-buscar").oninput = () => { limite = POR_PAGINA; pintar(); };
  $("#b-dif").onchange = () => { limite = POR_PAGINA; pintar(); };
  $("#b-tema").onchange = () => { limite = POR_PAGINA; pintar(); };
  $("#b-bloque").onchange = () => {
    $("#b-tema").innerHTML = `<option value="">Todos los temas</option>${opcionesTema($("#b-bloque").value)}`;
    limite = POR_PAGINA; pintar();
  };
  pintar();
}

function formularioPregunta(p, r, temas, alTerminar) {
  const marcados = new Set(p?.temas || []);
  const bloquesHtml = Object.entries(BLOQUES).map(([k, v]) => `
    <div class="temas-bloque" data-bloque="${k}">
      <p class="temas-bloque-tit">${k}) ${esc(v)}</p>
      ${temas.filter((t) => t.bloque === k).map((t) => `
        <label class="check tema-op" data-texto="${esc(normalizar(`${t.numero} ${t.titulo}`))}"><input type="checkbox" name="tema" value="${esc(t.id)}"${marcados.has(t.id) ? " checked" : ""}><span><b>${t.numero}.</b> ${esc(t.titulo)}</span></label>`).join("")}
    </div>`).join("");

  const m = modal(p ? "Editar pregunta" : "Nueva pregunta", `
    <form class="form" id="f-preg" novalidate>
      <label>Enunciado<textarea id="q-enun" rows="3" maxlength="1000" required placeholder="Escribe la pregunta…">${esc(p?.enunciado || "")}</textarea></label>
      <fieldset class="casillas opciones-form">
        <legend>Opciones · marca la correcta</legend>
        ${LETRAS.map((l, i) => `
          <div class="opcion-fila">
            <input type="radio" name="correcta" id="q-c${i}" value="${i}"${r?.correcta === i ? " checked" : ""} aria-label="La opción ${l} es la correcta">
            <label for="q-c${i}" class="letra-op">${l})</label>
            <input id="q-o${i}" maxlength="500" required value="${esc(p?.opciones?.[i] || "")}" aria-label="Opción ${l}">
          </div>`).join("")}
      </fieldset>
      <label>Explicación de la respuesta correcta<textarea id="q-exp" rows="3" maxlength="2000" required placeholder="Por qué es correcta (artículo, norma…)">${esc(r?.explicacion || "")}</textarea></label>
      <fieldset class="casillas">
        <legend>Dificultad</legend>
        <div class="segmentos">${Object.entries(DIFICULTADES).map(([k, v]) => `
          <label class="segmento"><input type="radio" name="dif" value="${k}"${(p?.dificultad || "media") === k ? " checked" : ""}><span>${v}</span></label>`).join("")}
        </div>
      </fieldset>
      <fieldset class="casillas">
        <legend>Temas · <span id="q-ntemas">${marcados.size}</span> seleccionados</legend>
        <input type="search" id="q-filtro-tema" placeholder="Filtrar temas (número o título)" aria-label="Filtrar temas">
        <div class="temas-lista">${bloquesHtml}</div>
      </fieldset>
      <div class="msg" id="q-msg" role="alert"></div>
      <div class="modal-acciones"><button type="submit" class="btn btn-oro" id="q-btn">${p ? "Guardar cambios" : "Crear pregunta"}</button></div>
    </form>`, { ancho: 760 });

  const f = m.el.querySelector("#f-preg");
  const msg = m.el.querySelector("#q-msg");
  const contar = () => { f.querySelector("#q-ntemas").textContent = f.querySelectorAll('input[name="tema"]:checked').length; };
  f.querySelectorAll('input[name="tema"]').forEach((c) => (c.onchange = contar));
  f.querySelector("#q-filtro-tema").oninput = (e) => {
    const q = normalizar(e.target.value.trim());
    f.querySelectorAll(".tema-op").forEach((l) => (l.hidden = q && !l.dataset.texto.includes(q)));
    f.querySelectorAll(".temas-bloque").forEach((b) => (b.hidden = ![...b.querySelectorAll(".tema-op")].some((l) => !l.hidden)));
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const enunciado = f.querySelector("#q-enun").value.trim();
    const opciones = LETRAS.map((_, i) => f.querySelector(`#q-o${i}`).value.trim());
    const correctaEl = f.querySelector('input[name="correcta"]:checked');
    const explicacion = f.querySelector("#q-exp").value.trim();
    const dificultad = f.querySelector('input[name="dif"]:checked')?.value;
    const temasSel = [...f.querySelectorAll('input[name="tema"]:checked')].map((c) => c.value);
    if (!enunciado) return mostrar(msg, "Escribe el enunciado.");
    if (opciones.some((o) => !o)) return mostrar(msg, "Rellena las tres opciones.");
    if (new Set(opciones.map(normalizar)).size < 3) return mostrar(msg, "Las tres opciones deben ser distintas.");
    if (!correctaEl) return mostrar(msg, "Marca cuál es la opción correcta.");
    if (!explicacion) return mostrar(msg, "La explicación es obligatoria.");
    if (!temasSel.length) return mostrar(msg, "Asigna al menos un tema.");
    const btn = f.querySelector("#q-btn"); btn.disabled = true;
    try {
      await guardarPregunta(p?.id, { enunciado, opciones, temas: temasSel, dificultad, correcta: Number(correctaEl.value), explicacion });
      m.cerrar(); aviso(p ? "Pregunta actualizada." : "Pregunta creada."); alTerminar();
    } catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
  };
}

// =====================================================================
// TEMARIO
// =====================================================================
function pintarTemario(zona, temas, preguntas, recargar) {
  const cuenta = (id) => preguntas.filter((p) => (p.temas || []).includes(id)).length;
  zona.innerHTML = `
    <p class="nota nota-izq">Temario oficial de la Escala Básica (convocatoria 2026). Puedes corregir títulos o añadir temas si cambia la convocatoria.</p>
    ${Object.entries(BLOQUES).map(([k, v]) => {
      const ts = temas.filter((t) => t.bloque === k);
      return `
      <section class="bloque-temario">
        <h2 class="seccion-tit">${k}) ${esc(v)} <span class="fila-meta">· ${ts.length} temas</span></h2>
        <div class="filas">${ts.map((t) => {
          const n = cuenta(t.id);
          return `
          <article class="fila fila-tema" data-id="${esc(t.id)}">
            <div class="fila-info"><strong><span class="num-tema">${t.numero}</span>${esc(t.titulo)}</strong></div>
            <div class="fila-lado fila-lado-h">
              <span class="fila-meta">${n} ${n === 1 ? "pregunta" : "preguntas"}</span>
              <button class="btn btn-borde btn-sm" data-a="editar">Editar</button>
              ${n ? "" : `<button class="btn btn-peligro-borde btn-sm" data-a="borrar">Eliminar</button>`}
            </div>
          </article>`;
        }).join("") || `<p class="nota nota-izq">Sin temas en este bloque.</p>`}</div>
      </section>`;
    }).join("")}`;

  zona.querySelectorAll(".fila-tema").forEach((el) => {
    const t = temas.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-a="editar"]').onclick = () => formularioTema(t, temas, () => recargar("temario"));
    el.querySelector('[data-a="borrar"]')?.addEventListener("click", async () => {
      const ok = await confirmar("Eliminar tema", `Se eliminará el tema <strong>${t.numero}. ${esc(t.titulo)}</strong>.`, { boton: "Eliminar tema", peligro: true });
      if (!ok) return;
      try { await eliminarTema(t.id); aviso("Tema eliminado."); recargar("temario"); }
      catch (err) { aviso(mensajeError(err), false); }
    });
  });
}

function formularioTema(t, temas, alTerminar) {
  const siguiente = Math.max(0, ...temas.map((x) => x.numero || 0)) + 1;
  const m = modal(t ? "Editar tema" : "Añadir tema", `
    <form class="form" id="f-tema" novalidate>
      <div class="dos-col">
        <label>Número<input id="t-num" type="number" min="1" step="1" required value="${t?.numero ?? siguiente}"></label>
        <label>Bloque<select id="t-bloque">${Object.entries(BLOQUES).map(([k, v]) => `<option value="${k}"${(t?.bloque || "A") === k ? " selected" : ""}>${k}) ${esc(v)}</option>`).join("")}</select></label>
      </div>
      <label>Título<input id="t-tit" maxlength="200" required value="${esc(t?.titulo || "")}"></label>
      <div class="msg" id="t-msg" role="alert"></div>
      <div class="modal-acciones"><button type="submit" class="btn btn-oro" id="t-btn">${t ? "Guardar cambios" : "Añadir tema"}</button></div>
    </form>`);
  const f = m.el.querySelector("#f-tema");
  const msg = m.el.querySelector("#t-msg");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const numero = Number(f.querySelector("#t-num").value);
    const bloque = f.querySelector("#t-bloque").value;
    const titulo = f.querySelector("#t-tit").value.trim();
    if (!Number.isInteger(numero) || numero < 1) return mostrar(msg, "El número de tema debe ser un entero positivo.");
    if (!titulo) return mostrar(msg, "Escribe el título del tema.");
    if (temas.some((x) => x.numero === numero && x.id !== t?.id)) return mostrar(msg, `Ya existe un tema con el número ${numero}.`);
    const btn = f.querySelector("#t-btn"); btn.disabled = true;
    try { await guardarTema(t?.id, { numero, bloque, titulo }); m.cerrar(); aviso(t ? "Tema actualizado." : "Tema añadido."); alTerminar(); }
    catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
  };
}
