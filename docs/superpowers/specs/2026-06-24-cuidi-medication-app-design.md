# Cuidi — Design / Spec do MVP

**Data:** 2026-06-24
**Autor:** Felipe Lara
**Status:** Aprovado para planejamento de implementação

---

## 1. Visão geral

**Cuidi** é um PWA (site instalável no celular, iOS/Android) para gestão pessoal de
medicamentos. Cada usuário cadastra seus remédios, recebe lembretes na hora da dose,
registra o que tomou, controla o estoque (com aviso antes de acabar) e acompanha a
adesão num gráfico exportável para mostrar ao médico.

- **Origem:** app pessoal feito como presente para a cunhada do autor; **sem fins
  comerciais**, mas pode ser divulgado para mais pessoas.
- **Restrição central:** rodar de forma confiável e **gratuita** (free tier de tudo).
- **Usuário-alvo:** adulto geral cuidando da própria saúde. Design acessível por padrão.
- **Custo operacional alvo:** **R$ 0/mês** (Supabase free + Vercel Hobby + Resend free).

### Decisões de produto fechadas
- **Notificações:** e-mail + Web Push do PWA. **WhatsApp fica fora do MVP** (fase 2,
  paga — exige WhatsApp Business API/Meta Cloud API; conversa com a usuária depois).
- **Perfis:** conta única — cada usuário gerencia apenas os próprios remédios.
- **Lembretes:** lembrar na hora da dose **e** registrar adesão para o gráfico.
- **Dispositivo principal:** iPhone (caso mais restritivo p/ push); projetar para os dois,
  com **e-mail como fallback garantido**.

---

## 2. Escopo

### No MVP
- Auth completo: cadastro, login, recuperação de senha (Supabase Auth).
- Medicamentos ilimitados: nome, forma/unidade (comprimido, ml, gota, aplicação…),
  dose por tomada, posologia (X vezes/dia · de Y em Y horas · horários fixos),
  estoque atual, data de início.
- Lembrete de dose na hora: Web Push (canal principal) + e-mail de reforço.
- Registro de adesão: marcar "Tomei" / "Pular" → alimenta o gráfico e dá baixa no estoque.
- Alerta de estoque baixo: avisa ~7 dias antes de acabar (e-mail + push), calculado pelo consumo.
- Histórico/gráfico de adesão (heatmap por dia/remédio) com **exportação em PDF**.
- Tema personalizável: trocar a cor primária do app (presets).
- PWA instalável com onboarding que ensina a "adicionar à tela inicial".

### Fora do MVP (fase 2 — anotado, não construído)
WhatsApp; múltiplos perfis/modo cuidador; relatórios avançados; integração com farmácia;
registro de sintomas. (YAGNI — adicionar somente se solicitado.)

---

## 3. Arquitetura

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  PWA (Vite + React + TS)    │         │  Supabase (free tier)            │
│  shadcn/ui · Tailwind       │  HTTPS  │  ┌────────────────────────────┐  │
│  TanStack Query · RHF/Zod   │────────▶│  │ Postgres + RLS por usuário │  │
│  vite-plugin-pwa (SW)       │         │  │  profiles, medications,    │  │
│  Web Push subscription      │         │  │  doses, push_subscriptions,│  │
│  jsPDF (export)             │         │  │  notification_log          │  │
└──────────────┬──────────────┘         │  └────────────┬───────────────┘  │
               │ hospedado em            │   pg_cron (~15 min) │ pg_net      │
               ▼ Vercel (Hobby)          │                ▼                 │
        usuária no celular               │  ┌────────────────────────────┐  │
                                         │  │ Edge Function "tick" (Deno)│  │
   Web Push  ◀──────────────────────────┼──┤  - materializa doses 24-48h│  │
   E-mail    ◀── Resend API ◀───────────┼──┤  - dispara lembretes/push  │  │
                                         │  │  - marca doses perdidas    │  │
                                         │  │  - 1x/dia: estoque baixo   │  │
                                         │  └────────────────────────────┘  │
                                         └──────────────────────────────────┘
