# Bolao da Copa 2026

Aplicativo React + Vite para organizar palpites, ranking, conferencia publica e
premiacao do bolao.

## Rodar localmente

1. Instale as dependencias:

```bash
npm ci
```

2. Crie um `.env.local` com base no `.env.example`.

3. Rode o app:

```bash
npm run dev
```

Se quiser testar sem encostar no banco de producao, use um projeto Firebase de
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

Configure as variaveis `VITE_FIREBASE_*` na Vercel e publique as regras em
`firestore.rules` no Firebase. A lista de admins do front (`VITE_ADMIN_EMAILS`)
deve ser a mesma lista da funcao `adminEmails()` nas rules.

Importante: `VITE_ADMIN_EMAILS` libera somente a aba admin no front. Quem libera
escrita no banco e o arquivo `firestore.rules`. Depois de adicionar um admin na
Vercel, adicione o mesmo e-mail em `adminEmails()` e rode `npm run deploy:rules`,
ou marque o documento `players/{uid}` dessa pessoa com `isAdmin: true` e
`email: "email-da-pessoa"` depois que as rules atualizadas estiverem publicadas.

O app nao usa fallback de Firebase em producao. Se alguma variavel obrigatoria
faltar na Vercel, o app acusa erro em vez de conectar em outro projeto.

Depois de editar `firestore.rules`, publique as regras no Firebase:

```bash
npm run deploy:rules
```

Sem publicar essas rules, qualquer pessoa com o config publico do Firebase pode
tentar escrever direto no Firestore. Publique as rules antes de liberar o link
para os participantes.

## Manutencao

- Para adicionar outro admin, coloque o e-mail em `VITE_ADMIN_EMAILS`, separado
  por virgula, e repita o mesmo e-mail em `firestore.rules`.
- Ao cadastrar jogos manualmente no Firestore, os campos que controlam o site
  sao `date`, `time`, `startsAt` e `startsAtMs`. `createdAt` e `updatedAt` em
  jogos nao mudam a data exibida nem a trava de palpites.
- Ao cadastrar palpites manualmente, use `players/{playerId}.predictions.{matchId}`
  com `scoreA`, `scoreB`, `createdAt` e `updatedAt`. As datas podem ser ISO
  string, `Date`, timestamp em milissegundos/segundos ou Timestamp nativo do
  Firestore.
- Para alterar os avatares disponiveis no cadastro manual, edite
  `src/config/avatars.ts`.
- Para cadastrar proximos jogos sem mexer em codigo, entre como admin e use
  `Painel ADM > Gerenciar jogos > Novo jogo`.
- Para corrigir nome, bandeira, data, horario, grupo, estadio ou cidade de uma
  partida, use `Painel ADM > Gerenciar jogos > Editar jogo`.
- Para alterar os jogos base usados na sincronizacao do admin, edite
  `src/data.ts`.
- O botao "Sincronizar jogos" no Painel ADM atualiza os jogos base do codigo e
  preserva jogos criados manualmente, participantes e palpites.
- Para migrar pontos antigos que nao vierem de palpites/jogos cadastrados, use
  `Painel ADM > Ajuste manual de pontos`. Nao edite `points` manualmente: o
  front recalcula esse campo a partir dos jogos finalizados e soma o ajuste
  manual.
- Para travar palpites com seguranca, cada jogo deve ter `startsAtMs` com o
  horario de inicio em milissegundos UTC. Jogos cadastrados pelo Painel ADM ja
  recebem esse campo automaticamente.
