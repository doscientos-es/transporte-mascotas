import type { ClientInvoice, DailyRoute, Letter, RouteTemplate } from './types'

const mediterraneoStops = [
  ['Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba', 60],
  ['Córdoba', 'Arcángel Aparcamientos', 'Avenida del Arcángel', '1', '14010', 'Córdoba', 40],
  ['Sevilla-Écija', 'N4 Centro Comercial', 'Avenida del Genil', '2', '41400', 'Sevilla', 50],
  ['Sevilla', 'Aparcamientos Peugeot', 'Avenida de Jerez', '1', '41013', 'Sevilla', 60],
  ['Cádiz-Jerez de la Frontera', 'Repsol', 'Avenida de Europa', '1', '11405', 'Cádiz', 60],
  ['Cádiz-Algeciras', 'BP Gasolinera', 'Avenida Virgen del Carmen', '1', '11204', 'Cádiz', 35],
  ['Málaga', 'Cepsa', 'Avenida de Velázquez', '1', '29004', 'Málaga', 65],
  ['Almería', 'Repsol junto a IKEA', 'Avenida de Montserrat', '1', '04009', 'Almería', 75],
  ['Murcia', 'Polígono Gasolinera Plenoil', 'Avenida Juan de Borbón', '1', '30009', 'Murcia', 45],
  ['Alicante', 'Media rotonda', 'Avenida de Denia', '1', '03016', 'Alicante', 45],
  ['Valencia', 'Repsol junto a Decathlon', 'Avenida de Cataluña', '1', '46021', 'Valencia', 35],
  ['Castellón', 'Gasolinera', 'Avenida de Valencia', '1', '12006', 'Castellón', 75],
  ['Tarragona-Cambrils', 'Cepsa', 'Avenida de la Diputación', '1', '43850', 'Tarragona', 25],
  ['Barcelona', 'Gasolinera Autonetoil', 'Carrer de la Marina', '1', '08013', 'Barcelona', 15],
  ['Zaragoza', 'Aparcamientos Burger King', 'Avenida de Cataluña', '1', '50015', 'Zaragoza', 85],
  ['Madrid Sur-Getafe', 'Repsol junto a Decathlon', 'Avenida de la Industria', '1', '28906', 'Madrid', 40],
  ['Ciudad Real', 'Aparcamientos Leroy Merlin', 'Avenida de Europa', '1', '13005', 'Ciudad Real', 25],
  ['Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba', 0],
] as const

