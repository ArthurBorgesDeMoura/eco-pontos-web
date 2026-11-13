# EcoPonto · frontend

Projeto Angular 14 do EcoPonto. A visão geral do sistema e o backend estão no [README da raiz](../README.md).

## Requisitos

- Node.js 22 LTS (a versão está em `.nvmrc`). No Windows, com o nvm-windows: `nvm install 22` e depois `nvm use` com a versão instalada.
- Google Chrome. Os testes de unidade e os de ponta a ponta usam o Chrome da máquina.

## Instalar

```bash
npm ci
```

## Rodar

| Comando | O que faz |
| --- | --- |
| `npm run start:simulacao` | Abre em http://localhost:4200 com respostas simuladas. Não precisa do backend. |
| `npm start` | Abre em http://localhost:4200 e encaminha `/api` para a API local da pasta `../backend/` (`cd ../backend && ./mvnw spring-boot:run`). |

O `npm start` segue a porta da própria API, na mesma ordem que ela usa (`scripts/destino-da-api.cjs`):

1. a variável `ECOPONTO_API_URL`, um endereço inteiro, que passa por cima de tudo;
2. a variável `ECOPONTO_API_PORTA`;
3. a `ECOPONTO_API_PORTA` do `../backend/.env` e, depois, do `.env` da raiz, os arquivos que a API lê no perfil dev;
4. `http://localhost:8080`, a porta padrão da API.

Ao subir, o `ng serve` mostra para onde vai, como `Proxy do ng serve: /api vai para http://localhost:8080 (.env da raiz).` Do `.env`, o frontend só lê a porta. Para usar outra API, defina `ECOPONTO_API_URL`:

```bash
# Git Bash
ECOPONTO_API_URL=http://localhost:8080 npm start
```

```powershell
# PowerShell
$env:ECOPONTO_API_URL = 'http://localhost:8080'; npm start
```

A variável só vale para o `ng serve`. O build de produção (`npm run build`) chama a API em `/api`, na mesma origem das páginas. Por isso, sirva o `dist/ecoponto/` junto da API: o backend entrega os arquivos, ou um proxy reverso encaminha `/api`. Servir o `dist/` numa porta e a API em outra faz toda chamada falhar.

A página inicial é a busca de pontos (FE-05).
- **Filtros:** bairro e material, guardados na URL (`/?bairro=4&material=6`); o link pode ser compartilhado, e recarregar ou voltar mantém a busca.
- **Bairro (FE-07):** o menu traz "Todos os bairros" e os 20 bairros na ordem da API, com o escolhido marcado. Abre por clique, Enter, Espaço ou seta, e Esc fecha sem perder o foco. No desktop segue a D06; no celular e no tablet, que o protótipo não desenha (DA-5), as opções têm 44 px.
- **Contadores (FE-06):** cada material mostra quantos pontos aprovados o aceitam no bairro escolhido. Com um material escolhido, o cabeçalho da lista diz "3 pontos aceitam Papel e papelão" e traz a descrição dele. No celular e no tablet, a contagem vai no rótulo do seletor, "Papel e papelão (3)", provisório até a conferência do M04.
- **Lista:** 7 pontos por vez, com "Mostrar mais". Com um bairro escolhido, o cabeçalho termina no nome dele ("2 pontos em Centro").
- **Estados (FE-08):**
  - durante a busca, 7 linhas-esqueleto paradas, do tamanho das reais, e um traço no lugar do total;
  - sem pontos, o estado vazio do D07 ("Nenhum ponto de coleta em Alto Umuarama ainda.") com "Sugerir um ponto", que leva ao formulário, ou a Entrar para o visitante;
  - com erro, a mensagem e "Tentar de novo". Se só o "Mostrar mais" falha, a lista fica e o erro aparece no rodapé.
