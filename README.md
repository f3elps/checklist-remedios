# Cuidi — Gestão de Remédios

Cuidi é um PWA pessoal de gestão de remédios. Permite cadastrar medicamentos, registrar doses do dia a dia e consultar o histórico de adesão ao tratamento. O objetivo é ser simples, rápido e funcionar offline.

## Stack

- **Vite + React + TypeScript** — build e desenvolvimento
- **Tailwind CSS + shadcn/ui** — estilização e componentes
- **Supabase** — banco de dados, autenticação e storage
- **vite-plugin-pwa** — suporte offline e instalação como app

## Comandos

```bash
npm install       # instala as dependências
npm run dev       # inicia o servidor de desenvolvimento
npm run test      # roda os testes (vitest)
npm run build     # compila para produção (tsc + vite build)
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Documentação

- **Especificações:** `docs/superpowers/specs/`
- **Planos de implementação:** `docs/superpowers/plans/`
- **Design (logo, tokens, guia visual):** `docs/design/`
