---
type: changed
issue: 153
user: Vous restez connecté plus longtemps : 7 jours sans utiliser l'application, et jusqu'à 30 jours au total avant de devoir vous reconnecter.
---

Extended refresh sessions to seven sliding days with an absolute limit of thirty days after creation; `refreshTokenExpiresIn` now reports the remaining lifetime. The access token issued at login now lasts five minutes, like a renewed one.