- **Detalhe (FE-09):** `/pontos/{id}` mostra endereço, bairro, horário, contato ("Não informado" quando vem vazio) e os materiais com a descrição, além de "Abrir no mapa", que abre o Google Maps em outra aba. Id que não existe mostra "Ponto não encontrado".
  - No celular, a tela entra e sai pela direita; com "reduzir movimento", esmaece.
  - Voltar (pelo navegador ou pela tela) refaz a busca como estava: os filtros, o "Mostrar mais", a rolagem e o foco na linha do ponto aberto.
  - Os textos "Pontos de coleta" (o voltar) e "<bairro> · Uberlândia – MG" (o subtítulo) foram deduzidos pela largura nos metadados da D08 e ficam provisórios até a captura do Figma, assim como o arranjo do celular (M05).
- **Páginas de desenvolvimento:** a de teste fica em `/sistema` (tokens, movimento e conexão com a API) e o catálogo de componentes em `/catalogo`. Elas e as respostas simuladas só existem nos builds de desenvolvimento; o `npm run build` não as inclui.

As telas Entrar (`/entrar`) e Criar conta (`/criar-conta`) já funcionam (FE-03). Depois de entrar, a pessoa vai à tela de `?voltar=` (só caminhos do próprio sistema) ou à página inicial, com o nome na barra. Entrar sai do histórico (o destino fica no lugar dele): o "voltar" de depois não cai de novo em Entrar.

Sessão e proteção de telas (FE-04):
- **Ao abrir:** o sistema pergunta ao backend quem está logado (`GET /api/auth/eu`), e por isso recarregar mantém o login.
- **Telas de quem está logado:** sem login, Sugerir, Minhas sugestões e o Painel levam a Entrar e voltam depois. O Painel, e a edição de um ponto, levam a "Sem permissão" quem tem perfil USUARIO. A proteção de verdade é do backend (BE-05).
- **Sessão que termina:** um 401 no meio do uso leva a Entrar com "Sua sessão terminou".
- **Endereço que não existe:** mostra "Página não encontrada".

Sugerir novo ponto (FE-10), em `/sugerir`, só para quem entrou:
- **Campos:** nome, endereço, bairro (só os 20 da lista, DA-8), horário e contato opcionais e os materiais, como caixas de seleção num grupo "Materiais aceitos".
- **Validação:** os erros aparecem junto de cada campo, e o foco vai ao primeiro. Um 400 do backend vai para o campo certo.
- **Rede que cai:** mantém o que foi digitado, com "Tentar de novo".
- **Depois de enviar:** vai a Minhas sugestões com o aviso "Sugestão enviada. Ela fica pendente até a análise.".

Minhas sugestões (FE-11), em `/minhas-sugestoes`, só para quem entrou:
- **Abas:** Todas, Pendentes, Aprovadas e Recusadas, que trocam pelas setas. A aba escolhida fica na URL (`?aba=pendentes`).
- **Lista:** cada sugestão com a etiqueta Pendente, Aprovada ou Recusada; no celular, em cartões. Uma aba sem itens mostra uma frase, e Todas oferece "Sugerir um ponto".
- **Na simulação:** a Maria tem o CORU (pendente), o João tem o Ecoponto Daniel Fonseca (pendente) e a administração tem os 13 aprovados. O que o Painel aprova ou recusa aparece em Aprovadas ou Recusadas.

Painel (FE-12), em `/painel`, só para ADMIN:
- **Abas:** Pendentes, Pontos e Categorias, com os contadores de `GET /api/admin/resumo` ao lado do nome ("Pendentes 2"). Os contadores voltam a ser pedidos a cada decisão, exclusão e troca de aba. A aba fica na URL (`?aba=pontos`).
- **Fila:** os pendentes, do mais antigo para o mais novo, com bairro e endereço, horário e contato ("não informado" quando vêm vazios), materiais e quem sugeriu. No desktop, a tabela da D12; no celular e no tablet, cartões, provisórios até o M09 e o M10.
- **Aprovar e Recusar:** a recusa não pede motivo (DA-7).
  - Durante a chamada, os dois botões da linha ficam indisponíveis, sem perder o foco.
  - Depois, a linha esmaece em 160 ms e sai, os contadores voltam do servidor, e o aviso diz "<nome> aprovado e publicado." ou "<nome> recusado.".
  - O foco vai ao mesmo botão da linha seguinte; sem linhas, à frase "Nenhuma sugestão aguardando análise".
