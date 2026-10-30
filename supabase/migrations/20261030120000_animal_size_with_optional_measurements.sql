-- Length and height are optional on manual carriage letters, but `animals.size` is not null.
-- The trigger only filled it when weight, length and height were all present, so a letter
-- with weight alone failed with: null value in column "size" of relation "animals".
-- Missing measurements now count as 0, so the size is decided by the weight (and by any
-- measurement that was given), the same rule box_category_for_measurements already uses.
create or replace function public.set_animal_size_from_measurements()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.weight_kg is not null then
    new.size = public.size_for_measurements(
      new.weight_kg, coalesce(new.length_cm, 0), coalesce(new.height_cm, 0)
    );
    -- size_source keeps its default ('manual') unless every measurement was given.
    if new.length_cm is not null and new.height_cm is not null then
      new.size_source = 'medidas';
    end if;
  end if;
  return new;
end;
$$;
