export function vehicleModelDefaults(models, modelId, brandId) {
  const model = models.find(row => String(row.ID) === String(modelId) && String(row.brand_id) === String(brandId));
  return { manufacture_year: model?.manufacture_year == null ? "" : String(model.manufacture_year), fuel_type: model?.fuel_type_id == null ? "" : String(model.fuel_type_id), transmission: model?.transmission_type_id == null ? "" : String(model.transmission_type_id) };
}