- **Já decidido por outro administrador (409):** a linha sai, com o aviso "Esta sugestão já foi analisada.".
- **Na simulação:** aprovar o Ecoponto Daniel Fonseca o põe na busca (14 pontos), e recusar o CORU o leva às Recusadas da Maria. As decisões duram enquanto a aba estiver aberta.

Gerenciar pontos (FE-13), na aba Pontos do Painel (`/painel?aba=pontos`), só para ADMIN:
- **Lista:** os aprovados (DA-4), por bairro e nome, 7 por vez, com "Mostrando 7 de 13 pontos" e "Mostrar mais". No desktop, a tabela da D14; no celular e no tablet, cartões com "Editar" e "Excluir" de 44 px (sem protótipo, DA-5).
- **Editar:** abre `/painel/pontos/{id}/editar`, o formulário do FE-10 preenchido com o ponto (sem protótipo, DA-5).
  - "Salvar alterações" manda `PUT /api/admin/pontos/{id}` e volta à aba com o aviso "Ponto atualizado.".
  - A lista volta do mesmo tamanho, com o dado novo, e o foco no "Editar" da linha.
  - "Cancelar", e o "Voltar" do celular, também voltam à aba.
- **Excluir:** pede confirmação no diálogo da D15, com o foco inicial em "Cancelar". Esc e "Cancelar" fecham e devolvem o foco ao botão.
  - Confirmado, os botões da linha esperam a resposta do `DELETE /api/admin/pontos/{id}`.
  - Excluído, a linha esmaece e sai, o total cai (13 vira 12), o aviso diz "<nome> excluído.", e a lista se completa com o ponto seguinte (D17).
  - O foco vai ao "Excluir" da linha seguinte.
- **Já excluído por outro administrador (404):** a linha sai, com o aviso "Este ponto já tinha sido excluído.". Na edição, o 404 mostra "Ponto não encontrado".
- **Rede que cai:** a linha fica, os botões voltam e o aviso conta o que houve.
- **Na simulação:** a edição e a exclusão aparecem na busca pública e duram enquanto a aba estiver aberta.

Gerenciar categorias (FE-14), na aba Categorias do Painel (`/painel?aba=categorias`), só para ADMIN:
- **Lista:** as categorias, em ordem de id, com a descrição e os pontos aprovados de cada uma, e o rodapé "10 categorias". No desktop, a tabela da D16; no celular e no tablet, uma lista de nome, descrição e pontos, com "Editar" de 44 px (sem protótipo, DA-5). Não há exclusão de categoria (RF08).
- **Formulário:** fica numa tela própria (decidido em 26/10/2026), sem protótipo (DA-5).
  - "Nova categoria", no topo da página, abre `/painel/categorias/nova`; "Editar" abre `/painel/categorias/{id}/editar`, preenchido.
  - Os campos são Nome (obrigatório, até 60) e Descrição (opcional, até 255).
  - Os erros aparecem junto do campo. O nome repetido (409) vai ao campo Nome, sem sair do formulário.
  - Salvou: o aviso "Categoria cadastrada." ou "Categoria atualizada.", e a volta à aba, que pede a lista e o contador de novo, com o foco no "Editar" da categoria.
- **Na simulação:** a categoria nova ou editada aparece no filtro de materiais da busca, no formulário de Sugerir e no detalhe dos pontos, e dura enquanto a aba estiver aberta. O nome repetido não diferencia maiúsculas nem acentos, como a coluna `UNIQUE` do MariaDB.

## Testar e montar

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes de unidade (Karma e Jasmine) no Chrome sem janela. `npm run test:watch` deixa os testes rodando. |
| `npm run test:regras` | Regras do projeto: nada escrito direto nas telas, o contraste dos tokens de cor (WCAG: 4,5:1 no texto e 3:1 na borda e no foco) e o gerador de ícones. |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright) em 390, 768 e 1440 px. Sobem o servidor em modo simulação sozinhos e salvam capturas em `test-results/capturas/`. Rodam em 5 processos, porque com mais o `ng serve` não dá conta e os testes estouram o tempo. Um segundo `ng serve` (porta 4301), sem a simulação e com a API numa porta sem serviço, roda os testes `*sem-backend.spec.ts`: o erro com o servidor fora do ar. |
| `npm run lint` | ESLint (TypeScript e templates) e stylelint (SCSS). |
| `npm run build` | Build de produção em `dist/ecoponto/`. |
| `npm run icones` | Gera o sprite de ícones a partir de `icones/*.svg`. |

