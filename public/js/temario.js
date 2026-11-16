// Temario oficial de la Escala Básica de Policía Nacional (45 temas en 3 bloques).
// Fuente: anexo I de la convocatoria 2026 (BOE-A-2026-15055), igual que la de 2025.
// Se carga en Firestore la primera vez y después se puede editar desde el campus.

export const BLOQUES = {
  A: "Ciencias Jurídicas",
  B: "Ciencias Sociales",
  C: "Materias Técnico-Científicas",
};

export const TEMARIO_OFICIAL = [
  // A) Ciencias Jurídicas
  [1, "A", "El Derecho, la persona y la nacionalidad"],
  [2, "A", "La Constitución Española (I)"],
  [3, "A", "La Constitución Española (II)"],
  [4, "A", "La Unión Europea"],
  [5, "A", "La Administración General del Estado y el Gobierno"],
  [6, "A", "Los funcionarios públicos"],
  [7, "A", "El Ministerio del Interior y la Secretaría de Estado de Seguridad"],
  [8, "A", "La Dirección General de la Policía y la Policía Nacional"],
  [9, "A", "La Ley Orgánica 2/1986, de Fuerzas y Cuerpos de Seguridad"],
  [10, "A", "Extranjería"],
  [11, "A", "Infracciones en materia de extranjería"],
  [12, "A", "La protección internacional"],
  [13, "A", "La seguridad privada"],
  [14, "A", "La Ley Orgánica 4/2015, de protección de la seguridad ciudadana"],
  [15, "A", "Infraestructuras críticas y ciberseguridad"],
  [16, "A", "Derecho penal: parte general"],
  [17, "A", "Derecho penal especial: vida, integridad y libertad"],
  [18, "A", "Delitos contra el patrimonio"],
  [19, "A", "Delitos contra el orden público"],
  [20, "A", "Delitos informáticos y prueba digital"],
  [21, "A", "Derecho procesal penal y la detención"],
  [22, "A", "El Estatuto de la víctima del delito"],
  [23, "A", "Igualdad, violencia de género, discapacidad y dependencia"],
  [24, "A", "Introducción a la prevención de riesgos laborales"],
  [25, "A", "Marco normativo de la prevención de riesgos laborales"],
  [26, "A", "La protección de datos personales"],
  // B) Ciencias Sociales
  [27, "B", "Los derechos humanos"],
  [28, "B", "Globalización y antiglobalización"],
  [29, "B", "Actitudes y valores sociales"],
  [30, "B", "Principios éticos de la sociedad actual"],
  [31, "B", "Inmigración"],
  [32, "B", "Geografía humana"],
  [33, "B", "La seguridad y la delincuencia"],
  [34, "B", "Drogodependencias"],
  [35, "B", "El desarrollo sostenible"],
  [36, "B", "Gramática de la lengua española"],
  [37, "B", "Ortografía de la lengua española"],
  // C) Materias Técnico-Científicas
  [38, "C", "Fundamentos de sistemas operativos"],
  [39, "C", "Redes informáticas"],
  [40, "C", "Inteligencia"],
  [41, "C", "Ciberdelincuencia y agentes de la amenaza"],
  [42, "C", "Las armas de fuego"],
  [43, "C", "El vehículo prioritario"],
  [44, "C", "Seguridad activa y pasiva en vehículos prioritarios"],
  [45, "C", "Prevención de riesgos laborales en seguridad vial"],
];

export const DIFICULTADES = { facil: "Fácil", media: "Media", dificil: "Difícil" };
export const LETRAS = ["a", "b", "c"];
