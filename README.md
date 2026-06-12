# Bolão da Copa 2026

Aplicativo React + Vite para organizar palpites, ranking e premiação do bolão.

## Rodar localmente

1. Instale as dependências:

```bash
npm ci
```

2. Crie um `.env.local` com base no `.env.example`.

3. Rode o app:

```bash
npm run dev
```

Se quiser testar sem encostar no banco de produção, use um projeto Firebase de
teste no `.env.local` ou rode com Firebase Emulator Suite:

```env
VITE_FIREBASE_EMULATOR_HOST="127.0.0.1:8080"
VITE_FIREBASE_AUTH_EMULATOR_URL="http://127.0.0.1:9099"
```

## Validar antes do deploy

```bash
npm run lint
npm run build
```

## Deploy na Vercel

Configure as variáveis `VITE_FIREBASE_*` na Vercel e publique as regras em
`firestore.rules` no Firebase. A lista de admins do front (`VITE_ADMIN_EMAILS`)
deve ser a mesma lista da função `adminEmails()` nas rules.

## Manutenção

- Para adicionar outro admin, coloque o e-mail em `VITE_ADMIN_EMAILS`, separado
  por vírgula, e repita o mesmo e-mail em `firestore.rules`.
- Para alterar os avatares disponíveis no cadastro manual, edite
  `src/config/avatars.ts`.
- Para cadastrar próximos jogos sem mexer em código, entre como admin e use
  `Painel ADM > Gerenciar jogos > Novo jogo`.
- Para corrigir nome, bandeira, data, horário, grupo, estádio ou cidade de uma
  partida, use `Painel ADM > Gerenciar jogos > Editar jogo`.
- Para alterar os jogos base usados na sincronização do admin, edite
  `src/data.ts`.
- O botão "Sincronizar jogos" no Painel ADM atualiza os jogos base do código e
  preserva jogos criados manualmente, participantes e palpites.
