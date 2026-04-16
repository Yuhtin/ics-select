export interface CarModel {
  id: string;
  name: string;
  url: string;
  scale: number;
  yOffset: number;
}

export const CAR_MODELS: CarModel[] = [
  { id: 'car-a', name: 'Hatch', url: '/models/cars/car-a.glb', scale: 0.9, yOffset: 0 },
  { id: 'car-b', name: 'Esportivo', url: '/models/cars/car-b.glb', scale: 0.9, yOffset: 0 },
  { id: 'car-c', name: 'Clássico', url: '/models/cars/car-c.glb', scale: 0.9, yOffset: 0 },
  { id: 'suv',   name: 'SUV',      url: '/models/cars/suv.glb',   scale: 0.85, yOffset: 0 },
];

export const DEFAULT_CAR_ID = 'car-a';

export function getCarModel(id: string | null | undefined): CarModel {
  return CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0];
}