Acessibilidade e navegadores (FE-15):
- **Firefox:** antes do primeiro `npm run test:e2e`, rode `npx playwright install firefox` uma vez. O Chrome e o Edge são os instalados na máquina.
- **Varredura de cada tela, nas três larguras** (`e2e/fe-15-telas.spec.ts` e, com o servidor fora do ar ou respondendo erro, `e2e/fe-15-sem-backend.spec.ts`):
  - sem rolagem lateral nem texto cortado;
  - alvos de toque de 44 px no celular e no tablet;
  - o Tab do começo ao fim, com o foco visível e na ordem da tela;
  - o axe (`@axe-core/playwright`, WCAG 2.1 A e AA) sem nenhuma violação;
  - `e2e/fe-15-auditoria.spec.ts` põe um defeito de cada tipo na tela e confere que a varredura acusa todos.
- **Outros testes do FE-15:**
  - a jornada só com o teclado: buscar, filtrar, entrar e sugerir;
  - "reduzir movimento": só a opacidade muda;
  - a árvore de acessibilidade de Entrar, Busca e Sugerir.
- **Onde rodam:** no Chrome, no Firefox e no Edge (projetos `firefox-*` e `edge-*`). As capturas ficam em `test-results/capturas/fe-15/`.
- **Bateria inteira em outro navegador:**

  ```bash
  # Git Bash
  ECOPONTO_NAVEGADOR=firefox npx playwright test --project=celular --project=tablet --project=desktop --project=sem-backend
  ```

  ```powershell
  # PowerShell
  $env:ECOPONTO_NAVEGADOR = 'firefox'; npx playwright test --project=celular --project=tablet --project=desktop --project=sem-backend; Remove-Item Env:ECOPONTO_NAVEGADOR
  ```

  Use `msedge` no lugar de `firefox` para o Edge.
- **Registro:** os resultados e o roteiro do celular real e do leitor de tela (para a equipe preencher) ficam em [`../docs/registro-fe-15.md`](../docs/registro-fe-15.md).

## Estilos e tokens

- Os tokens ficam em `src/styles/tokens/` (cores, medidas, texto e movimento) como variáveis CSS. É o único lugar com valores escritos.
- Os nomes seguem as variáveis e os estilos do Figma, conferidos em 23/10/2026: `texto/secundário` vira `--cor-texto-secundario`, `controle/altura-m` vira `--controle-altura-m` e o estilo "Corpo/14 forte" vira `@include texto(corpo-14-forte)`. A página `/sistema` mostra todos, com o nome do Figma ao lado.
- Nas telas, use `@use 'abstratos' as *;`, só `var(--...)` e os mixins `texto()`, `a-partir-de()`, `pressionavel`, `realce-ao-passar`, `animar-entrada()`, `caixa-de-campo` e `alvo-de-toque` (área de toque de 44 px no celular para controles mais baixos). O stylelint recusa cor, espaço, raio, tamanho de texto e duração escritos direto, além de `@media` fora dos mixins. Nas telas, `transition` só vale para `opacity`, e `animation` não é permitido: o movimento vem dos mixins, que já respeitam "reduzir movimento".
- Use `@include texto(...)` como primeira linha da regra: o atalho `font` zera propriedades como `font-variant-numeric` declaradas antes dele.
- Pontos de quebra: celular abaixo de 768 px, tablet de 768 a 1023 px e desktop a partir de 1024 px. A coluna de conteúdo (`.conteudo`) tem até 1120 px. Margens: 16 px no celular e 32 px no tablet (T01), que usa o cabeçalho e a barra inferior do celular.
- Movimento: só `transform` e `opacity` animam. Com "reduzir movimento" ligado no sistema, tudo vira um esmaecer curto.
- Ícones: os 16 do quadro Ícones do Figma, desenhados em 24 px, e o símbolo da marca estão em `icones/`. Use `<eco-icone nome="busca" [tamanho]="16">`, em 14, 16, 20, 22 ou 24 px; o traço fica em 1,75 px em qualquer tamanho, como no Figma. Para trocar ou acrescentar um ícone, ponha o SVG na pasta e rode `npm run icones`.

