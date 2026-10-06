export type ReminderPoint = {
  /** Locality and meeting point, already joined for humans. */
  place: string
  /** Approximate arrival time, e.g. "09:30". */
  time: string
  /** Calendar day of the arrival as YYYY-MM-DD; routes can last several days. */
  date: string
}

type ReminderInput = {
  pickup?: ReminderPoint
  delivery?: ReminderPoint
}

const RULES = [
  '‼️ IMPORTANTE TENER TELÉFONOS OPERATIVOS DURANTE TODO EL TRAYECTO, YA QUE LOS HORARIOS SON APROXIMADOS Y PUEDE HABER ALGÚN CONTRATIEMPO, LO CUAL EVITAREMOS EN MEDIDA DE LO POSIBLE.',
  '• SI EL ANIMAL ES AGRESIVO, CARGARLO CON BOZAL. SI NO, NO SE CARGA.',
  [
    '• NO CARGAMOS SACOS',
    '• NO CARGAMOS BOLSAS',
    '• NO CARGAMOS CAJAS',
    '• NO CARGAMOS CAMAS',
    '• NO CARGAMOS TRANSPORTINES',
  ].join('\n'),
  'SOLO LA MASCOTA Y SU DOCUMENTACIÓN, Y BOLSA PEQUEÑA DE PIENSO PARA EL VIAJE Y SUS PRIMEROS DÍAS.',
  '• TIEMPO DE CORTESÍA DE LOS CHÓFERES: 10 MIN (INTENTAD ESTAR ANTES DE LA HORA COMUNICADA).',
  '• NO DAR DE COMER PREVIAMENTE A LOS ANIMALES PARA EVITAR MAREOS, VÓMITOS O SIMILAR (los chóferes les administran la comida y la bebida durante el viaje).',
  '• DOCUMENTACIÓN DE CADA ANIMAL.',
  '• NO SE CARGA NINGÚN ANIMAL CON PULGAS, GARRAPATAS NI ENFERMO.',
  'ESTOS SON LOS HORARIOS, NO SE CAMBIAN YA QUE LOS CHÓFERES HACEN RUTA CONTINUA.',
  'ANTE CUALQUIER CONTRATIEMPO, EL CHÓFER SE PONE EN CONTACTO CON LA PERSONA. NO SE PROPORCIONA EL TELÉFONO DEL CHÓFER.',
  'GRACIAS POR CONFIAR EN NOSOTROS 😊',
]

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Standard instructions sent to everyone involved in a transport once its route is closed. */
export function transportReminderMessage({ pickup, delivery }: ReminderInput) {
  const schedule = [
    pickup &&
      `HORA DE RECOGIDA EN ${pickup.place.toUpperCase()} (${formatDay(pickup.date)}, ${pickup.time})`,
    delivery &&
      `HORA DE ENTREGA EN ${delivery.place.toUpperCase()} (${formatDay(delivery.date)}, ${delivery.time})`,
  ].filter(Boolean)
  return [schedule.join('\n'), ...RULES].filter(Boolean).join('\n\n')
}
