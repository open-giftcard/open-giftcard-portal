/**
 * Deployment-shaped defaults.
 *
 * These are the values a fork is most likely to want different, gathered in one
 * place so changing them is a single edit rather than a search. The portal
 * previously defaulted every currency field to TRY in ten separate files, which
 * is invisible until someone in another market submits a form that quietly
 * carried the wrong currency.
 */

/**
 * Prefilled on issuance and funding forms, and shown as the example in currency
 * filters.
 *
 * The platform itself has no default currency and no allow-list: the backend
 * accepts any ISO 4217 alphabetic code and keeps ledger accounts per currency.
 * This is only what the portal offers first.
 */
export const defaultCurrency = "USD";