## Componentes

Ficam em `src/app/compartilhado/` e chegam às telas pelo `CompartilhadoModule`. O `/catalogo` mostra cada um em todos os estados, com o nome da variante do Figma.

| Componente | Como usar |
| --- | --- |
| Botão | `<button eco-botao tipo="secundario" tamanho="p">`, também em `<a>`. Tipos `primario`, `secundario`, `texto` e `exclusao` (o vermelho, só para "Excluir ponto"); tamanhos `p`, `m` e `g`. |
| Campo de texto | `<eco-campo-texto rotulo="E-mail" tipo="email" [erro]="..." formControlName="email">` |
| Seletor | `<eco-seletor rotulo="Bairro" [opcoes]="..." formControlName="bairro">`, com teclado completo |
| Item de filtro | `<button eco-item-filtro [selecionado]="..." [contagem]="3">Papel e papelão</button>` |
| Chip de material | `<eco-chip-material rotulo="Vidro" [(ligado)]="...">`; com `variante="formulario"`, vira caixa de seleção |
| Etiqueta de status | `<eco-etiqueta-status status="PENDENTE">` |
| Linha de ponto | `<eco-linha-ponto [nome] [bairro] [endereco] [materiais] [rota]>`: cartão no celular e no tablet, linha no desktop |
| Abas | `<eco-abas rotulo="Painel" [abas]="..." [(selecionada)]="...">conteúdo da aba</eco-abas>`; a aba pode ter `contagem`, que o leitor de tela ouve como "Pendentes (2)" |
| Tabela do painel | `<eco-tabela [itens] [total] (mostrarMais)>`, com uma coluna por `<ng-template ecoColuna="Ponto" let-ponto>`. `[textoDoResumo]` troca o rodapé, `[itensSaindo]` esmaece as linhas que vão sair, e `[compacta]` dá as linhas de 61 px da D16 |
| Aviso | `AvisoService.mostrar('Ponto aprovado.')`; some em 4 s |
| Diálogo | `await DialogoService.confirmar({ titulo, texto, confirmar: 'Excluir ponto', tipo: 'exclusao' })` devolve `true` ou `false` |
| Formulário de ponto | `<eco-formulario-ponto [inicial]="dados" [enviarCom]="salvar" (enviado)="..." (cancelado)="...">`: os campos, a validação e o envio do D09, na sugestão (FE-10) e na edição (FE-13). Fica em `src/app/paginas/formulario-ponto/` |
| Barras | `<eco-barra-superior perfil="usuario" pagina="sugerir">`, `<eco-cabecalho-celular>` e `<eco-barra-inferior>` |

Provisório: a barra superior, a barra inferior, o aviso, o diálogo, as abas, o item de filtro e o menu aberto do seletor não foram lidos no Figma, porque a cota mensal do plano Starter do Figma acabou. Seguem os componentes que foram lidos, e os SCSS marcam esses valores com "PROVISÓRIO".

## API e respostas simuladas

Por padrão, o frontend chama o backend de verdade. As respostas simuladas só entram com `npm run start:simulacao`:

| Modo | Ambiente | `usarSimulacao` | Para onde vão as chamadas |
| --- | --- | --- | --- |
| `npm start` | `src/environments/environment.ts` | `false` | API real, pelo proxy do `ng serve` em `/api` |
| `npm run start:simulacao` | `src/environments/environment.simulacao.ts` | `true` | Simulação, que responde no navegador sem chegar ao backend |
| `npm run build` | `src/environments/environment.prod.ts` | `false` | API real em `/api`, na mesma origem das páginas |