export const templates: RouteTemplate[] = [
  {
    id: 'mediterraneo', name: 'Mediterráneo', color: '#bdff7b',
    stops: mediterraneoStops.map(([locality, alias, street, streetNumber, postalCode, province, minutes], index) => {
      const country = 'España'
      const mapQuery = [`${street} ${streetNumber}`, postalCode, locality, province, country].join(', ')
      return { id: `m-${index}`, locality, place: alias, alias, street, streetNumber, postalCode, province, country, minutes, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` }
    }),
  },
  {
    id: 'norte', name: 'Norte', color: '#c5d9ff',
    stops: [
      ['Pozoblanco', 'Día Aparcamientos', 75], ['Ciudad Real-Puertollano', 'Hotel Verona', 25], ['Madrid Sur-Getafe', 'Repsol junto a Decathlon', 21], ['Burgos', 'Gasolinera Rubena', 45], ['Vitoria-Gasteiz', 'Gasolinera', 50], ['Bilbao-Barakaldo', 'Repsol', 70], ['Gijón', 'Gasolinera Repsol', 40], ['A Coruña-O Burgo', 'Gasolinera', 40], ['Vigo', 'Gasolinera Repsol', 55], ['Ourense', 'Parking', 35], ['León-Benavente', 'Gasolinera Valcarce', 45], ['Cáceres', 'Aparcamientos Carrefour', 40], ['Sevilla', 'Aparcamientos Peugeot', 50], ['Córdoba', 'Arcángel Aparcamientos', 60], ['Pozoblanco', 'Día Aparcamientos', 0],
    ].map(([locality, place, minutes], index) => ({ id: `n-${index}`, locality: String(locality), place: String(place), minutes: Number(minutes), mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(locality))}` })),
  },
  {
    id: 'central', name: 'Central', color: '#ffd8a8',
    stops: [
      ['Pozoblanco', 'Día Aparcamientos', 60], ['Córdoba', 'Arcángel Aparcamientos', 50], ['Jaén-Andújar', 'Gasolinera', 25], ['Albacete', 'Gasolinera', 45], ['Valencia', 'Gasolinera Cepsa', 25], ['Castellón', 'Gasolinera', 75], ['Barcelona', 'Gasolinera Autonetoil', 15], ['Zaragoza', 'Aparcamientos Burger King', 85], ['Madrid Sur-Getafe', 'Repsol junto a Decathlon', 71], ['Cáceres', 'Aparcamientos Carrefour', 40], ['Sevilla', 'Aparcamientos Peugeot', 50], ['Pozoblanco', 'Día Aparcamientos', 0],
    ].map(([locality, place, minutes], index) => ({ id: `c-${index}`, locality: String(locality), place: String(place), minutes: Number(minutes), mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(locality))}` })),
  },
  {
    id: 'andalucia', name: 'Andalucía', color: '#ffc7bd',
    stops: [
      ['Pozoblanco', 'Día Aparcamientos', 60], ['Córdoba', 'Arcángel Aparcamientos', 35], ['Sevilla', 'Aparcamientos Peugeot', 60], ['Cádiz-Jerez de la Frontera', 'Repsol', 60], ['Málaga', 'Cepsa', 60], ['Almería', 'Repsol junto a IKEA', 60], ['Granada-Alfacar', 'Gasolinera BP', 25], ['Jaén', 'Aparcamientos Carrefour', 25], ['Córdoba', 'Arcángel Aparcamientos', 60], ['Pozoblanco', 'Día Aparcamientos', 0],
    ].map(([locality, place, minutes], index) => ({ id: `a-${index}`, locality: String(locality), place: String(place), minutes: Number(minutes), mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(locality))}` })),
  },
]

