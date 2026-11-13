export interface PontoDoScript {
  idPonto: number;
  nome: string;
  endereco: string;
  idBairro: number;
  horario: string | null;
  contato: string | null;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  idUsuario: number;
  categorias: number[];
}

const AUTORES: Readonly<Record<number, number>> = { 14: 3, 15: 2 };

export const PONTOS_DO_SCRIPT: readonly PontoDoScript[] = [
  ponto(1, 'Drogasil - Uberlândia 11', 'Praça Clarimundo Carneiro, 209', 8, 'APROVADO', [9, 6]),
  ponto(2, 'Drogaria São Paulo - DSP Uberlândia III', 'Av. Nicomedes Alves dos Santos, 2100', 1, 'APROVADO', [9, 6]),
  ponto(3, 'Drogasil - Uberlândia 14', 'Av. Brasil, 2456', 3, 'APROVADO', [9, 6]),
  ponto(4, 'Bretas - Loja 518', 'Av. João Pinheiro, 77', 4, 'APROVADO', [7]),
  ponto(5, 'Loja Elétrica', 'Av. João Naves de Ávila, 6300', 16, 'APROVADO', [7]),
  ponto(6, 'Atacadão', 'Av. Cesário Crosara, 925', 15, 'APROVADO', [7, 6]),
  ponto(7, 'Bahamas Mix', 'Av. Cleanto Vieira Gonçalves, 600', 18, 'APROVADO', [6]),
  ponto(8, 'Casas Bahia', 'Av. Afonso Pena, 526', 4, 'APROVADO', [5, 6]),
  ponto(9, 'Dmae - Núcleo de Coleta Seletiva', 'Av. Rondon Pacheco, 6400', 20, 'APROVADO', [5, 8], null, '(34) 3228-7744'),
  ponto(10, 'Pão de Açúcar', 'Av. Nicomedes Alves dos Santos, 2222', 1, 'APROVADO', [8]),
  ponto(11, 'Estação de Reciclagem - Teatro Municipal', 'Av. Rondon Pacheco, 7070', 20, 'APROVADO', [1, 2, 3, 4]),
  ponto(12, 'Estação de Reciclagem - Parque do Sabiá', 'Av. Anselmo Alves dos Santos, 925', 17, 'APROVADO', [1, 2, 3, 4]),
  ponto(13, 'Ecoponto Luizote de Freitas', 'Rua Wilson Gonçalves de Souza, 10', 11, 'APROVADO', [1, 2, 3, 4, 10], '7h às 19h, todos os dias'),
  ponto(14, 'Ecoponto Daniel Fonseca', 'Rua Itabira, 1720', 7, 'PENDENTE', [1, 2, 3, 4, 10], '7h às 19h, todos os dias'),
  ponto(15, 'Cooperativa dos Recicladores de Uberlândia (CORU)', 'Rua Maria Abadia, 177', 9, 'PENDENTE', [8], null, '(34) 99798-1494'),
];

function ponto(
  idPonto: number,
  nome: string,
  endereco: string,
  idBairro: number,
  status: PontoDoScript['status'],
  categorias: number[],
  horario: string | null = null,
  contato: string | null = null,
): PontoDoScript {
  return { idPonto, nome, endereco, idBairro, horario, contato, status, categorias, idUsuario: AUTORES[idPonto] ?? 1 };
}
