/** Date civile du jour; le produit ne connaît pas encore le fuseau de chaque utilisateur. */
export type CivilDateClock = () => string;

export const parisCivilDateClock: CivilDateClock = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
