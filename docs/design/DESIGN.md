# Cuidi — Design System

Fonte da verdade da identidade visual do **Cuidi**, extraída fielmente do mockup gerado
no Claude design ([mockups/cuidi-mockup.html](mockups/cuidi-mockup.html)).

> **Nota de marca:** o mockup foi gerado com o nome de trabalho **"Remedinhos"**. O nome
> final é **Cuidi**. Onde o mockup mostra "Remedinhos" 💚, ler "Cuidi".

Arquivos relacionados:
- [theme.css](theme.css) — variáveis CSS prontas pra usar (é o entregável central)
- [tokens.json](tokens.json) — os mesmos tokens em formato legível por máquina
- [logo.svg](logo.svg) — marca (cápsula dentro de um coração, em `currentColor`)
- [mockups/cuidi-mockup.html](mockups/cuidi-mockup.html) — mockup React de referência (todas as telas)

---

## Personalidade

**"Cuidado calmo"** — confiável e tranquilizador, porém caloroso e humano. App afetivo de
cuidado com a saúde, não clínico frio. Acessível por padrão: contraste alto, fontes grandes,
alvos de toque generosos, cantos arredondados.

---

## Cor e theming

O sistema tem **dois eixos independentes**:

| Eixo | Como é controlado | Valores |
|---|---|---|
| **Tema (cor)** | atributo `data-theme` no `<html>` | `verde` (padrão), `azul`, `violeta`, `rosa`, `ambar`, `teal` |
| **Modo** | classe `.dark` no `<html>` | claro (sem classe) / escuro (`.dark`) |

Só o trio **`--primary` / `--primary-strong` / `--primary-soft`** (e `--surface-2` no claro)
muda por tema. Todo o resto (`--bg`, `--text`, `--surface`, `--amber`, `--error`…) é
compartilhado entre os temas e só muda entre claro/escuro. Persistir a escolha em
`profiles.theme_color` (slug do tema) e aplicar no boot.

### Tokens base — tema padrão **Verde Cuidado** (claro)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `hsl(150 40% 99%)` | fundo da tela |
| `--surface` | `#ffffff` | cards, superfícies |
| `--surface-2` | `hsl(160 30% 97%)` | superfícies secundárias (varia c/ tema) |
| `--text` | `hsl(200 15% 20%)` | texto principal |
| `--muted` | `hsl(200 12% 46%)` | texto secundário |
| `--border` | `hsl(200 14% 90%)` | bordas |
| `--primary` | `hsl(160 60% 40%)` | marca, botões, "Tomei" |
| `--primary-strong` | `hsl(160 60% 31%)` | hover/ênfase do primary |
| `--primary-soft` | `hsl(160 60% 95%)` | fundo suave do primary (chips, destaques) |
| `--on-primary` | `#ffffff` | texto sobre primary |
| `--amber` | `hsl(35 90% 48%)` | atenção/estoque (destaque quente) |
| `--amber-soft` | `hsl(40 95% 94%)` | fundo de avisos |
| `--error` | `hsl(0 70% 55%)` | erro, "pulado/perdido" |
| `--error-soft` | `hsl(0 80% 96%)` | fundo de erro |
| `--card-shadow` | `0 8px 24px -10px hsl(200 30% 40% / .2)` | sombra de card |

### Presets de tema (matiz/saturação/luminosidade do primary, modo claro)
| Tema | H | S | L | `--primary` |
|---|---|---|---|---|
| **Verde Cuidado** (padrão) | 160 | 60 | 40 | `hsl(160 60% 40%)` |
| Azul Sereno | 212 | 72 | 48 | `hsl(212 72% 48%)` |
| Violeta | 262 | 52 | 56 | `hsl(262 52% 56%)` |
| Rosa | 338 | 68 | 56 | `hsl(338 68% 56%)` |
| Âmbar | 35 | 90 | 48 | `hsl(35 90% 48%)` |
| Teal | 184 | 64 | 40 | `hsl(184 64% 40%)` |

### Modo escuro
Fundos frios escuros (`--bg: hsl(200 22% 10%)`), texto quase branco
(`--text: hsl(150 12% 93%)`), e o primary é **clareado** (`L+19`) e levemente mais saturado
(`S+6`) pra manter contraste. Valores completos em [theme.css](theme.css) / [tokens.json](tokens.json).

