// Acceso a datos del campus: promociones, solicitudes y usuarios.
import {
  auth, db, crearCuentaAcceso, sendPasswordResetEmail,
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  writeBatch, arrayUnion, arrayRemove, serverTimestamp,
} from "./firebase.js";

export const ROLES_STAFF = ["profesor", "admin"];
export const esStaff = (u) => ROLES_STAFF.includes(u?.rol);
export const nombreCompleto = (u) => [u?.nombre, u?.apellidos].filter(Boolean).join(" ") || u?.email || "";

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const porNombre = (a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), "es");

// ---------- Promociones (colección "cursos") ----------
export async function listarCursos() {
  const cursos = lista(await getDocs(collection(db, "cursos")));
  return cursos.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
}

export async function guardarCurso(id, { nombre, descripcion, precio }) {
  const datos = { nombre, descripcion, precio: typeof precio === "number" ? precio : null };
  if (id) {
    await updateDoc(doc(db, "cursos", id), datos);
    return id;
  }
  const ref = doc(collection(db, "cursos"));
  await setDoc(ref, { ...datos, creado: serverTimestamp() });
  return ref.id;
}

/**
 * Elimina la promoción: la quita de los alumnos inscritos y de los tests asignados, borra sus
 * solicitudes y los resultados (intentos) hechos en ella. Los tests se conservan.
 */
export async function eliminarCurso(id) {
  const [inscritos, solicitudes, tests, intentos] = await Promise.all([
    getDocs(query(collection(db, "users"), where("cursos", "array-contains", id))),
    getDocs(query(collection(db, "solicitudes"), where("cursoId", "==", id))),
    getDocs(query(collection(db, "tests"), where("cursos", "array-contains", id))),
    getDocs(query(collection(db, "intentos"), where("cursos", "array-contains", id))),
  ]);
  const lote = writeBatch(db);
  inscritos.docs.forEach((d) => lote.update(d.ref, { cursos: arrayRemove(id) }));
  solicitudes.docs.forEach((d) => lote.delete(d.ref));
  tests.docs.forEach((d) => lote.update(d.ref, { cursos: arrayRemove(id) }));
  // Un intento hecho en varias promociones a la vez solo se borra cuando no queda ninguna.
  intentos.docs.forEach((d) => ((d.data().cursos || []).length > 1 ? lote.update(d.ref, { cursos: arrayRemove(id) }) : lote.delete(d.ref)));
  lote.delete(doc(db, "cursos", id));
  await lote.commit();
  return { alumnos: inscritos.size, solicitudes: solicitudes.size };
}

// ---------- Solicitudes ----------
export async function listarSolicitudes() {
  const sols = lista(await getDocs(query(collection(db, "solicitudes"), where("estado", "==", "pendiente"))));
  return sols.sort((a, b) => (a.creado?.seconds || 0) - (b.creado?.seconds || 0));
}

export async function contarPendientes() {
  return (await getDocs(query(collection(db, "solicitudes"), where("estado", "==", "pendiente")))).size;
}

/** Rechazar = eliminar la solicitud (decisión de la v1). */
export async function rechazarSolicitud(id) {
  await deleteDoc(doc(db, "solicitudes", id));
}

/**
 * Aprobar: si el alumno ya tiene cuenta, se le añade el curso; si no, se crea la cuenta
 * y se le envía el email para crear su contraseña. Devuelve { nueva: boolean }.
 */
export async function aprobarSolicitud(sol) {
  const res = await altaAlumno({
    nombre: sol.nombre, apellidos: sol.apellidos, email: sol.email, cursos: [sol.cursoId], uid: sol.uid,
  });
  await deleteDoc(doc(db, "solicitudes", sol.id));
  return res;
}

// ---------- Usuarios ----------
export async function buscarPorEmail(email) {
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email.toLowerCase())));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function listarAlumnos() {
  return lista(await getDocs(query(collection(db, "users"), where("rol", "==", "alumno")))).sort(porNombre);
}

export async function listarStaff() {
  return lista(await getDocs(query(collection(db, "users"), where("rol", "in", ROLES_STAFF)))).sort(porNombre);
}

export class ErrorAlta extends Error {}

/**
 * Da de alta (o inscribe) a un alumno.
 * - Si ya existe una ficha con ese email (o uid), se le añaden los cursos.
 * - Si no, se crea la cuenta y se envía el email para crear la contraseña.
 */
export async function altaAlumno({ nombre, apellidos, email, cursos = [], uid }) {
  email = email.trim().toLowerCase();
  const existente = uid ? { id: uid, rol: "alumno" } : await buscarPorEmail(email);
  if (existente) {
    if (existente.rol !== "alumno") throw new ErrorAlta("Ese email pertenece a un profesor o administrador.");
    if (cursos.length) await updateDoc(doc(db, "users", existente.id), { cursos: arrayUnion(...cursos) });
    return { nueva: false, uid: existente.id };
  }
  const nuevoUid = await crearCuentaConFicha({ nombre, apellidos, email, rol: "alumno", cursos });
  return { nueva: true, uid: nuevoUid };
}

/** Alta de profesor (solo administrador). */
export async function altaProfesor({ nombre, apellidos, email }) {
  email = email.trim().toLowerCase();
  if (await buscarPorEmail(email)) throw new ErrorAlta("Ya existe una cuenta con ese email.");
  return crearCuentaConFicha({ nombre, apellidos, email, rol: "profesor", cursos: [] });
}

async function crearCuentaConFicha({ nombre, apellidos, email, rol, cursos }) {
  let uid;
  try {
    uid = await crearCuentaAcceso(email);
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      throw new ErrorAlta(
        "Ese email ya tiene cuenta de acceso pero no tiene ficha en el campus. " +
        "Bórralo en Firebase → Authentication → Usuarios y vuelve a darlo de alta."
      );
    }
    throw err;
  }
  await setDoc(doc(db, "users", uid), {
    nombre, apellidos, email, rol, cursos, activo: true, creado: serverTimestamp(),
  });
  // Email para que cree su contraseña (plantilla de "restablecer contraseña" de Firebase).
  await sendPasswordResetEmail(auth, email);
  return uid;
}

export async function actualizarAlumno(uid, { nombre, apellidos, cursos, activo }) {
  await updateDoc(doc(db, "users", uid), { nombre, apellidos, cursos, activo });
}

export async function cambiarActivo(uid, activo) {
  await updateDoc(doc(db, "users", uid), { activo });
}

export async function reenviarEmailContrasena(email) {
  await sendPasswordResetEmail(auth, email);
}
