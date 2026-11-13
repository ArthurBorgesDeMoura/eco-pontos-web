# Ícones exportados do Figma

Esta pasta guarda os ícones da página Sistema do Figma, um arquivo SVG por ícone, com nome em minúsculas e hífens (por exemplo `busca.svg` e `abrir-mapa.svg`).

Depois de pôr ou trocar um arquivo aqui, rode `npm run icones` dentro de `frontend/`. O comando gera o sprite `src/assets/icones.svg` e a lista de nomes `src/app/compartilhado/icone/nomes-icones.ts`, que o componente `<eco-icone>` usa. Não edite esses dois arquivos à mão.

O gerador troca as cores fixas por `currentColor` (o ícone herda a cor do texto). Ele só aceita elementos e atributos de desenho (caminho, forma, grupo, recorte, máscara e degradê) e recusa o resto: script, evento, imagem, `<style>`, animação, entidades, elementos com prefixo e qualquer link que não aponte para dentro do próprio arquivo.
