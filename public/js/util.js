// Utilidades compartidas por la web pública y el campus.

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONOS = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  alumnos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.1 4.6 1.8 5.3 4.6"/>',
  preguntas: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  tests: '<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
  resultados: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  amedida: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  simulacro: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  progreso: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  salir: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h11"/>',
  solicitud: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  libro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
  fisico: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2 1 4M6 11l3-3 4 1 2 3 3 1M11 15l2-6"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  mapa: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  telefono: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
};

export const icono = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ""}</svg>`;

export function mostrar(el, texto, ok = false) {
  el.textContent = texto;
  el.className = "msg visible" + (ok ? " ok" : "");
}

export function traducirError(err) {
  const c = err?.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(c))
    return "Email o contraseña incorrectos.";
  if (c === "auth/invalid-email") return "El email no tiene un formato válido.";
  if (c === "auth/too-many-requests") return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (c === "auth/user-disabled") return "Esta cuenta está desactivada. Contacta con la academia.";
  if (c === "auth/network-request-failed" || c === "unavailable") return "Sin conexión. Comprueba tu internet.";
  if (c === "permission-denied") return "No se han podido guardar los datos. Revisa que estén completos e inténtalo de nuevo.";
  console.error(err);
  return "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
}

// Precio del curso. Sin precio definido se muestra el marcador "XXX €".
export function formatoPrecio(precio) {
  if (typeof precio !== "number") return "XXX €";
  return precio.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: precio % 1 ? 2 : 0 });
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
