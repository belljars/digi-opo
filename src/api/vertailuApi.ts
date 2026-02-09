import { luoTulos } from "../logic/vertailut";

export function lahetaVertailu(voittajaId: string, haviajaId: string) {
  return luoTulos(voittajaId, haviajaId);
}
