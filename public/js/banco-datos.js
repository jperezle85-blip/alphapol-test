// Datos del temario y del banco de preguntas.
//
//   temas/{id}       { numero, bloque: "A"|"B"|"C", titulo }
//   preguntas/{id}   { enunciado, opciones: [a, b, c], temas: [ids], dificultad, creado, creadoPor, actualizado }
//   respuestas/{id}  { correcta: 0|1|2, explicacion }   ← mismo id que la pregunta
//
// La respuesta correcta y la explicación van en una colección aparte para poder
// cerrarla más adelante y corregir en el servidor (pendiente "opción B").
import {
  auth, db, collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp,
} from "./firebase.js";
import { TEMARIO_OFICIAL } from "./temario.js";
import { sincronizarPregunta, quitarPreguntaDeTests } from "./tests-datos.js";

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const idTema = (n) => `tema-${String(n).padStart(2, "0")}`;

// ---------- Temario ----------
export async function listarTemas() {
  const temas = lista(await getDocs(collection(db, "temas")));
  return temas.sort((a, b) => (a.numero || 0) - (b.numero || 0) || (a.titulo || "").localeCompare(b.titulo || "", "es"));
}

/** Carga el temario oficial si la colección está vacía. Devuelve true si lo ha cargado. */
export async function asegurarTemario() {
  const snap = await getDocs(collection(db, "temas"));
  if (!snap.empty) return false;
  const lote = writeBatch(db);
  TEMARIO_OFICIAL.forEach(([numero, bloque, titulo]) => lote.set(doc(db, "temas", idTema(numero)), { numero, bloque, titulo }));
  await lote.commit();
  return true;
}

export async function guardarTema(id, { numero, bloque, titulo }) {
  const lote = writeBatch(db);
  const ref = id ? doc(db, "temas", id) : doc(collection(db, "temas"));
  lote.set(ref, { numero, bloque, titulo });
  await lote.commit();
  return ref.id;
}

export class TemaConPreguntas extends Error {}

export async function eliminarTema(id) {
  const usadas = await getDocs(query(collection(db, "preguntas"), where("temas", "array-contains", id)));
  if (!usadas.empty) throw new TemaConPreguntas(`Este tema tiene ${usadas.size} ${usadas.size === 1 ? "pregunta" : "preguntas"}. Quítalas del tema o bórralas antes de eliminarlo.`);
  const lote = writeBatch(db);
  lote.delete(doc(db, "temas", id));
  await lote.commit();
}

// ---------- Preguntas ----------
export async function listarPreguntas() {
  const ps = lista(await getDocs(collection(db, "preguntas")));
  // Más recientes primero.
  return ps.sort((a, b) => (b.creado?.seconds || 0) - (a.creado?.seconds || 0));
}

export async function leerRespuesta(id) {
  const snap = await getDoc(doc(db, "respuestas", id));
  return snap.exists() ? snap.data() : null;
}

export async function guardarPregunta(id, { enunciado, opciones, temas, dificultad, correcta, explicacion }) {
  const lote = writeBatch(db);
  const ref = id ? doc(db, "preguntas", id) : doc(collection(db, "preguntas"));
  const datos = { enunciado, opciones, temas, dificultad, actualizado: serverTimestamp() };
  if (id) lote.set(ref, datos, { merge: true });
  else lote.set(ref, { ...datos, creado: serverTimestamp(), creadoPor: auth.currentUser?.uid || null });
  lote.set(doc(db, "respuestas", ref.id), { correcta, explicacion });
  await lote.commit();
  // Si la pregunta ya estaba en algún test, se actualiza su copia.
  if (id) await sincronizarPregunta({ id, enunciado, opciones, temas }, { correcta, explicacion });
  return ref.id;
}

/** Borra la pregunta y su respuesta, y la quita de los tests que la usen. */
export async function eliminarPregunta(id) {
  await quitarPreguntaDeTests(id);
  const lote = writeBatch(db);
  lote.delete(doc(db, "preguntas", id));
  lote.delete(doc(db, "respuestas", id));
  await lote.commit();
}
