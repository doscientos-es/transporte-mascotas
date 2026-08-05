import type { DailyRoute, Letter, RouteTemplate } from './types'

export const templates: RouteTemplate[] = [
  {
    id: 'mediterraneo', name: 'Mediterráneo', color: '#bdff7b',
    stops: [
      ['Pozoblanco', 'Día Aparcamientos', 60], ['Córdoba', 'Arcángel Aparcamientos', 40], ['Sevilla-Écija', 'N4 Centro Comercial', 50], ['Sevilla', 'Aparcamientos Peugeot', 60], ['Cádiz-Jerez de la Frontera', 'Repsol', 60], ['Cádiz-Algeciras', 'BP Gasolinera', 35], ['Málaga', 'Cepsa', 65], ['Almería', 'Repsol junto a IKEA', 75], ['Murcia', 'Polígono Gasolinera Plenoil', 45], ['Alicante', 'Media rotonda', 45], ['Valencia', 'Repsol junto a Decathlon', 35], ['Castellón', 'Gasolinera', 75], ['Tarragona-Cambrils', 'Cepsa', 25], ['Barcelona', 'Gasolinera Autonetoil', 15], ['Zaragoza', 'Aparcamientos Burger King', 85], ['Madrid Sur-Getafe', 'Repsol junto a Decathlon', 40], ['Ciudad Real', 'Aparcamientos Leroy Merlin', 25], ['Pozoblanco', 'Día Aparcamientos', 0],
    ].map(([locality, place, minutes], index) => ({ id: `m-${index}`, locality: String(locality), place: String(place), minutes: Number(minutes), mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(locality))}` })),
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
  { id: 'CARTA DE PORTE Nº 2026-442', sender: 'Carmen María Fabios Jordán', senderPhone: '666 515 300', recipient: 'Amanda López', recipientPhone: '662 29 22 35', origin: 'Pozoblanco', destination: 'Valencia', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'revisada', importedAt: '05/08/2026 10:24', animals: [{ id: 'a-442-1', species: 'Canina', breed: 'Teckel', size: 'mediano' }] },
  { id: 'CARTA DE PORTE Nº 2026-443', sender: 'José Ruiz', senderPhone: '622 771 344', recipient: 'Francesc Serra', recipientPhone: '639 703 681', origin: 'Málaga', destination: 'Barcelona', route: 'Mediterráneo', serviceDate: '2026-08-08', status: 'en_ruta', importedAt: '05/08/2026 10:31', animals: [{ id: 'a-443-1', species: 'Canina', breed: 'Podenco', size: 'grande', box: 37 }, { id: 'a-443-2', species: 'Canina', breed: 'Podenco', size: 'grande', box: 40 }] },
  { id: 'CARTA DE PORTE Nº 2026-444', sender: 'Silvia Martín', senderPhone: '648 567 559', recipient: 'Rosa María Pérez', recipientPhone: '679 514 422', origin: 'Murcia', destination: 'Benavente', route: 'Norte', serviceDate: '2026-08-09', status: 'pendiente', importedAt: '05/08/2026 11:08', animals: [{ id: 'a-444-1', species: 'Canina', breed: 'Yorkshire', size: 'pequeno' }] },
]

export const initialDailyRoutes: DailyRoute[] = [{
  id: 'route-2026-08-08', templateId: 'mediterraneo', date: '2026-08-08', status: 'activa',
  actions: [
    { id: 's-1', letterId: 'CARTA DE PORTE Nº 2026-442', animalId: 'a-442-1', type: 'recogida', stop: 'Pozoblanco', customer: 'Carmen María Fabios Jordán', phone: '666 515 300', status: 'pendiente', box: 18 },
    { id: 's-2', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-1', type: 'recogida', stop: 'Málaga', customer: 'José Ruiz', phone: '622 771 344', status: 'completada', box: 37 },
    { id: 's-3', letterId: 'CARTA DE PORTE Nº 2026-442', animalId: 'a-442-1', type: 'entrega', stop: 'Valencia', customer: 'Amanda López', phone: '662 29 22 35', status: 'pendiente', box: 18 },
    { id: 's-4', letterId: 'CARTA DE PORTE Nº 2026-443', animalId: 'a-443-1', type: 'entrega', stop: 'Barcelona', customer: 'Francesc Serra', phone: '639 703 681', status: 'pendiente', box: 37 },
  ],
}]
