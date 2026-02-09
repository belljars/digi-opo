export type VertailuTulos = {
  voittajaId: string;
  haviajaId: string;
  aikaleima: string;
};

export function luoTulos(voittajaId: string, haviajaId: string): VertailuTulos {
  return {
    voittajaId,
    haviajaId,
    aikaleima: new Date().toISOString()
  };
}