O interceptor da simulação só é registrado quando `usarSimulacao` está ligado (`src/app/api/simulacao/provedores-da-simulacao.ts`). Com o backend fora do ar, o `npm start` mostra o erro na tela e não cai para a simulação. A página `/sistema` mostra o modo atual e testa a conexão com a API.

- O `ApiService` (`src/app/api/`) faz as chamadas e entrega as falhas como `ErroApi`, com a mensagem pronta para a tela.
- O contrato da API está em [`../docs/api/`](../docs/api/README.md) (BE-02): o `openapi.yaml` e um caso por arquivo em `exemplos/`. O erro vem como `{ "codigo": "...", "mensagem": "...", "campos": { "nome": "..." } }`. A lista `erros: [{ "campo", "mensagem" }]` também é aceita, mas o contrato não a usa.
- O `src/app/api/simulacao/contrato.spec.ts` passa cada caso de `../docs/api/exemplos/` pela simulação e exige a mesma resposta. Quem muda a simulação ou o contrato muda os dois juntos.
- As respostas simuladas ficam em `src/app/api/simulacao/`, com os dados de `../db/ecoponto.sql`. Hoje cobrem `GET /api/bairros`, `GET /api/categorias`, `GET /api/pontos` (os 13 aprovados, com filtros e páginas), `GET /api/pontos/contagem` (total e quantidade por material, com o filtro de bairro), `GET /api/pontos/{id}` (o detalhe; pendente dá 404, exceto para o ADMIN), `POST /api/pontos` (a sugestão, que nasce PENDENTE com quem entrou como autor e fica guardada enquanto a aba estiver aberta), `GET /api/minhas-sugestoes` (só as de quem entrou, com o filtro `status`), `GET /api/admin/resumo`, `GET /api/admin/pontos` (com `status`: a fila de pendentes do mais antigo para o mais novo; os aprovados por bairro e nome), `POST /api/admin/pontos/{id}/aprovar` e `/recusar` (409 se já decidido), `PUT /api/admin/pontos/{id}` (as regras do formulário; status e autor do corpo não contam) e `DELETE /api/admin/pontos/{id}` (204; 404 se já excluído), `GET /api/admin/categorias` (com os pontos aprovados de cada uma), `POST /api/admin/categorias` e `PUT /api/admin/categorias/{id}` (nome obrigatório até 60, descrição até 255; nome repetido, 409); todo o prefixo `/api/admin` dá 401 sem login e 403 para USUARIO; `POST /api/auth/cadastro`, `login` e `logout` e `GET /api/auth/eu`. Os formatos da lista de pontos, `{ itens, total, pagina, tamanho }`, e da contagem, `{ total, categorias: [{ idCategoria, quantidade }] }`, são os do contrato. Rota sem simulação responde 404.
- Contas na simulação: as 3 contas de teste do script (`admin@example.com`, `maria.souza@example.com` e `joao.pereira@example.com`) entram com qualquer senha de 8 ou mais caracteres. Uma conta criada pela tela Criar conta exige a senha cadastrada e só dura até recarregar a página. Quem entrou fica no `sessionStorage` da aba (só o usuário, nunca a senha), no lugar do cookie do backend; por isso a sessão sobrevive a recarregar. E-mail das contas do script no Criar conta dá o erro de e-mail repetido.

## Avisos

- O Angular 14 está sem suporte desde novembro de 2023. O `npm audit` aponta falhas corrigidas só em versões novas do Angular, entre elas XSS em atributos de SVG e MathML. Nunca ligue texto do usuário a atributos de SVG ou MathML, nem o insira como HTML.
- O `@types/node` fica fixo na versão 18.19.39: as versões novas exigem TypeScript 5, e o Angular 14 usa o 4.7.
- No VS Code, use o TypeScript do projeto. O `.vscode/settings.json` já aponta para ele; aceite "Usar a versão do workspace". Com o TypeScript embutido do editor, os testes mostram erros falsos.
- O repositório está no OneDrive. Se o `npm ci` der erro EPERM ou EBUSY, pause a sincronização durante a instalação.
