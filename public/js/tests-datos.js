// Datos de los tests cerrados y de los intentos de los alumnos.
//
//   tests/{id} {
//     titulo, tipo: "general"|"bloque"|"tema", bloque?, temaId?,
//     preguntaIds: [ids],
//     preguntas: [{ id, enunciado, opciones: [3], correcta, explicacion, temas }],   ← copia para el alumno
//     cursos: [ids], estado: "borrador"|"publicado", creado, creadoPor, actualizado
//   }
//   cursos/{id}.tests: [ids de tests PUBLICADOS en esa promoción]  ← índice para que el alumno los encuentre
//   intentos/{id} {
//     uid, testId, testTitulo, cursos: [ids], fecha, segundos,
//     total, aciertos, errores, blancos, nota (0-10), aprobado,
//     respuestas: { preguntaId: índice elegido (0-2) | -1 en blanco }
//   }
//
// El test guarda una copia de sus preguntas (con la respuesta correcta y la explicación) para que
// el alumno lo haga leyendo un solo documento. Al editar o borrar una pregunta del banco, se
// actualizan los tests que la contienen.
import {
  auth, db, collection, doc, getDoc, getDocs, query, where, writeBatch,
  arrayUnion, arrayRemove, serverTimestamp, addDoc,
} from "./firebase.js";

export const SEGUNDOS_POR_PREGUNTA = 30;     // 100 preguntas = 50 minutos, como el examen oficial
export const PREGUNTAS_POR_DEFECTO = 100;
export const NOTA_APROBADO = 5;
export const TIPOS = { general: "General", bloque: "Por bloque", tema: "Por tema" };

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Nota oficial: (aciertos − errores / (opciones − 1)) × 10 / preguntas. Con 3 opciones, cada 2 errores restan 1 acierto. */
export function calcularNota(aciertos, errores, total) {
  if (!total) return 0;
  const bruta = (aciertos - errores / 2) * 10 / total;
  return Math.max(0, Math.round(bruta * 100) / 100);
}

export const duracionTest = (n) => n * SEGUNDOS_POR_PREGUNTA;

