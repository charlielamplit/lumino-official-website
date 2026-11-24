// Published by the European Commission. The mean is our arithmetic reference,
// not an additional official certificate price.
export const CERTIFICATE_PRICE_SOURCE = "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en";

export function publishedQuarterPrices(parameters) {
  return (parameters.certificatePrices2026 || [])
    .filter((entry) => Number.isFinite(entry.price))
    .map((entry) => ({ ...entry }));
}

export function publishedQuarterMean(parameters) {
  const prices = publishedQuarterPrices(parameters);
  if (!prices.length && Number.isFinite(parameters.certificatePrice)) return parameters.certificatePrice;
  if (!prices.length) throw new Error("尚无已公布的 CBAM 证书价格");
  return prices.reduce((sum, entry) => sum + entry.price, 0) / prices.length;
}

export function resolveCertificatePrice(parameters, year, quarter = "average") {
  const entry = year === 2026 && publishedQuarterPrices(parameters)
    .find((item) => item.quarter === quarter);
  return entry?.price ?? publishedQuarterMean(parameters);
}