```

### Stack (idêntico ao projeto `casa-gestao` do autor)
- **Frontend:** Vite + React + TypeScript, shadcn/ui (Radix), Tailwind CSS,
  TanStack Query, React Hook Form + Zod, date-fns, lucide-react.
- **PWA:** `vite-plugin-pwa` (service worker, manifest, ícones, prompt de instalação, offline básico).
- **Backend:** Supabase free — Postgres, Auth, Edge Functions (Deno), `pg_cron`, `pg_net`, Storage.
- **E-mail:** Resend (free: 100/dia, 3.000/mês).
- **Push:** Web Push API com chaves VAPID + lib `web-push` na Edge Function.
- **Hospedagem:** Vercel (Hobby), deploy automático do repo.
- **Erros:** Sentry (free) — opcional.
- **Export PDF:** `jspdf` + `html2canvas` no cliente (sem backend).
- **Repo:** este (`checklist-remedios`) — `/src` (app) + `/supabase` (migrations + functions).

---

## 4. Modelo de dados (Postgres + RLS `user_id = auth.uid()`)

### `profiles` (estende `auth.users`)
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | = auth uid |
| display_name | text | |
| theme_color | text | slug do preset (ex.: `verde`) |
| timezone | text | default `America/Sao_Paulo` |
| email_enabled | bool | default true |
| push_enabled | bool | default true |
| created_at | timestamptz | |

### `medications`
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | RLS |
| name | text | |
| unit | text | comprimido \| ml \| gota \| aplicacao… |
| dose_amount | numeric | qtd por tomada (na mesma `unit`) |
| schedule_type | text | `vezes_por_dia` \| `de_x_em_x_horas` \| `horarios_fixos` |
| schedule_config | jsonb | ex.: `{"times":["08:00","20:00"]}` ou `{"interval_hours":8}` ou `{"per_day":3}` |
| stock_quantity | numeric | estoque atual (na mesma `unit`) |
| start_date | date | |
| active | bool | default true |
| notes | text | |
| created_at | timestamptz | |

### `doses` (agenda + registro de adesão — fonte do gráfico)
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| medication_id | uuid FK | |
| user_id | uuid FK | RLS |
| scheduled_at | timestamptz | momento previsto |
| status | text | `pendente` \| `tomado` \| `pulado` \| `perdido` |
| taken_at | timestamptz | quando marcou "Tomei" |
| created_at | timestamptz | |

Índice único `(medication_id, scheduled_at)` para idempotência da materialização.

### `push_subscriptions`
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | RLS |
| endpoint | text | |
| keys | jsonb | `{p256dh, auth}` |
| created_at | timestamptz | |

### `notification_log` (dedupe de avisos)
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | RLS |
| medication_id | uuid FK | nullable |
| dose_id | uuid FK | nullable |
| type | text | `lembrete_dose` \| `estoque_baixo` |
| channel | text | `push` \| `email` |
| sent_at | timestamptz | |

---

## 5. Lógica de domínio

### Materialização de doses
A Edge Function `tick` gera linhas em `doses` para as próximas 24–48h de cada
`medication` ativo, a partir do `schedule_config`, no fuso do `profiles.timezone`.
O índice único `(medication_id, scheduled_at)` impede duplicatas.

### Depleção de estoque
- consumo diário = `dose_amount × (nº de doses por dia derivado de schedule_config)`
- `dias_restantes = floor(stock_quantity / consumo_diário)`
- alerta de estoque baixo quando `dias_restantes ≤ 7` **e** não houver `notification_log`
  do tipo `estoque_baixo` ainda válido para aquele remédio.
- Ao marcar **"Tomei"**, decrementa `stock_quantity` em `dose_amount`. ("Pular" não decrementa.)

### Ciclo de notificação (Edge Function `tick`, via `pg_cron` ~15 min)
1. Materializa doses futuras (24–48h).
2. Seleciona doses `pendente` com `scheduled_at` dentro da janela atual → envia
   **push** (se `push_enabled` e houver subscription) + **e-mail** (se `email_enabled`);
   registra em `notification_log`.
3. Marca como `perdido` doses `pendente` cujo `scheduled_at` já passou da tolerância (ex.: +2h).
4. Uma vez ao dia: recalcula `dias_restantes` de cada remédio e dispara `estoque_baixo`
   quando `≤ 7`, com dedupe.

### Fuso horário
Todos os cálculos de horário usam `profiles.timezone` (default `America/Sao_Paulo`),
para que "08:00" signifique 8h locais da usuária.

---

## 6. Telas (mobile-first)

1. **Entrar** — login / cadastro / "esqueci a senha" (Supabase Auth).
2. **Hoje** (home) — doses do dia com horário e botão "Tomei/Pular"; destaque para
   doses atrasadas; faixa de aviso de estoque baixo no topo.
3. **Meus remédios** — lista de cards (ilimitada) com nome, dose, posologia e
   "estoque: 12 comprimidos · acaba em 6 dias"; CRUD.
4. **Adicionar/editar remédio** — formulário guiado.
5. **Histórico/Gráfico** — heatmap de adesão por dia, filtro por remédio,
   botão **Exportar PDF**.
6. **Configurações** — seletor de cor do tema, toggles de notificação (e-mail/push),
   instruções de instalar na tela inicial, conta/sair.
7. **Onboarding curto** — instalar PWA + permissão de notificação + criar 1º remédio.

---

## 7. Identidade visual

**Marca:** **Cuidi** (de "cuidar"). Direção **"Cuidado calmo"** — confiável e
tranquilizador, porém caloroso e humano; acessível por padrão (contraste AA, fontes
grandes, alvos de toque generosos).

**Logo/ícone:** comprimido/cápsula estilizado dentro de um coração arredondado, na cor
primária. Favicon + ícones PWA (192, 512, maskable) + apple-touch-icon derivados dele.

### Cores (formato shadcn, HSL) — tema padrão "Verde Cuidado"
| Token | Light | Uso |
|---|---|---|
| `--background` | `150 40% 99%` | fundo |
| `--foreground` | `200 15% 20%` | texto |
| `--primary` | `160 60% 40%` | marca / botões / "Tomei" |
| `--primary-foreground` | `0 0% 100%` | texto sobre primary |
| `--muted` | `150 20% 95%` | fundos secundários |
| `--accent` | `35 90% 55%` | destaques (âmbar) |
| `--destructive` | `0 70% 55%` | "pulado/perdido", erros |
| `--border` | `150 15% 90%` | bordas |
| `--radius` | `1rem` | cantos arredondados |

**Presets de tema (trocam apenas `--primary`):** Verde Cuidado `160 60% 40%` (padrão) ·
Azul Sereno `210 80% 55%` · Violeta `265 60% 58%` · Rosa `340 70% 60%` ·
Âmbar `35 90% 55%` · Teal `185 65% 42%`. **Dark mode** incluído. Persistido em
`profiles.theme_color`; aplicado via `data-theme` no `<html>`.

### Tipografia
**Plus Jakarta Sans** para tudo (fallback de sistema). Base 16–17px, entrelinha
generosa, títulos peso 600–700.

### Forma & movimento
Cards `rounded-2xl`, sombras suaves, botões grandes, ícones lucide, transições gentis
(150–200ms), feedback animado ao marcar "Tomei".

### Entregáveis de design (gerados no Claude design e integrados ao repo)
| Arquivo | Formato | Papel |
|---|---|---|
| `docs/design/DESIGN.md` | Markdown | Fonte da verdade da identidade |
| `docs/design/tokens.json` | JSON | Tokens legíveis por máquina |
| `src/styles/theme.css` | CSS | Variáveis CSS shadcn (`:root`, `.dark`, `[data-theme]`) — **entregável central** |
| `public/icons/` | PNG/SVG | Ícones PWA + favicon + apple-touch-icon |

O prompt pronto para gerar o design system e os mockups está registrado na conversa de
brainstorming (trocar "Remedinhos" por "Cuidi").

---

## 8. Tratamento de erros e casos de borda

- **Push indisponível (iOS sem instalar / permissão negada):** e-mail é o fallback
  garantido; o app mostra estado claro de "notificações por push desativadas" e como ativar.
- **Cron sobreposto / reenvio:** `notification_log` + índice único garantem idempotência.
- **Falha de envio (Resend/Push):** registrar erro (Sentry) e não bloquear o `tick`;
  tentar novamente no próximo ciclo.
- **Estoque que não bate com a realidade:** usuário pode editar `stock_quantity` a qualquer
  momento; baixa é sempre baseada em "Tomei".
- **Mudança de posologia:** editar o remédio re-materializa doses futuras (não altera passado).
- **Fuso/horário de verão:** cálculos sempre via timezone nomeado, nunca offset fixo.
- **Permissões/RLS:** toda tabela com RLS estrita por `auth.uid()`.

---

## 9. Estratégia de testes

- **Unit (Vitest):** lógica de depleção de estoque, derivação de "doses por dia" a partir
  de `schedule_config`, cálculo de `dias_restantes`, geração de `scheduled_at` por fuso.
- **Componentes (Vitest + Testing Library):** formulário de remédio (validação Zod),
  ação "Tomei/Pular", troca de tema.
- **Edge Function:** testes da lógica de materialização e seleção de doses "na hora"
  (entradas determinísticas com relógio injetado).
- **Manual/E2E leve:** fluxo de auth, instalação PWA no iOS/Android, recebimento de
  push e e-mail, exportação de PDF.

---

## 10. Infra / custo

| Serviço | Plano | Limite relevante | Custo |
|---|---|---|---|
| Supabase | Free | Postgres + Auth + Edge Functions + pg_cron | R$ 0 |
| Vercel | Hobby | hospedagem do PWA + deploy automático | R$ 0 |
| Resend | Free | 100 e-mails/dia · 3.000/mês | R$ 0 |
| Web Push | — | VAPID, sem custo | R$ 0 |
| Sentry | Free | (opcional) | R$ 0 |

**Opcionais futuros:** domínio próprio (~R$ 40/ano); WhatsApp via Meta Cloud API/Twilio
(fase 2, pago).

---

## 11. Fase 2 (registrado, fora do MVP)
WhatsApp; modo cuidador / múltiplos perfis; relatórios e estatísticas avançadas;
registro de sintomas/efeitos; lembrete de consulta; backup/exportação de dados completa.
