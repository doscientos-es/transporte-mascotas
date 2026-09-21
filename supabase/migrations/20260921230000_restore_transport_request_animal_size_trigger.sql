-- The box-category trigger replaced the original sizing trigger but does not
-- populate the required transport_request_animals.size column.
drop trigger if exists transport_request_animals_size on public.transport_request_animals;
create trigger transport_request_animals_size
before insert or update of weight_kg, length_cm, height_cm
on public.transport_request_animals
for each row execute function public.set_request_animal_size();