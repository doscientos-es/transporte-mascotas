with mediterraneo_stops (sequence, locality, stop_alias, street, street_number, postal_code, province) as (
  values
    (1, 'Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba'),
    (2, 'Córdoba', 'Arcángel Aparcamientos', 'Avenida del Arcángel', '1', '14010', 'Córdoba'),
    (3, 'Sevilla-Écija', 'N4 Centro Comercial', 'Avenida del Genil', '2', '41400', 'Sevilla'),
    (4, 'Sevilla', 'Aparcamientos Peugeot', 'Avenida de Jerez', '1', '41013', 'Sevilla'),
    (5, 'Cádiz-Jerez de la Frontera', 'Repsol', 'Avenida de Europa', '1', '11405', 'Cádiz'),
    (6, 'Cádiz-Algeciras', 'BP Gasolinera', 'Avenida Virgen del Carmen', '1', '11204', 'Cádiz'),
    (7, 'Málaga', 'Cepsa', 'Avenida de Velázquez', '1', '29004', 'Málaga'),
    (8, 'Almería', 'Repsol junto a IKEA', 'Avenida de Montserrat', '1', '04009', 'Almería'),
    (9, 'Murcia', 'Polígono Gasolinera Plenoil', 'Avenida Juan de Borbón', '1', '30009', 'Murcia'),
    (10, 'Alicante', 'Media rotonda', 'Avenida de Denia', '1', '03016', 'Alicante'),
    (11, 'Valencia', 'Repsol junto a Decathlon', 'Avenida de Cataluña', '1', '46021', 'Valencia'),
    (12, 'Castellón', 'Gasolinera', 'Avenida de Valencia', '1', '12006', 'Castellón'),
    (13, 'Tarragona-Cambrils', 'Cepsa', 'Avenida de la Diputación', '1', '43850', 'Tarragona'),
    (14, 'Barcelona', 'Gasolinera Autonetoil', 'Carrer de la Marina', '1', '08013', 'Barcelona'),
    (15, 'Zaragoza', 'Aparcamientos Burger King', 'Avenida de Cataluña', '1', '50015', 'Zaragoza'),
    (16, 'Madrid Sur-Getafe', 'Repsol junto a Decathlon', 'Avenida de la Industria', '1', '28906', 'Madrid'),
    (17, 'Ciudad Real', 'Aparcamientos Leroy Merlin', 'Avenida de Europa', '1', '13005', 'Ciudad Real'),
    (18, 'Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba')
)
update public.route_template_stops stop
set locality = source.locality,
    stop_alias = source.stop_alias,
    street = source.street,
    street_number = source.street_number,
    postal_code = source.postal_code,
    province = source.province,
    country = 'España',
    map_url = null
from public.route_templates template, mediterraneo_stops source
where stop.route_template_id = template.id
  and template.name = 'Mediterráneo'
  and stop.sequence = source.sequence;

with mediterraneo_stops (sequence, locality, stop_alias, street, street_number, postal_code, province) as (
  values
    (1, 'Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba'), (2, 'Córdoba', 'Arcángel Aparcamientos', 'Avenida del Arcángel', '1', '14010', 'Córdoba'), (3, 'Sevilla-Écija', 'N4 Centro Comercial', 'Avenida del Genil', '2', '41400', 'Sevilla'), (4, 'Sevilla', 'Aparcamientos Peugeot', 'Avenida de Jerez', '1', '41013', 'Sevilla'), (5, 'Cádiz-Jerez de la Frontera', 'Repsol', 'Avenida de Europa', '1', '11405', 'Cádiz'), (6, 'Cádiz-Algeciras', 'BP Gasolinera', 'Avenida Virgen del Carmen', '1', '11204', 'Cádiz'), (7, 'Málaga', 'Cepsa', 'Avenida de Velázquez', '1', '29004', 'Málaga'), (8, 'Almería', 'Repsol junto a IKEA', 'Avenida de Montserrat', '1', '04009', 'Almería'), (9, 'Murcia', 'Polígono Gasolinera Plenoil', 'Avenida Juan de Borbón', '1', '30009', 'Murcia'), (10, 'Alicante', 'Media rotonda', 'Avenida de Denia', '1', '03016', 'Alicante'), (11, 'Valencia', 'Repsol junto a Decathlon', 'Avenida de Cataluña', '1', '46021', 'Valencia'), (12, 'Castellón', 'Gasolinera', 'Avenida de Valencia', '1', '12006', 'Castellón'), (13, 'Tarragona-Cambrils', 'Cepsa', 'Avenida de la Diputación', '1', '43850', 'Tarragona'), (14, 'Barcelona', 'Gasolinera Autonetoil', 'Carrer de la Marina', '1', '08013', 'Barcelona'), (15, 'Zaragoza', 'Aparcamientos Burger King', 'Avenida de Cataluña', '1', '50015', 'Zaragoza'), (16, 'Madrid Sur-Getafe', 'Repsol junto a Decathlon', 'Avenida de la Industria', '1', '28906', 'Madrid'), (17, 'Ciudad Real', 'Aparcamientos Leroy Merlin', 'Avenida de Europa', '1', '13005', 'Ciudad Real'), (18, 'Pozoblanco', 'Día Aparcamientos', 'Avenida Villanueva de Córdoba', '10', '14400', 'Córdoba')
)
update public.daily_route_stops stop
set locality = source.locality,
    stop_alias = source.stop_alias,
    street = source.street,
    street_number = source.street_number,
    postal_code = source.postal_code,
    province = source.province,
    country = 'España',
    map_url = null
from public.daily_routes route
join public.route_templates template on template.id = route.route_template_id
cross join mediterraneo_stops source
where stop.daily_route_id = route.id
  and source.sequence = stop.sequence
  and template.name = 'Mediterráneo';