export function formatoDuracion(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Profesor ----------
export async function listarTests() {
  const ts = lista(await getDocs(collection(db, "tests")));
  return ts.sort((a, b) => (b.actualizado?.seconds || b.creado?.seconds || 0) - (a.actualizado?.seconds || a.creado?.seconds || 0));
}

/** Preguntas del banco que encajan con el criterio del test. */
export function candidatas(preguntas, temas, { tipo, bloque, temaId }) {
  if (tipo === "tema") return preguntas.filter((p) => (p.temas || []).includes(temaId));
  if (tipo === "bloque") {
    const ids = new Set(temas.filter((t) => t.bloque === bloque).map((t) => t.id));
    return preguntas.filter((p) => (p.temas || []).some((id) => ids.has(id)));
  }
  return preguntas;
}

/** Copia de las preguntas elegidas con su respuesta y explicación (lee las respuestas del banco). */
export async function copiarPreguntas(preguntas) {
  const respuestas = await Promise.all(preguntas.map((p) => getDoc(doc(db, "respuestas", p.id))));
  return preguntas.map((p, i) => {
    const r = respuestas[i].exists() ? respuestas[i].data() : {};
    return { id: p.id, enunciado: p.enunciado, opciones: p.opciones, temas: p.temas || [], correcta: r.correcta ?? 0, explicacion: r.explicacion || "" };
  });
}

/** Crea o actualiza un test y mantiene el índice de tests publicados de cada promoción. */
export async function guardarTest(id, datos, testAnterior = null) {
  const lote = writeBatch(db);
  const ref = id ? doc(db, "tests", id) : doc(collection(db, "tests"));
  const contenido = {
    titulo: datos.titulo, tipo: datos.tipo, bloque: datos.bloque || null, temaId: datos.temaId || null,
    preguntas: datos.preguntas, preguntaIds: datos.preguntas.map((p) => p.id),
    cursos: datos.cursos, estado: datos.estado, actualizado: serverTimestamp(),
  };
  if (id) lote.set(ref, contenido, { merge: true });
  else lote.set(ref, { ...contenido, creado: serverTimestamp(), creadoPor: auth.currentUser?.uid || null });
  indexar(lote, ref.id, testAnterior, contenido);
  await lote.commit();
  return ref.id;
}

function indexar(lote, testId, antes, despues) {
  const antesPub = antes?.estado === "publicado" ? antes.cursos || [] : [];
  const despuesPub = despues?.estado === "publicado" ? despues.cursos || [] : [];
  antesPub.filter((c) => !despuesPub.includes(c)).forEach((c) => lote.update(doc(db, "cursos", c), { tests: arrayRemove(testId) }));
  despuesPub.filter((c) => !antesPub.includes(c)).forEach((c) => lote.update(doc(db, "cursos", c), { tests: arrayUnion(testId) }));
}

export async function cambiarEstado(test, estado) {
  const lote = writeBatch(db);
  lote.update(doc(db, "tests", test.id), { estado, actualizado: serverTimestamp() });
  indexar(lote, test.id, test, { ...test, estado });
  await lote.commit();
}

/** Elimina el test. Los intentos ya hechos se conservan (cuentan en las estadísticas del alumno). */
export async function eliminarTest(test) {
  const lote = writeBatch(db);
  indexar(lote, test.id, test, null);
  lote.delete(doc(db, "tests", test.id));
  await lote.commit();
}

/** Tras editar una pregunta del banco: actualiza su copia en los tests que la contienen. */
export async function sincronizarPregunta(pregunta, respuesta) {
  const snap = await getDocs(query(collection(db, "tests"), where("preguntaIds", "array-contains", pregunta.id)));
  if (snap.empty) return 0;
  const lote = writeBatch(db);
  snap.docs.forEach((d) => {
    const preguntas = (d.data().preguntas || []).map((q) => q.id === pregunta.id
      ? { id: pregunta.id, enunciado: pregunta.enunciado, opciones: pregunta.opciones, temas: pregunta.temas, correcta: respuesta.correcta, explicacion: respuesta.explicacion }
      : q);
    lote.update(d.ref, { preguntas });
  });
  await lote.commit();
  return snap.size;
}

/** Tras borrar una pregunta del banco: la quita de los tests que la contienen. */
export async function quitarPreguntaDeTests(preguntaId) {
  const snap = await getDocs(query(collection(db, "tests"), where("preguntaIds", "array-contains", preguntaId)));
  if (snap.empty) return 0;
  const lote = writeBatch(db);
  snap.docs.forEach((d) => {
    const preguntas = (d.data().preguntas || []).filter((q) => q.id !== preguntaId);
    lote.update(d.ref, { preguntas, preguntaIds: preguntas.map((q) => q.id) });
  });
  await lote.commit();
  return snap.size;
}

// ---------- Alumno ----------
/** Tests publicados en las promociones del alumno (a través del índice cursos/{id}.tests). */
export async function testsDelAlumno(usuario) {
  const misCursos = usuario.cursos || [];
  const cursos = (await Promise.all(misCursos.map((c) => getDoc(doc(db, "cursos", c))))).filter((s) => s.exists());
  const ids = [...new Set(cursos.flatMap((s) => s.data().tests || []))];
  const tests = await Promise.all(ids.map((id) => getDoc(doc(db, "tests", id)).catch(() => null)));
  return tests
    .filter((s) => s?.exists())
    .map((s) => ({ id: s.id, ...s.data() }))
    .filter((t) => t.estado === "publicado")
    .sort((a, b) => (b.actualizado?.seconds || 0) - (a.actualizado?.seconds || 0));
}

export async function leerTest(id) {
  const s = await getDoc(doc(db, "tests", id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function misIntentos(uid) {
  const its = lista(await getDocs(query(collection(db, "intentos"), where("uid", "==", uid))));
  return its.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
}

export async function leerIntento(id) {
  const s = await getDoc(doc(db, "intentos", id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/** Corrige el test y guarda el intento. */
export async function entregarIntento(usuario, test, respuestas, segundos) {
  let aciertos = 0, errores = 0, blancos = 0;
  test.preguntas.forEach((p) => {
    const r = respuestas[p.id];
    if (r === undefined || r === -1) blancos++;
    else if (r === p.correcta) aciertos++;
    else errores++;
  });
  const total = test.preguntas.length;
  const nota = calcularNota(aciertos, errores, total);
  const intento = {
    uid: usuario.uid, testId: test.id, testTitulo: test.titulo,
    cursos: (test.cursos || []).filter((c) => (usuario.cursos || []).includes(c)),
    fecha: serverTimestamp(), segundos,
    total, aciertos, errores, blancos, nota, aprobado: nota >= NOTA_APROBADO,
    respuestas: Object.fromEntries(test.preguntas.map((p) => [p.id, respuestas[p.id] ?? -1])),
  };
  const ref = await addDoc(collection(db, "intentos"), intento);
  return { id: ref.id, ...intento };
}