export const initialLetters: Letter[] = [
  { id: 'CARTA DE PORTE Nº 2026-442', sender: 'Carmen María Fabios Jordán', senderPhone: '666 515 300', recipient: 'Amanda López', recipientPhone: '662 292 235', origin: 'Pozoblanco', destination: 'Valencia', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'revisada', importedAt: '05/08/2026 10:24', animals: [{ id: 'a-442-1', species: 'Canina', breed: 'Teckel', size: 'mediano', box: 8 }] },
  { id: 'CARTA DE PORTE Nº 2026-443', sender: 'José Ruiz Moreno', senderPhone: '622 771 344', recipient: 'Francesc Serra Vidal', recipientPhone: '639 703 681', origin: 'Málaga', destination: 'Barcelona', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'en_ruta', importedAt: '05/08/2026 10:31', animals: [{ id: 'a-443-1', species: 'Canina', breed: 'Podenco', size: 'grande', box: 37 }, { id: 'a-443-2', species: 'Canina', breed: 'Podenco', size: 'grande', box: 37 }] },
  { id: 'CARTA DE PORTE Nº 2026-445', sender: 'Laura Pineda Ramos', senderPhone: '634 118 726', recipient: 'Marcos Leal Ortega', recipientPhone: '611 409 285', origin: 'Almería', destination: 'Valencia', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'en_ruta', importedAt: '05/08/2026 11:12', animals: [{ id: 'a-445-1', species: 'Canina', breed: 'Bichón maltés', size: 'pequeno', box: 19 }] },
  { id: 'CARTA DE PORTE Nº 2026-446', sender: 'Inés Aranda López', senderPhone: '677 820 194', recipient: 'Sergi Costa Pujol', recipientPhone: '655 338 911', origin: 'Córdoba', destination: 'Barcelona', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'revisada', importedAt: '05/08/2026 11:40', animals: [{ id: 'a-446-1', species: 'Canina', breed: 'Beagle', size: 'mediano', box: 41 }] },
  { id: 'CARTA DE PORTE Nº 2026-447', sender: 'David Salas Núñez', senderPhone: '686 441 579', recipient: 'Nerea Valls Ferrer', recipientPhone: '601 724 608', origin: 'Sevilla', destination: 'Alicante', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'en_ruta', importedAt: '05/08/2026 12:05', animals: [{ id: 'a-447-1', species: 'Canina', breed: 'Pastor alemán', size: 'grande', box: 2 }] },
  { id: 'CARTA DE PORTE Nº 2026-448', sender: 'Patricia Bernal Soto', senderPhone: '620 059 771', recipient: 'Hugo Ferrando Gil', recipientPhone: '647 861 035', origin: 'Murcia', destination: 'Castellón', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'revisada', importedAt: '05/08/2026 12:27', animals: [{ id: 'a-448-1', species: 'Canina', breed: 'Pomerania', size: 'pequeno', box: 52 }] },
  { id: 'CARTA DE PORTE Nº 2026-449', sender: 'Carmen María Fabios Jordán', senderPhone: '666 515 300', recipient: 'Jordi Miró Serra', recipientPhone: '612 504 893', origin: 'Pozoblanco', destination: 'Barcelona', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'revisada', importedAt: '05/08/2026 12:49', animals: [{ id: 'a-449-1', species: 'Canina', breed: 'Cocker spaniel', size: 'mediano', box: 11 }] },
  { id: 'CARTA DE PORTE Nº 2026-450', sender: 'Rocío Carmona León', senderPhone: '696 205 417', recipient: 'Iván Blasco Pérez', recipientPhone: '623 991 544', origin: 'Málaga', destination: 'Zaragoza', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'en_ruta', importedAt: '05/08/2026 13:08', animals: [{ id: 'a-450-1', species: 'Canina', breed: 'Chihuahua', size: 'pequeno', box: 63 }] },
  { id: 'CARTA DE PORTE Nº 2026-451', sender: 'Elena Torres Roldán', senderPhone: '625 374 402', recipient: 'Álvaro Nieto Sanz', recipientPhone: '610 320 718', origin: 'Valencia', destination: 'Madrid Sur-Getafe', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'pendiente', importedAt: '05/08/2026 13:26', animals: [{ id: 'a-451-1', species: 'Canina', breed: 'Jack Russell', size: 'pequeno', box: 26 }] },
  { id: 'CARTA DE PORTE Nº 2026-452', sender: 'Silvia Martín Luque', senderPhone: '648 567 559', recipient: 'Rosa María Pérez', recipientPhone: '679 514 422', origin: 'Madrid Sur-Getafe', destination: 'León-Benavente', route: 'Norte', serviceDate: '2026-08-09', status: 'pendiente', importedAt: '06/08/2026 09:12', animals: [{ id: 'a-452-1', species: 'Canina', breed: 'Yorkshire', size: 'pequeno', box: 29 }] },
  { id: 'CARTA DE PORTE Nº 2026-453', sender: 'Tomás Requena Gil', senderPhone: '613 084 922', recipient: 'Marta Lago Souto', recipientPhone: '653 280 941', origin: 'Madrid Sur-Getafe', destination: 'A Coruña-O Burgo', route: 'Norte', serviceDate: '2026-08-09', status: 'revisada', importedAt: '06/08/2026 09:36', animals: [{ id: 'a-453-1', species: 'Canina', breed: 'Labrador', size: 'grande', box: 38 }] },
  { id: 'CARTA DE PORTE Nº 2026-454', sender: 'Mónica Luna Varela', senderPhone: '681 997 653', recipient: 'Ángel Rivas Torres', recipientPhone: '604 712 845', origin: 'Sevilla', destination: 'Granada-Alfacar', route: 'Andalucía', serviceDate: '2026-08-10', status: 'pendiente', importedAt: '06/08/2026 10:04', animals: [{ id: 'a-454-1', species: 'Canina', breed: 'Border collie', size: 'mediano', box: 42 }] },
]

