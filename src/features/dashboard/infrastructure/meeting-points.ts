import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { SavedMeetingPoint } from '@/shared/types'

type MeetingPointRow = {
  id: string
  name: string
  locality: string
  instructions: string
  street: string
  street_number: string
  floor: string
  postal_code: string
  province: string
  country: string
  latitude: number
  longitude: number
}

const columns =
  'id,name,locality,instructions,street,street_number,floor,postal_code,province,country,latitude,longitude'

function mapMeetingPoint(row: MeetingPointRow): SavedMeetingPoint {
  return {
    id: row.id,
    name: row.name,
    locality: row.locality,
    place: row.instructions,
    street: row.street,
    streetNumber: row.street_number,
    floor: row.floor,
    postalCode: row.postal_code,
    province: row.province,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

function rowFromMeetingPoint(point: Omit<SavedMeetingPoint, 'id'>) {
  return {
    name: point.name.trim(),
    locality: point.locality.trim(),
    instructions: point.place.trim(),
    street: point.street.trim(),
    street_number: point.streetNumber.trim(),
    floor: point.floor.trim(),
    postal_code: point.postalCode.trim(),
    province: point.province.trim(),
    country: point.country.trim() || 'España',
    latitude: point.latitude,
    longitude: point.longitude,
  }
}

export async function loadMeetingPoints() {
  const { data, error } = await requireSupabase()
    .from('route_meeting_points')
    .select(columns)
    .order('locality')
    .order('name')
  if (error) throw error
  return ((data ?? []) as MeetingPointRow[]).map(mapMeetingPoint)
}

export async function saveMeetingPoint(point: SavedMeetingPoint | Omit<SavedMeetingPoint, 'id'>) {
  const database = requireSupabase()
  const values = rowFromMeetingPoint(point)
  const result =
    'id' in point
      ? await database
          .from('route_meeting_points')
          .update(values)
          .eq('id', point.id)
          .select(columns)
          .single()
      : await database.from('route_meeting_points').insert(values).select(columns).single()
  if (result.error?.code === '23505')
    throw new Error('Ya existe un punto con ese nombre en esa localidad.')
  if (result.error) throw result.error
  return mapMeetingPoint(result.data as MeetingPointRow)
}

export async function deleteMeetingPoint(id: string) {
  const { error } = await requireSupabase().from('route_meeting_points').delete().eq('id', id)
  if (error) throw error
}
