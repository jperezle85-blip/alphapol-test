// Pantallas de gestión del campus: Solicitudes, Alumnos, Promociones, Profesores y Mi cuenta.
import { esc, icono, mostrar, traducirError, formatoPrecio, EMAIL_RE } from "./util.js";
import {
  listarCursos, guardarCurso, eliminarCurso,
  listarSolicitudes, aprobarSolicitud, rechazarSolicitud,
  listarAlumnos, listarStaff, altaAlumno, altaProfesor, actualizarAlumno, cambiarActivo,
  reenviarEmailContrasena, nombreCompleto, ErrorAlta,
} from "./datos.js";

// ---------- Utilidades de interfaz ----------
const cargando = (cont) => { cont.innerHTML = `<div class="spinner"></div>`; };
const errorCarga = (cont, err) => {
  console.error(err);
  cont.innerHTML = `<p class="nota">No se han podido cargar los datos. ${esc(traducirError(err))}</p>`;
};
const mensajeError = (err) => (err instanceof ErrorAlta ? err.message : traducirError(err));

export function aviso(texto, ok = true) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast" + (ok ? "" : " toast-error");
  t.setAttribute("role", "status");
  t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

/** Abre una ventana modal. Devuelve { el, cerrar }. */
function modal(titulo, cuerpo, { ancho = 520 } = {}) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-tit" style="max-width:${ancho}px">
      <div class="modal-cab"><h2 id="modal-tit">${esc(titulo)}</h2><button class="btn-icono cerrar" aria-label="Cerrar">✕</button></div>
      <div class="modal-cuerpo">${cuerpo}</div>
    </div>`;
  document.body.appendChild(fondo);
  document.body.classList.add("con-modal");
  const cerrar = () => { fondo.remove(); document.body.classList.remove("con-modal"); document.removeEventListener("keydown", esc_); };
  const esc_ = (e) => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", esc_);
  fondo.querySelector(".cerrar").onclick = cerrar;
  fondo.addEventListener("mousedown", (e) => { if (e.target === fondo) cerrar(); });
  setTimeout(() => fondo.querySelector("input, textarea, button:not(.cerrar)")?.focus(), 30);
  return { el: fondo, cerrar };
}

function confirmar(titulo, texto, { boton = "Confirmar", peligro = false } = {}) {
  return new Promise((resolve) => {
    const m = modal(titulo, `
      <p class="modal-texto">${texto}</p>
      <div class="modal-acciones">
        <button class="btn btn-borde" data-r="no">Cancelar</button>
        <button class="btn ${peligro ? "btn-peligro" : "btn-oro"}" data-r="si">${esc(boton)}</button>
      </div>`);
    m.el.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { m.cerrar(); resolve(b.dataset.r === "si"); }));
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

function fecha(ts, conHora = false) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

function haceCuanto(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return "Nunca";
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  return fecha(ts);
}

function casillasCursos(cursos, marcados = []) {
  if (!cursos.length) return `<p class="nota">Aún no hay promociones. Créalas en la sección Promociones.</p>`;
  return `<fieldset class="casillas"><legend>Promociones</legend>
    ${cursos.map((c) => `<label class="check"><input type="checkbox" name="curso" value="${esc(c.id)}"${marcados.includes(c.id) ? " checked" : ""}><span>${esc(c.nombre)}</span></label>`).join("")}
  </fieldset>`;
}
const cursosMarcados = (el) => [...el.querySelectorAll('input[name="curso"]:checked')].map((i) => i.value);

// =====================================================================
// SOLICITUDES
// =====================================================================
export async function vistaSolicitudes(cont, ctx) {
  cont.innerHTML = `
    <h1 class="titulo">Solicitudes</h1>
    <p class="intro">Solicitudes de inscripción enviadas desde la web. Al aprobar, se crea la cuenta del alumno (o se le añade el curso si ya la tenía) y le llega un email para crear su contraseña.</p>
    <div id="lista"></div>`;
  const lista = cont.querySelector("#lista");
  cargando(lista);
  let sols;
  try { sols = await listarSolicitudes(); } catch (e) { return errorCarga(lista, e); }
  if (!sols.length) {
    lista.innerHTML = `<div class="vacio-tarjeta">${icono("solicitud")}<p>No hay solicitudes pendientes.</p></div>`;
    return;
  }
  lista.innerHTML = `<div class="filas">${sols.map((s) => `
    <article class="fila" data-id="${esc(s.id)}">
      <div class="fila-info">
        <strong>${esc(nombreCompleto(s))}</strong>
        <span>${esc(s.email)}${s.uid ? ' · <em class="chip chip-suave">Ya tiene cuenta</em>' : ""}</span>
        <span class="fila-meta">${esc(s.cursoNombre)} · ${fecha(s.creado, true)}</span>
      </div>
      <div class="fila-acciones">
        <button class="btn btn-borde btn-sm" data-accion="rechazar">Rechazar</button>
        <button class="btn btn-oro btn-sm" data-accion="aprobar">Aprobar</button>
      </div>
    </article>`).join("")}</div>`;

  lista.querySelectorAll(".fila").forEach((fila) => {
    const sol = sols.find((s) => s.id === fila.dataset.id);
    fila.querySelector('[data-accion="aprobar"]').onclick = async (e) => {
      fila.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const r = await aprobarSolicitud(sol);
        aviso(r.nueva
          ? `Aprobada. Se ha creado la cuenta y se ha enviado el email a ${sol.email}.`
          : `Aprobada. Se ha añadido «${sol.cursoNombre}» a la cuenta de ${sol.email}.`);
        vistaSolicitudes(cont, ctx);
      } catch (err) {
        aviso(mensajeError(err), false);
        fila.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
    fila.querySelector('[data-accion="rechazar"]').onclick = async () => {
      const ok = await confirmar("Rechazar solicitud",
        `Se eliminará la solicitud de <strong>${esc(nombreCompleto(sol))}</strong> para «${esc(sol.cursoNombre)}». No se le enviará ningún aviso.`,
        { boton: "Rechazar", peligro: true });
      if (!ok) return;
      try { await rechazarSolicitud(sol.id); aviso("Solicitud rechazada."); vistaSolicitudes(cont, ctx); }
      catch (err) { aviso(mensajeError(err), false); }
    };
  });
}

// =====================================================================
// ALUMNOS
// =====================================================================
export async function vistaAlumnos(cont, ctx) {
  cont.innerHTML = `
    <div class="cab-seccion">
      <div><h1 class="titulo">Alumnos</h1><p class="intro">Alta de alumnos, promociones en las que están inscritos y acceso a su cuenta.</p></div>
      <button class="btn btn-oro btn-sm" id="nuevo">+ Alta de alumno</button>
    </div>
    <div class="herramientas">
      <input type="search" id="buscar" placeholder="Buscar por nombre o email" aria-label="Buscar alumno">
      <select id="filtro" aria-label="Filtrar por promoción"><option value="">Todas las promociones</option></select>
    </div>
    <div id="lista"></div>`;
  const lista = cont.querySelector("#lista");
  cargando(lista);
  let alumnos, cursos;
  try { [alumnos, cursos] = await Promise.all([listarAlumnos(), listarCursos()]); } catch (e) { return errorCarga(lista, e); }

  const nombreCurso = Object.fromEntries(cursos.map((c) => [c.id, c.nombre]));
  const filtro = cont.querySelector("#filtro");
  filtro.innerHTML += cursos.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("") + `<option value="__ninguna">Sin promoción</option>`;
  const buscar = cont.querySelector("#buscar");

  const pintar = () => {
    const q = buscar.value.trim().toLowerCase();
    const f = filtro.value;
    const vis = alumnos.filter((a) => {
      const enCursos = (a.cursos || []).filter((id) => nombreCurso[id]);
      if (f === "__ninguna" && enCursos.length) return false;
      if (f && f !== "__ninguna" && !enCursos.includes(f)) return false;
      return !q || nombreCompleto(a).toLowerCase().includes(q) || (a.email || "").includes(q);
    });
    if (!alumnos.length) {
      lista.innerHTML = `<div class="vacio-tarjeta">${icono("alumnos")}<p>Aún no hay alumnos. Aparecerán al aprobar solicitudes o al darlos de alta.</p></div>`;
      return;
    }
    lista.innerHTML = `<p class="contador">${vis.length} de ${alumnos.length} alumnos</p>
      <div class="filas">${vis.map((a) => {
        const chips = (a.cursos || []).filter((id) => nombreCurso[id]).map((id) => `<span class="chip">${esc(nombreCurso[id])}</span>`).join("")
          || `<span class="chip chip-suave">Sin promoción</span>`;
        return `
        <article class="fila${a.activo === false ? " fila-off" : ""}">
          <div class="fila-info">
            <strong>${esc(nombreCompleto(a))}${a.activo === false ? ' <span class="chip chip-rojo">Desactivado</span>' : ""}</strong>
            <span>${esc(a.email)}</span>
            <div class="chips">${chips}</div>
          </div>
          <div class="fila-lado">
            <span class="fila-meta">Último acceso: ${haceCuanto(a.ultimoAcceso)}</span>
            <button class="btn btn-borde btn-sm" data-uid="${esc(a.id)}">Gestionar</button>
          </div>
        </article>`;
      }).join("") || `<p class="nota">Ningún alumno coincide con la búsqueda.</p>`}</div>`;
    lista.querySelectorAll("[data-uid]").forEach((b) => {
      b.onclick = () => gestionarAlumno(alumnos.find((a) => a.id === b.dataset.uid), cursos, () => vistaAlumnos(cont, ctx));
    });
  };
  buscar.oninput = pintar;
  filtro.onchange = pintar;
  pintar();

  cont.querySelector("#nuevo").onclick = () => formularioAlta(cursos, () => vistaAlumnos(cont, ctx));
}

function formularioAlta(cursos, alTerminar) {
  const m = modal("Alta de alumno", `
    <form class="form" id="f-alta" novalidate>
      <div class="dos-col">
        <label>Nombre<input id="a-nombre" maxlength="60" required></label>
        <label>Apellidos<input id="a-apellidos" maxlength="80" required></label>
      </div>
      <label>Email<input id="a-email" type="email" maxlength="120" required placeholder="alumno@email.com"></label>
      ${casillasCursos(cursos)}
      <p class="nota">Le llegará un email para crear su contraseña. Si ya tiene cuenta, solo se le añadirán las promociones marcadas.</p>
      <div class="msg" id="a-msg" role="alert"></div>
      <div class="modal-acciones"><button type="submit" class="btn btn-oro" id="a-btn">Dar de alta</button></div>
    </form>`);
  const f = m.el.querySelector("#f-alta");
  const msg = m.el.querySelector("#a-msg");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const nombre = f.querySelector("#a-nombre").value.trim();
    const apellidos = f.querySelector("#a-apellidos").value.trim();
    const email = f.querySelector("#a-email").value.trim().toLowerCase();
    if (!nombre || !apellidos || !email) return mostrar(msg, "Rellena nombre, apellidos y email.");
    if (!EMAIL_RE.test(email)) return mostrar(msg, "El email no tiene un formato válido.");
    const btn = f.querySelector("#a-btn"); btn.disabled = true;
    try {
      const r = await altaAlumno({ nombre, apellidos, email, cursos: cursosMarcados(f) });
      m.cerrar();
      aviso(r.nueva ? `Alumno dado de alta. Se ha enviado el email a ${email}.` : `${email} ya tenía cuenta: se le han añadido las promociones.`);
      alTerminar();
    } catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
  };
}

function gestionarAlumno(a, cursos, alTerminar) {
  const m = modal("Gestionar alumno", `
    <form class="form" id="f-gest" novalidate>
      <div class="dos-col">
        <label>Nombre<input id="g-nombre" maxlength="60" value="${esc(a.nombre || "")}" required></label>
        <label>Apellidos<input id="g-apellidos" maxlength="80" value="${esc(a.apellidos || "")}" required></label>
      </div>
      <label>Email<input value="${esc(a.email)}" disabled></label>
      <p class="nota nota-izq">El email solo se puede cambiar desde la consola de Firebase.</p>
      ${casillasCursos(cursos, a.cursos || [])}
      <label class="check interruptor"><input type="checkbox" id="g-activo"${a.activo === false ? "" : " checked"}><span><strong>Cuenta activa</strong> · si la desactivas, no podrá entrar al campus.</span></label>
      <p class="fila-meta">Alta: ${fecha(a.creado)} · Último acceso: ${haceCuanto(a.ultimoAcceso)}</p>
      <div class="msg" id="g-msg" role="alert"></div>
      <div class="modal-acciones">
        <button type="button" class="btn btn-borde" id="g-email">Reenviar email de contraseña</button>
        <button type="submit" class="btn btn-oro" id="g-btn">Guardar cambios</button>
      </div>
    </form>`);
  const f = m.el.querySelector("#f-gest");
  const msg = m.el.querySelector("#g-msg");
  f.querySelector("#g-email").onclick = async (e) => {
    e.target.disabled = true;
    try { await reenviarEmailContrasena(a.email); mostrar(msg, `Email enviado a ${a.email}.`, true); }
    catch (err) { mostrar(msg, mensajeError(err)); }
    e.target.disabled = false;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const nombre = f.querySelector("#g-nombre").value.trim();
    const apellidos = f.querySelector("#g-apellidos").value.trim();
    if (!nombre || !apellidos) return mostrar(msg, "Nombre y apellidos no pueden quedar vacíos.");
    const btn = f.querySelector("#g-btn"); btn.disabled = true;
    try {
      // Conserva cursos ya eliminados que no aparecen en la lista (no debería haber, pero por seguridad).
      const idsValidos = new Set(cursos.map((c) => c.id));
      const otros = (a.cursos || []).filter((id) => !idsValidos.has(id));
      await actualizarAlumno(a.id, { nombre, apellidos, cursos: [...otros, ...cursosMarcados(f)], activo: f.querySelector("#g-activo").checked });
      m.cerrar(); aviso("Cambios guardados."); alTerminar();
    } catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
  };
}

// =====================================================================
// PROMOCIONES
// =====================================================================
export async function vistaPromociones(cont, ctx) {
  cont.innerHTML = `
    <div class="cab-seccion">
      <div><h1 class="titulo">Promociones</h1><p class="intro">Los cursos que aparecen en la web pública. Los alumnos solicitan inscribirse desde allí.</p></div>
      <button class="btn btn-oro btn-sm" id="nueva">+ Nueva promoción</button>
    </div>
    <div id="lista"></div>`;
  const lista = cont.querySelector("#lista");
  cargando(lista);
  let cursos, alumnos;
  try { [cursos, alumnos] = await Promise.all([listarCursos(), listarAlumnos()]); } catch (e) { return errorCarga(lista, e); }
  const inscritos = (id) => alumnos.filter((a) => (a.cursos || []).includes(id)).length;
  const recargar = () => { ctx.invalidarCursos?.(); vistaPromociones(cont, ctx); };

  lista.innerHTML = cursos.length ? `<div class="promos">${cursos.map((c) => `
    <article class="promo" data-id="${esc(c.id)}">
      <div class="promo-cab"><h3>${esc(c.nombre)}</h3><span class="curso-precio">${esc(formatoPrecio(c.precio))}</span></div>
      <p class="promo-desc">${esc((c.descripcion || "").split(/\n\s*\n/)[0])}</p>
      <div class="promo-pie">
        <span class="fila-meta">${icono("alumnos")} ${inscritos(c.id)} ${inscritos(c.id) === 1 ? "alumno inscrito" : "alumnos inscritos"}</span>
        <div class="fila-acciones">
          <a class="btn btn-borde btn-sm" href="#/cursos/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Ver en la web</a>
          <button class="btn btn-borde btn-sm" data-accion="editar">Editar</button>
          <button class="btn btn-peligro-borde btn-sm" data-accion="eliminar">Eliminar</button>
        </div>
      </div>
    </article>`).join("")}</div>`
    : `<div class="vacio-tarjeta">${icono("libro")}<p>No hay promociones. Crea la primera con «Nueva promoción».</p></div>`;

  cont.querySelector("#nueva").onclick = () => formularioCurso(null, recargar);
  lista.querySelectorAll(".promo").forEach((el) => {
    const c = cursos.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-accion="editar"]').onclick = () => formularioCurso(c, recargar);
    el.querySelector('[data-accion="eliminar"]').onclick = async () => {
      const n = inscritos(c.id);
      const ok = await confirmar("Eliminar promoción",
        `Vas a eliminar <strong>«${esc(c.nombre)}»</strong>.<br><br>
         • Desaparecerá de la web pública.<br>
         • ${n ? `Se quitará a <strong>${n} ${n === 1 ? "alumno" : "alumnos"}</strong> de esta promoción (sus cuentas se conservan).` : "No tiene alumnos inscritos."}<br>
         • Se borrarán sus solicitudes pendientes.<br>
         • Los tests se conservan para reutilizarlos.<br><br>Esta acción no se puede deshacer.`,
        { boton: "Eliminar promoción", peligro: true });
      if (!ok) return;
      try { await eliminarCurso(c.id); aviso(`Promoción «${c.nombre}» eliminada.`); recargar(); }
      catch (err) { aviso(mensajeError(err), false); }
    };
  });
}

function formularioCurso(c, alTerminar) {
  const m = modal(c ? "Editar promoción" : "Nueva promoción", `
    <form class="form" id="f-curso" novalidate>
      <label>Nombre<input id="c-nombre" maxlength="150" required value="${esc(c?.nombre || "")}" placeholder="Ej.: Policía Nacional – Promoción XLIII"></label>
      <label>Descripción<textarea id="c-desc" rows="7" maxlength="3000" placeholder="Qué incluye el curso. El primer párrafo se muestra en el listado.">${esc(c?.descripcion || "")}</textarea></label>
      <label>Precio (€)<input id="c-precio" type="number" min="0" step="0.01" inputmode="decimal" value="${typeof c?.precio === "number" ? c.precio : ""}" placeholder="Vacío = «XXX €»"></label>
      <div class="msg" id="c-msg" role="alert"></div>
      <div class="modal-acciones"><button type="submit" class="btn btn-oro" id="c-btn">${c ? "Guardar cambios" : "Crear promoción"}</button></div>
    </form>`, { ancho: 600 });
  const f = m.el.querySelector("#f-curso");
  const msg = m.el.querySelector("#c-msg");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const nombre = f.querySelector("#c-nombre").value.trim();
    const descripcion = f.querySelector("#c-desc").value.trim();
    const p = f.querySelector("#c-precio").value.trim();
    if (!nombre) return mostrar(msg, "La promoción necesita un nombre.");
    const precio = p === "" ? null : Number(p);
    if (precio !== null && (!Number.isFinite(precio) || precio < 0)) return mostrar(msg, "El precio debe ser un número positivo.");
    const btn = f.querySelector("#c-btn"); btn.disabled = true;
    try { await guardarCurso(c?.id, { nombre, descripcion, precio }); m.cerrar(); aviso(c ? "Promoción actualizada." : "Promoción creada."); alTerminar(); }
    catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
  };
}

// =====================================================================
// PROFESORES (solo administrador)
// =====================================================================
export async function vistaProfesores(cont, ctx) {
  cont.innerHTML = `
    <div class="cab-seccion">
      <div><h1 class="titulo">Profesores</h1><p class="intro">Solo el administrador puede dar de alta profesores. Al profesor le llega un email para crear su contraseña.</p></div>
      <button class="btn btn-oro btn-sm" id="nuevo">+ Alta de profesor</button>
    </div>
    <div id="lista"></div>`;
  const lista = cont.querySelector("#lista");
  cargando(lista);
  let staff;
  try { staff = await listarStaff(); } catch (e) { return errorCarga(lista, e); }
  const recargar = () => vistaProfesores(cont, ctx);

  lista.innerHTML = `<div class="filas">${staff.map((p) => `
    <article class="fila${p.activo === false ? " fila-off" : ""}">
      <div class="fila-info">
        <strong>${esc(nombreCompleto(p))} <span class="chip${p.rol === "admin" ? "" : " chip-suave"}">${p.rol === "admin" ? "Administrador" : "Profesor"}</span>${p.activo === false ? ' <span class="chip chip-rojo">Desactivado</span>' : ""}</strong>
        <span>${esc(p.email)}</span>
      </div>
      <div class="fila-lado">
        <span class="fila-meta">Último acceso: ${haceCuanto(p.ultimoAcceso)}</span>
        ${p.rol === "profesor" ? `<button class="btn btn-borde btn-sm" data-uid="${esc(p.id)}">${p.activo === false ? "Activar" : "Desactivar"}</button>` : ""}
      </div>
    </article>`).join("")}</div>`;

  lista.querySelectorAll("[data-uid]").forEach((b) => {
    const p = staff.find((x) => x.id === b.dataset.uid);
    b.onclick = async () => {
      const activar = p.activo === false;
      const ok = await confirmar(activar ? "Activar profesor" : "Desactivar profesor",
        activar ? `${esc(nombreCompleto(p))} podrá volver a entrar al campus.` : `${esc(nombreCompleto(p))} no podrá entrar al campus hasta que lo vuelvas a activar.`,
        { boton: activar ? "Activar" : "Desactivar", peligro: !activar });
      if (!ok) return;
      try { await cambiarActivo(p.id, activar); aviso(activar ? "Profesor activado." : "Profesor desactivado."); recargar(); }
      catch (err) { aviso(mensajeError(err), false); }
    };
  });

  cont.querySelector("#nuevo").onclick = () => {
    const m = modal("Alta de profesor", `
      <form class="form" id="f-prof" novalidate>
        <div class="dos-col">
          <label>Nombre<input id="p-nombre" maxlength="60" required></label>
          <label>Apellidos<input id="p-apellidos" maxlength="80" required></label>
        </div>
        <label>Email<input id="p-email" type="email" maxlength="120" required placeholder="profesor@email.com"></label>
        <div class="msg" id="p-msg" role="alert"></div>
        <div class="modal-acciones"><button type="submit" class="btn btn-oro" id="p-btn">Dar de alta</button></div>
      </form>`);
    const f = m.el.querySelector("#f-prof");
    const msg = m.el.querySelector("#p-msg");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = f.querySelector("#p-nombre").value.trim();
      const apellidos = f.querySelector("#p-apellidos").value.trim();
      const email = f.querySelector("#p-email").value.trim().toLowerCase();
      if (!nombre || !apellidos || !email) return mostrar(msg, "Rellena nombre, apellidos y email.");
      if (!EMAIL_RE.test(email)) return mostrar(msg, "El email no tiene un formato válido.");
      const btn = f.querySelector("#p-btn"); btn.disabled = true;
      try { await altaProfesor({ nombre, apellidos, email }); m.cerrar(); aviso(`Profesor dado de alta. Se ha enviado el email a ${email}.`); recargar(); }
      catch (err) { mostrar(msg, mensajeError(err)); btn.disabled = false; }
    };
  };
}

// =====================================================================
// MI CUENTA (todos los roles)
// =====================================================================
export async function vistaMiCuenta(cont, usuario) {
  const rolTexto = { admin: "Administrador", profesor: "Profesor", alumno: "Alumno" }[usuario.rol] || usuario.rol;
  cont.innerHTML = `
    <h1 class="titulo">Mi cuenta</h1>
    <div class="tarjeta cuenta">
      <dl class="datos">
        <div><dt>Nombre</dt><dd>${esc(usuario.nombre || "—")}</dd></div>
        <div><dt>Apellidos</dt><dd>${esc(usuario.apellidos || "—")}</dd></div>
        <div><dt>Email</dt><dd>${esc(usuario.email)}</dd></div>
        <div><dt>Tipo de cuenta</dt><dd>${esc(rolTexto)}</dd></div>
      </dl>
      ${usuario.rol === "alumno" ? `<h2 class="seccion-tit">Mis promociones</h2><div id="mis-cursos"><div class="spinner"></div></div>` : ""}
      <h2 class="seccion-tit">Contraseña</h2>
      <p class="nota nota-izq">Te enviaremos un email con un enlace para crear una contraseña nueva.</p>
      <div class="msg" id="mc-msg" role="alert"></div>
      <div><button class="btn btn-borde" id="mc-pass">Cambiar contraseña</button></div>
      <p class="nota nota-izq">¿Algún dato incorrecto? Pide a tu academia que lo corrija.</p>
    </div>`;
  const msg = cont.querySelector("#mc-msg");
  cont.querySelector("#mc-pass").onclick = async (e) => {
    e.target.disabled = true;
    try { await reenviarEmailContrasena(usuario.email); mostrar(msg, `Te hemos enviado el email a ${usuario.email}. Revisa también la carpeta de spam.`, true); }
    catch (err) { mostrar(msg, mensajeError(err)); e.target.disabled = false; }
  };
  if (usuario.rol === "alumno") pintarMisCursos(cont.querySelector("#mis-cursos"), usuario);
}

/** Lista de promociones del alumno (se usa en Inicio y en Mi cuenta). */
export async function pintarMisCursos(el, usuario) {
  if (!el) return;
  try {
    const cursos = (await listarCursos()).filter((c) => (usuario.cursos || []).includes(c.id));
    el.innerHTML = cursos.length
      ? `<ul class="mis-cursos">${cursos.map((c) => `<li>${icono("libro")}<span>${esc(c.nombre)}</span></li>`).join("")}</ul>`
      : `<div class="vacio-tarjeta">${icono("libro")}<p>Todavía no estás inscrito en ninguna promoción.</p><a href="#/cursos" class="btn btn-oro btn-sm">Ver cursos</a></div>`;
  } catch (e) { errorCarga(el, e); }
}
