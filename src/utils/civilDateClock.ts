/** Date civile du jour; le produit ne connaît pas encore le fuseau de chaque utilisateur. */
export type CivilDateClock = () => string;

/** Date civile `YYYY-MM-DD` d'un instant dans un fuseau IANA, indépendante du fuseau du processus. */
export const civilDateIn = (timeZone: string, now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const parisCivilDateClock: CivilDateClock = () =>
  civilDateIn("Europe/Paris", new Date());