### Fórmulas de derivação (do mockup, caso precise recomputar)
```
claro:  --primary        = hsl(h, s%, l%)
        --primary-strong  = hsl(h, s%, max(l-9,18)%)
        --primary-soft    = hsl(h, min(s,72)%, 95%)
        --surface-2       = hsl(h, 30%, 97%)
escuro: --primary        = hsl(h, min(s+6,92)%, min(l+19,68)%)
        --primary-strong  = hsl(h, min(s+6,92)%, min(l+26,74)%)
        --primary-soft    = hsl(h, round(s*0.55)%, 19%)
```

---

## Tipografia

- **Família:** **Plus Jakarta Sans** (Google Fonts), fallback `system-ui, -apple-system, sans-serif`.
- **Pesos:** 400 / 500 / 600 / 700 / 800.
- **Base:** 16px, entrelinha generosa. Títulos 600–700 com `letter-spacing: -.02em`.
- Import já incluído no topo de [theme.css](theme.css).

---

## Forma, sombra, movimento

- **Raio:** `--radius: 1rem` (cards), `--radius-sm: .625rem` (inputs/chips), `--radius-lg: 1.5rem` (folhas/sheets).
- **Sombra:** `--card-shadow` (suave, difusa). Sem sombras pesadas.
- **Ícones:** estilo **lucide** (combina com shadcn). O mockup usa SVGs inline simples.
- **Movimento:** transições gentis (150–200ms). Feedback animado ao marcar "Tomei".

---

## Componentes observados no mockup

- **Card:** `--surface`, raio `--radius`, `--card-shadow`, padding generoso.
- **Botão primário:** `--primary` / texto `--on-primary`, hover `--primary-strong`.
- **Chip/badge de destaque:** fundo `--primary-soft` ou `--amber-soft`, texto forte.
- **Faixa de aviso (estoque baixo):** fundo `--amber-soft`, ícone/realce `--amber`.
- **Heatmap de adesão:** quadradinhos `13×13`, raio `3`, fundo `--surface-2` quando vazio e
  `--primary` quando há dose, com opacidade variável por nível (estilo "contribution graph").
- **Toggle de tema/modo:** seletor de presets (swatches coloridos) + switch claro/escuro.

---

## Telas e fluxo (confirmados no mockup)

1. **Entrar** — login, cadastro e recuperação de senha.
2. **Hoje** (home) — doses do dia com horário, botão "Tomei/Pular", destaque pra atrasadas,
   faixa de estoque baixo no topo.
3. **Meus remédios** — lista de cards com dose, posologia e estoque ("acaba em X dias"); CRUD.
4. **Adicionar/editar remédio** — formulário guiado.
5. **Histórico** — heatmap de adesão + filtro por remédio + exportar PDF.
6. **Configurações** — cor do tema, modo escuro, toggles de notificação, instalar na tela inicial.
7. **Onboarding / "Tela de Início"** — instrui adicionar o app à tela inicial (instalar PWA).

---

## Como ligar no app (Vite + React + shadcn/Tailwind)

1. Copiar [theme.css](theme.css) para `src/styles/theme.css` e importar no entrypoint.
2. No `<html>`, controlar `data-theme="<slug>"` (cor) e a classe `dark` (modo) — ler de
   `profiles.theme_color` e da preferência do usuário.
3. No `tailwind.config`, mapear cores para as variáveis:
   ```js
   theme: { extend: { colors: {
     bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
     text: 'var(--text)', muted: 'var(--muted)', border: 'var(--border)',
     primary: 'var(--primary)', 'primary-strong': 'var(--primary-strong)',
     'primary-soft': 'var(--primary-soft)', 'on-primary': 'var(--on-primary)',
     amber: 'var(--amber)', 'amber-soft': 'var(--amber-soft)',
     error: 'var(--error)', 'error-soft': 'var(--error-soft)',
   }, borderRadius: { DEFAULT: 'var(--radius)' }, fontFamily: { sans: 'var(--font-sans)' } } }
   ```
   > Como os valores já são `hsl(...)`/`#fff` completos (e não tripletas), use `var(--token)`
   > direto. Isso abre mão do modificador de opacidade do Tailwind (`bg-primary/50`) nesses
   > tokens — mas `--primary-soft/-strong` já cobrem os tons necessários. Se quiser os
   > modificadores depois, converter pra tripletas (`160 60% 40%`) e usar `hsl(var(--token))`.

---

## Ícones do PWA (a gerar)

Derivar de [logo.svg](logo.svg): `favicon.ico`, `apple-touch-icon.png` (180), e ícones
`192`, `512` e `512 maskable` para o manifest. (Tarefa de implementação.)
