// Fixed, dated reference rates for the hackathon demo; these are not live quotes.
export const ECB_REFERENCE_RATES = Object.freeze({
  date: '2026-10-23',
  base: 'EUR',
  source: 'European Central Bank',
  sourceUrl: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
  perEuro: Object.freeze({
    USD: 1.1193,
    MXN: 21.0226,
    GBP: 0.83728,
    EUR: 1,
  }),
})
