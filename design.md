# Manejo Campo — Design

Uso: smartphone no curral, sol forte, mão suja/luva, pressa. Tudo é decidido por legibilidade a 1 braço de distância.

## Cores (alto contraste, WCAG AAA no texto principal)
- `--campo-bg` #F4F1E6 — fundo papel claro (reduz ofuscamento vs branco puro)
- `--campo-ink` #0B0B0B — texto e bordas
- `--campo-mata` #0E3B2A — verde-escuro, cabeçalho e superfícies de destaque
- `--campo-pasto` #16A34A → usado como `#15803D` em fundos com texto branco
- `--campo-sol` #FFC800 — amarelo, ação primária (texto preto sobre amarelo)
- `--campo-alerta` #C81E1E — carência / erro (texto branco)
- `--campo-paper` #FFFFFF — cartões

Nunca usar cinza claro para texto. Texto secundário = #0B0B0B com opacidade mínima 75%.

## Tipografia
- Display: Barlow Condensed 700/800 — números (brinco, peso, GMD), títulos. Números com `tabular-nums`.
- Corpo: Barlow 500/600/700.
- Escala: brinco 64–72px, peso 56px, botões 22–24px, corpo mínimo 18px, rótulos 14px caixa alta 700.

## Componentes
- Bordas 3px pretas sólidas, cantos 14–18px, sombra dura deslocada (4px 4px 0 #0B0B0B) — leitura de "relevo" sem depender de cor.
- Alvo de toque mínimo 64px; botões de ação 96px+ de altura.
- Teclado numérico próprio (não depende do teclado do sistema): teclas 72px.
- Estado ativo: `translate(2px,2px)` + sombra reduzida, feedback tátil `navigator.vibrate`.

## Layout
- Coluna única, max-w 480px, padding 16px. Cabeçalho verde-escuro fixo com status de sincronização.
- Ações ancoradas na metade inferior (zona do polegar).
- Folhas inferiores (bottom sheets) para pesagem e sanitário.

## Padrões de UX
- Busca aceita brinco visual parcial ou RFID completo; leitor RFID tipo teclado (HID) digita + Enter e seleciona direto.
- Toda escrita é local primeiro (localForage) e entra na fila de sync; um selo mostra pendências.
- Confirmação por toast grande no topo, 2.5s.