export const initialDailyRoutes: DailyRoute[] = [{
  id: 'route-2026-08-08', templateId: 'mediterraneo', date: '2026-08-08', status: 'activa',
  actions: [
    { id: 's-442-p', letterId: 'CARTA DE PORTE Nº 2026-442', animalId: 'a-442-1', type: 'recogida', stop: 'Pozoblanco', customer: 'Carmen María Fabios Jordán', phone: '666 515 300', status: 'completada', box: 8 }, { id: 's-442-d', letterId: 'CARTA DE PORTE Nº 2026-442', animalId: 'a-442-1', type: 'entrega', stop: 'Valencia', customer: 'Amanda López', phone: '662 292 235', status: 'pendiente', box: 8 },
    { id: 's-443a-p', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-1', type: 'recogida', stop: 'Málaga', customer: 'José Ruiz Moreno', phone: '622 771 344', status: 'completada', box: 37 }, { id: 's-443a-d', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-1', type: 'entrega', stop: 'Barcelona', customer: 'Francesc Serra Vidal', phone: '639 703 681', status: 'pendiente', box: 37 },
    { id: 's-443b-p', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-2', type: 'recogida', stop: 'Málaga', customer: 'José Ruiz Moreno', phone: '622 771 344', status: 'completada', box: 37 }, { id: 's-443b-d', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-2', type: 'entrega', stop: 'Barcelona', customer: 'Francesc Serra Vidal', phone: '639 703 681', status: 'pendiente', box: 37 },
    { id: 's-445-p', letterId: 'CARTA DE PORTE Nº 2026-445', animalId: 'a-445-1', type: 'recogida', stop: 'Almería', customer: 'Laura Pineda Ramos', phone: '634 118 726', status: 'completada', box: 19 }, { id: 's-445-d', letterId: 'CARTA DE PORTE Nº 2026-445', animalId: 'a-445-1', type: 'entrega', stop: 'Valencia', customer: 'Marcos Leal Ortega', phone: '611 409 285', status: 'pendiente', box: 19 },
    { id: 's-446-p', letterId: 'CARTA DE PORTE Nº 2026-446', animalId: 'a-446-1', type: 'recogida', stop: 'Córdoba', customer: 'Inés Aranda López', phone: '677 820 194', status: 'completada', box: 41 }, { id: 's-446-d', letterId: 'CARTA DE PORTE Nº 2026-446', animalId: 'a-446-1', type: 'entrega', stop: 'Barcelona', customer: 'Sergi Costa Pujol', phone: '655 338 911', status: 'pendiente', box: 41 },
    { id: 's-447-p', letterId: 'CARTA DE PORTE Nº 2026-447', animalId: 'a-447-1', type: 'recogida', stop: 'Sevilla', customer: 'David Salas Núñez', phone: '686 441 579', status: 'completada', box: 2 }, { id: 's-447-d', letterId: 'CARTA DE PORTE Nº 2026-447', animalId: 'a-447-1', type: 'entrega', stop: 'Alicante', customer: 'Nerea Valls Ferrer', phone: '601 724 608', status: 'pendiente', box: 2 },
    { id: 's-448-p', letterId: 'CARTA DE PORTE Nº 2026-448', animalId: 'a-448-1', type: 'recogida', stop: 'Murcia', customer: 'Patricia Bernal Soto', phone: '620 059 771', status: 'pendiente', box: 52 }, { id: 's-448-d', letterId: 'CARTA DE PORTE Nº 2026-448', animalId: 'a-448-1', type: 'entrega', stop: 'Castellón', customer: 'Hugo Ferrando Gil', phone: '647 861 035', status: 'pendiente', box: 52 },
    { id: 's-449-p', letterId: 'CARTA DE PORTE Nº 2026-449', animalId: 'a-449-1', type: 'recogida', stop: 'Pozoblanco', customer: 'Carmen María Fabios Jordán', phone: '666 515 300', status: 'completada', box: 11 }, { id: 's-449-d', letterId: 'CARTA DE PORTE Nº 2026-449', animalId: 'a-449-1', type: 'entrega', stop: 'Barcelona', customer: 'Jordi Miró Serra', phone: '612 504 893', status: 'pendiente', box: 11 },
    { id: 's-450-p', letterId: 'CARTA DE PORTE Nº 2026-450', animalId: 'a-450-1', type: 'recogida', stop: 'Málaga', customer: 'Rocío Carmona León', phone: '696 205 417', status: 'pendiente', box: 63 }, { id: 's-450-d', letterId: 'CARTA DE PORTE Nº 2026-450', animalId: 'a-450-1', type: 'entrega', stop: 'Zaragoza', customer: 'Iván Blasco Pérez', phone: '623 991 544', status: 'pendiente', box: 63 },
    { id: 's-451-p', letterId: 'CARTA DE PORTE Nº 2026-451', animalId: 'a-451-1', type: 'recogida', stop: 'Valencia', customer: 'Elena Torres Roldán', phone: '625 374 402', status: 'pendiente', box: 26 }, { id: 's-451-d', letterId: 'CARTA DE PORTE Nº 2026-451', animalId: 'a-451-1', type: 'entrega', stop: 'Madrid Sur-Getafe', customer: 'Álvaro Nieto Sanz', phone: '610 320 718', status: 'pendiente', box: 26 },
  ],
}, {
  id: 'route-2026-08-09', templateId: 'norte', date: '2026-08-09', status: 'borrador', actions: [
    { id: 's-452-p', letterId: 'CARTA DE PORTE Nº 2026-452', animalId: 'a-452-1', type: 'recogida', stop: 'Madrid Sur-Getafe', customer: 'Silvia Martín Luque', phone: '648 567 559', status: 'pendiente', box: 29 }, { id: 's-452-d', letterId: 'CARTA DE PORTE Nº 2026-452', animalId: 'a-452-1', type: 'entrega', stop: 'León-Benavente', customer: 'Rosa María Pérez', phone: '679 514 422', status: 'pendiente', box: 29 },
    { id: 's-453-p', letterId: 'CARTA DE PORTE Nº 2026-453', animalId: 'a-453-1', type: 'recogida', stop: 'Madrid Sur-Getafe', customer: 'Tomás Requena Gil', phone: '613 084 922', status: 'pendiente', box: 38 }, { id: 's-453-d', letterId: 'CARTA DE PORTE Nº 2026-453', animalId: 'a-453-1', type: 'entrega', stop: 'A Coruña-O Burgo', customer: 'Marta Lago Souto', phone: '653 280 941', status: 'pendiente', box: 38 },
  ]
}, {
  id: 'route-2026-08-10', templateId: 'andalucia', date: '2026-08-10', status: 'borrador', actions: [
    { id: 's-454-p', letterId: 'CARTA DE PORTE Nº 2026-454', animalId: 'a-454-1', type: 'recogida', stop: 'Sevilla', customer: 'Mónica Luna Varela', phone: '681 997 653', status: 'pendiente', box: 42 }, { id: 's-454-d', letterId: 'CARTA DE PORTE Nº 2026-454', animalId: 'a-454-1', type: 'entrega', stop: 'Granada-Alfacar', customer: 'Ángel Rivas Torres', phone: '604 712 845', status: 'pendiente', box: 42 },
  ]
}]

export const initialClientInvoices: ClientInvoice[] = [
  { id: 'demo-invoice-442', letterId: 'CARTA DE PORTE Nº 2026-442', clientId: 'demo-carmen maría fabios jordán', payer: 'remitente', concept: 'Servicio de transporte de mascota', total: 200, status: 'solicitud_pago', createdAt: '2026-08-05T10:30:00.000Z' },
  { id: 'demo-invoice-446', letterId: 'CARTA DE PORTE Nº 2026-446', clientId: 'demo-sergi costa pujol', payer: 'destinatario', concept: 'Servicio de transporte de mascota', total: 185, status: 'solicitud_pago', createdAt: '2026-08-05T11:48:00.000Z' },
]
