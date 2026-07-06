# Contexto atual do projeto para outro ChatGPT

Use este arquivo como contexto base ao pedir ajuda sobre o projeto. Ele descreve
o estado atual do app, a migracao de banco, o deploy, as regras de negocio e os
pontos que nao devem ser desfeitos.

## Prompt pronto para colar

```text
Estou trabalhando em um app React + Vite + TypeScript chamado Bolao da Copa
2026. Ele usa Firebase Auth com Google, Cloud Firestore e deploy na Vercel.

O app ja esta em fase de migracao para um novo Firebase. O banco antigo e apenas
fonte de importacao; o app em producao deve apontar para o banco novo.

Antes de sugerir mudancas, leia este contexto e preserve estas decisoes:
- Nao duplicar player quando o usuario entra com Google e o mesmo email ja
  existe em `players`.
- Se existir player importado com o mesmo email, usar esse player como principal,
  principalmente se ele tiver mais palpites.
- O usuario autenticado pode atualizar um player legado pelo mesmo email, mas
  somente campos seguros e somente um palpite aberto por vez, conforme
  `firestore.rules`.
- Ranking, pontos e premios sao recalculados no front; nao tratar `points` como
  fonte da verdade.
- Jogos precisam manter `startsAtMs`, pois o front e as Firestore Rules usam
  esse campo para travar palpites.
- Em producao, `VITE_FIREBASE_AUTH_DOMAIN` deve ser o dominio da Vercel
  (`bolaodacopao.vercel.app`) por causa do proxy de auth em `vercel.json`.

Minha tarefa agora:
[descreva o bug ou melhoria aqui]
```

## Estado do projeto em 2026-06-23

- Stack: React 19, Vite 6, TypeScript, Firebase 12, Firestore, Firebase Auth,
  Tailwind, lucide-react, motion.
- URL publica: `https://bolaodacopao.vercel.app/`.
- Repo preview/desenvolvimento: `SKYRONN-gif/bolaodacopa_preview`.
- Repo producao: `SKYRONN-gif/bolaodacopa`.
- Remotes locais:
  - `origin` aponta para `https://github.com/SKYRONN-gif/bolaodacopa_preview`
  - `prod` aponta para `https://github.com/SKYRONN-gif/bolaodacopa.git`
- Branch local atual no momento deste contexto: `codex/fix-login-email`.
- Essa branch tem dois commits importantes em cima de `prod/main`:
  - `81d072f Prefere player importado com palpites no login`
  - `6cd98f1 Adiciona proxy de auth para Vercel`
- Se esses commits ainda nao estiverem no `main`, abrir/mergear PR da branch
  `codex/fix-login-email` no repo `bolaodacopa`.

## Firebase e Vercel

### Banco novo, destino final

Projeto Firebase novo:

- `projectId`: `bolaodacopa-90a57`
- `authDomain` nativo Firebase: `bolaodacopa-90a57.firebaseapp.com`
- `storageBucket`: `bolaodacopa-90a57.firebasestorage.app`

Na Vercel do site em producao, as variaveis `VITE_FIREBASE_*` devem apontar
para esse Firebase novo.

Importante para producao:

```env
VITE_FIREBASE_AUTH_DOMAIN=bolaodacopao.vercel.app
```

Nao usar em producao:

```env
VITE_FIREBASE_AUTH_DOMAIN=bolaodacopa-90a57.firebaseapp.com
```

Motivo: no iPhone/WhatsApp o login Google pode quebrar com erro de
`missing initial state` se o fluxo sair para o dominio `firebaseapp.com`. O repo
tem `vercel.json` com rewrites para `__/auth` e `__/firebase`, entao o Firebase
Auth pode rodar sob o dominio da Vercel.

`vercel.json` atual:

```json
{
  "rewrites": [
    {
      "source": "/__/auth/:path*",
      "destination": "https://bolaodacopa-90a57.firebaseapp.com/__/auth/:path*"
    },
    {
      "source": "/__/firebase/:path*",
      "destination": "https://bolaodacopa-90a57.firebaseapp.com/__/firebase/:path*"
    }
  ]
}
```

No Firebase Auth, o dominio `bolaodacopao.vercel.app` deve estar em
Authentication > Settings > Authorized domains. Se aparecer erro de
`redirect_uri_mismatch`, conferir no Google Cloud OAuth se existe:

```text
https://bolaodacopao.vercel.app/__/auth/handler
```

### Banco antigo, fonte de migracao

Projeto Firebase antigo:

- `projectId`: `testebolao2`
- `authDomain`: `testebolao2.firebaseapp.com`

Ele deve ser usado somente pelas variaveis `VITE_OLD_FIREBASE_*` para importar
dados para o banco novo. O app em producao nao deve apontar para ele como banco
principal.

Nao compartilhar `API_FOOTBALL_KEY`, service accounts ou tokens privados com o
ChatGPT. As configs web do Firebase aparecem no front, mas ainda assim e melhor
ocultar `apiKey` quando nao for necessario.

## Arquitetura principal

- `src/App.tsx`: estado global, login, escolha/criacao do player, salvamento de
  perfil e palpite, abas, modo offline.
- `src/firebase.ts`: inicializacao Firebase via variaveis `VITE_FIREBASE_*`.
- `src/types.ts`: contratos de `Match`, `Player`, `Prediction`,
  `ChampionPickSettings` e `ChampionPick`.
- `src/services/playersService.ts`: snapshot de players, `savePlayer`,
  `savePlayerPrediction`, `consolidatePlayerDuplicates`.
- `src/services/matchesService.ts`: snapshot e escrita de jogos.
- `src/services/legacyMigrationService.ts`: preview/importacao do banco antigo.
- `src/services/firestoreNormalizers.ts`: normaliza dados vindos do Firestore.
- `src/domain/scoring.ts`: pontuacao e ranking.
- `src/domain/playerMerge.ts`: merge/consolidacao de players duplicados por
  email.
- `src/domain/matchFilters.ts`: filtros e contagens da tela Jogos.
- `src/domain/rules.ts`: trava de palpite no front.
- `src/domain/finance.ts`: taxa, pote e premios 80/20.
- `src/domain/awards.ts`: medalhas/premios visuais.
- `src/features/matches/*`: cards, filtros, inputs e modal de jogos.
- `src/features/leaderboard/*`: ranking, premios, auditoria de palpites.
- `src/features/admin/*`: formularios admin, migracao, ajustes e jogos.
- `firestore.rules`: seguranca real do banco.

## Modelo de dados no Firestore

### `matches/{matchId}`

```ts
{
  id: string;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string;
  time: string;
  startsAt: string;
  startsAtMs: number;
  status: "scheduled" | "finished";
  scoreA?: number;
  scoreB?: number;
  group: string;
  venue?: string;
  city?: string;
  apiFixtureId?: string;
  logoA?: string | null;
  logoB?: string | null;
  source?: string;
}
```

`startsAtMs` e obrigatorio para travar palpite nas rules. Jogo `finished`
precisa de `scoreA` e `scoreB`.

### `players/{playerId}`

```ts
{
  id: string;
  name: string;
  avatar: string;
  email: string;
  isAdmin: boolean;
  predictions: {
    [matchId: string]: {
      scoreA: number;
      scoreB: number;
      createdAt?: string;
      updatedAt?: string;
    }
  };
  points: number;
  exactHits: number;
  partialHits: number;
  errorHits: number;
  manualPointsAdjustment?: number;
  manualPointsAdjustmentUpdatedAt?: string;
  lastPredictionMatchId?: string;
}
```

`points`, `exactHits`, `partialHits` e `errorHits` sao recalculados no front.
Nao devem ser editados como fonte de verdade.

### `settings/championPick`

Configuracao do palpite de campeao:

```ts
{
  enabled?: boolean;
  locked?: boolean;
  bonusPoints?: number;
  championTeamCode?: string;
  eligibleTeams?: ChampionPickTeam[];
  eligibleTeamCodes?: string[];
  updatedAt?: string;
}
```

### `championPicks/{playerEmail}`

Palpite unico por email de jogador. Usuario comum pode criar se:

- esta autenticado e email verificado;
- `playerEmail` do documento bate com o email autenticado;
- configuracao esta `enabled == true` e `locked == false`;
- time escolhido esta em `eligibleTeamCodes`.

## Login e players importados

O login usa Firebase Auth com Google (`signInWithPopup`). Depois que o usuario
autentica:

1. O app espera a lista de `players` carregar do Firestore.
2. Procura `playerByUid` usando `currentUser.uid`.
3. Procura `playersWithSameEmail` comparando email normalizado.
4. Escolhe `playerByEmail` com mais palpites.
5. Se o player por email tiver mais palpites que o player por UID, ele usa o
   player por email como principal.
6. Se nao existir nada, cria um novo player pelo UID do Auth.

Esse comportamento e intencional. Se uma pessoa importada entra com Google pelo
mesmo email, nao deve criar duplicado em `players`. Ela deve usar o documento
importado. Duplicados so aparecem para consolidar quando ja existem dois ou mais
docs com o mesmo email.

Caso real validado: uma pessoa conseguiu entrar e nao duplicou o email no banco.
Isso e esperado, desde que ela consiga salvar palpite no mesmo player importado.

## Merge e consolidacao de duplicados

Arquivo principal: `src/domain/playerMerge.ts`.

Regras:

- Email e normalizado com `trim().toLowerCase()`.
- Merge de predictions preserva todos os jogos.
- Se dois docs tem palpite para o mesmo jogo, fica o palpite mais recente por
  `updatedAt` ou `createdAt`.
- `mergePlayersKeepingPrimary` preserva o player principal e mescla campos
  faltantes.
- `buildDuplicatePlayerPlans` gera os planos de consolidacao por email.
- Primary default: preferido por ID, senao admin, senao quem tem mais palpites.
- Admin usa `consolidatePlayerDuplicates`, que grava o player mesclado e apaga
  os duplicados em batch.

Fluxo esperado da migracao:

1. Importar dados do banco antigo para o banco novo.
2. Conferir se existem duplicados por email.
3. Clicar em "Consolidar duplicados por e-mail".
4. Confirmar que ficou um player por email.
5. Confirmar que `predictions` ficaram no player principal.
6. Confirmar que ranking nao duplicou ninguem.
7. Confirmar que premio nao aumentou indevidamente.

## Migracao do banco antigo

Arquivo: `src/services/legacyMigrationService.ts`.

Ele usa variaveis:

```env
VITE_OLD_FIREBASE_API_KEY=...
VITE_OLD_FIREBASE_AUTH_DOMAIN=...
VITE_OLD_FIREBASE_PROJECT_ID=...
VITE_OLD_FIREBASE_STORAGE_BUCKET=...
VITE_OLD_FIREBASE_MESSAGING_SENDER_ID=...
VITE_OLD_FIREBASE_APP_ID=...
VITE_OLD_FIREBASE_DATABASE_ID=(default)
```

Funcoes principais:

- `previewLegacyBolaoData()`: le `matches` e `players` do banco antigo e retorna
  contagens.
- `importLegacyBolaoData()`: importa `matches` e `players` para o banco novo.
- A importacao usa `set(..., { merge: true })`.
- Se um player antigo tem o mesmo ID de um player atual, ele mescla com
  `mergePlayersKeepingPrimary(currentPlayer, legacyPlayer)` para nao apagar
  palpites novos do banco destino.

## Regras de seguranca do Firestore

Arquivo: `firestore.rules`.

Pontos importantes:

- `verifiedUser()` exige login e `email_verified == true`.
- Admin e liberado por:
  - email em `adminEmails()`; ou
  - documento `players/{uid}` com `isAdmin: true` e email igual ao Auth.
- `matches`: leitura publica; create/update/delete so admin.
- `players`: leitura publica.
- Usuario comum pode criar apenas seu proprio doc por UID, com campos seguros,
  sem admin e sem pontos manuais.
- Usuario comum pode atualizar:
  - o proprio `players/{uid}`; ou
  - um player legado quando `resource.data.email == request.auth.token.email`.
- Esse acesso legado e limitado por `ownerUpdateIsSafe`:
  - nao pode mudar ID, admin, pontos, hits ou ajuste manual;
  - pode mudar nome/avatar/email em casos seguros;
  - pode salvar apenas um palpite por vez;
  - `lastPredictionMatchId` precisa bater com a chave alterada;
  - o jogo precisa estar aberto (`status == scheduled` e
    `request.time.toMillis() < startsAtMs`).
- `championPicks`: usuario cria apenas o proprio palpite por email, uma vez, se
  a configuracao estiver aberta.

Se alguem tiver `Missing or insufficient permissions` ao salvar palpite, conferir:

1. Email do Auth igual ao campo `players/{id}.email`.
2. Campo `lastPredictionMatchId` sendo salvo junto.
3. Jogo com `status: "scheduled"` e `startsAtMs` no futuro.
4. `firestore.rules` publicado no projeto `bolaodacopa-90a57`.
5. App realmente apontando para o Firebase novo na Vercel.

## Pontuacao, ranking e premios

Arquivo: `src/domain/scoring.ts`.

Regras:

- Placar exato: 3 pontos.
- Acertou vencedor ou empate: 1 ponto.
- Errou: 0 pontos.
- Jogo sem resultado ou sem palpite: nao conta como ponto.
- Ranking soma `manualPointsAdjustment`.
- Desempate:
  1. mais pontos;
  2. mais acertos exatos;
  3. nome em ordem alfabetica.

Arquivo: `src/domain/finance.ts`.

- Taxa por participante: R$ 10.
- Admin nao entra no pote.
- Primeiro lugar: 80%.
- Segundo lugar: 20%.

Arquivo: `src/domain/awards.ts`.

Medalhas/awards visuais:

- Maior acerto: mais placares exatos.
- Sequencia quente: maior sequencia pontuando.
- Zicado do momento: mais palpites errados enviados.
- Quase la: palpites que passaram perto, mas nao exatos.

## Filtros da tela Jogos

Arquivo: `src/domain/matchFilters.ts`.

Filtros esperados:

- `open`: jogos `scheduled` que ainda nao travaram.
- `missing`: jogos abertos sem palpite salvo.
- `predicted`: jogos com palpite salvo, mesmo se ja travaram.
- `locked`: jogos travados que ainda nao finalizaram.
- `finished`: jogos com resultado/status finalizado.
- `all`: todos.

As contagens devem bater com essas mesmas regras.

## Fluxo normal de usuario a validar

Com usuario comum, nao admin:

1. Abrir `https://bolaodacopao.vercel.app/`.
2. Entrar com Google.
3. Ir para Jogos.
4. Confirmar que abre em "Abertos".
5. Fazer um palpite.
6. Ver estado "Alteracao nao salva".
7. Clicar em salvar.
8. Ver "Salvando...".
9. Ver "Palpite salvo".
10. Atualizar a pagina.
11. Ver "Atualizado em...".
12. Alterar o palpite de novo.
13. Confirmar no Firestore que o mesmo `players/{playerId}` foi atualizado.

Se o usuario ja existia importado com o mesmo email, nao deve criar novo doc
duplicado em `players`.

## Scripts de teste

`package.json`:

```bash
npm run lint
npm run build
npm run test:unit
npm run test:migration
npm run test:volume
npm run test:resilience
npm run test:browsers
npm run test:all
```

O `test:all` roda:

```bash
tsx scripts/unitRegressionTest.tsx
tsx scripts/migrationConsolidationTest.ts
tsx scripts/dataVolumeTest.ts
tsx scripts/dataResilienceTest.ts
tsc --noEmit
vite build
```

Testes importantes ja existentes:

- `scripts/unitRegressionTest.tsx`:
  - scoring exato/parcial/erro;
  - ranking e desempate;
  - premios 80/20;
  - filtros e contagens;
  - trava de palpite;
  - estados do card: "Alteracao nao salva", "Salvando palpite",
    "Palpite salvo", "Atualizado em".
- `scripts/migrationConsolidationTest.ts`:
  - merge de players por email;
  - manter predicao mais recente;
  - consolidar duplicados;
  - ranking sem duplicar email;
  - premio nao aumentar por duplicados crus;
  - merge de player antigo com mesmo ID preservando dados novos.
- `scripts/dataVolumeTest.ts`:
  - volume/estrutura de dados.
- `scripts/dataResilienceTest.ts`:
  - tolerancia a dados antigos/incompletos.
- `scripts/browserSmokeTest.ts`:
  - teste de navegador.

Validacao recente antes deste contexto:

- TypeScript passou com `tsc --noEmit`.
- Build Vite passou.
- O aviso de chunk grande do Vite existe, mas nao bloqueia build.

## Quando pedir ajuda, quais arquivos mandar

Bug de login/player duplicado:

- `src/App.tsx`
- `src/domain/playerMerge.ts`
- `src/services/playersService.ts`
- `firestore.rules`
- `vercel.json`

Bug de permissao ao salvar palpite:

- `src/App.tsx`
- `src/services/playersService.ts`
- `src/domain/rules.ts`
- `firestore.rules`
- um exemplo do documento `players/{id}` e `matches/{matchId}` sem dados
  sensiveis demais.

Bug de migracao/consolidacao:

- `src/services/legacyMigrationService.ts`
- `src/domain/playerMerge.ts`
- `src/services/playersService.ts`
- `scripts/migrationConsolidationTest.ts`
- `firestore.rules`

Bug de ranking/pontuacao/premio:

- `src/domain/scoring.ts`
- `src/domain/finance.ts`
- `src/domain/awards.ts`
- `src/features/leaderboard/*`
- `scripts/unitRegressionTest.tsx`

Bug de filtros de jogos:

- `src/domain/matchFilters.ts`
- `src/features/matches/MatchFilterTabs.tsx`
- `src/components/MatchesList.tsx`
- `scripts/unitRegressionTest.tsx`

Bug de jogos/trava por horario:

- `src/domain/rules.ts`
- `src/services/matchesService.ts`
- `src/features/admin/MatchEditorForm.tsx`
- `firestore.rules`

Bug de deploy/auth no iPhone/WhatsApp:

- `src/firebase.ts`
- `vercel.json`
- variaveis de ambiente da Vercel sem segredos
- dominios autorizados do Firebase Auth

## Coisas que o proximo ChatGPT nao deve sugerir sem muito cuidado

- Nao trocar a regra de login para sempre criar `players/{currentUser.uid}`.
  Isso reintroduz duplicados pos-migracao.
- Nao remover `isLegacyEmailOwner()` das rules sem substituir por outro caminho
  para usuarios importados salvarem palpites.
- Nao permitir update livre em `players`; manter campos protegidos.
- Nao depender de `VITE_ADMIN_EMAILS` para proteger Firestore; isso so mostra
  tela admin no front.
- Nao remover `startsAtMs`; ele protege a trava do palpite nas rules.
- Nao salvar ranking final como fonte de verdade.
- Nao contar admins no pote de premios.
- Nao usar o banco antigo como destino principal do app.
- Nao expor `API_FOOTBALL_KEY`, service account ou tokens em prompts publicos.

## Checklist antes de colocar no ar

1. PR com `codex/fix-login-email` mergeado em `main`, se ainda nao estiver.
2. Vercel Production usando repo `SKYRONN-gif/bolaodacopa`, branch `main`.
3. `VITE_FIREBASE_*` apontando para `bolaodacopa-90a57`.
4. `VITE_FIREBASE_AUTH_DOMAIN=bolaodacopao.vercel.app`.
5. `VITE_OLD_FIREBASE_*` preenchido somente se o painel de migracao ainda for
   usado para puxar o banco antigo.
6. `firestore.rules` publicado no projeto `bolaodacopa-90a57`.
7. Firebase Auth com Google ativado.
8. `bolaodacopao.vercel.app` autorizado no Firebase Auth.
9. Testar login no navegador normal e, se possivel, no iPhone/WhatsApp.
10. Testar usuario comum salvando palpite em player importado por email.
11. Conferir ranking/premio apos consolidacao.

## Perguntas abertas/pendencias conhecidas

- Confirmar se os commits `81d072f` e `6cd98f1` ja foram mergeados no `main` de
  producao.
- Confirmar se a Vercel Production ja esta com `VITE_FIREBASE_AUTH_DOMAIN`
  alterado para `bolaodacopao.vercel.app`.
- Confirmar se todos os usuarios importados tem `email` exatamente igual ao
  email da Conta Google, sem espacos. O codigo normaliza para procurar, mas as
  rules comparam `resource.data.email == request.auth.token.email`, entao e mais
  seguro deixar salvo sem espacos e em formato correto.
- Validar em producao se usuario importado consegue salvar palpite no mesmo
  documento antigo sem criar duplicado.
- Rodar `npm run test:all` depois de qualquer mudanca de codigo ou rules.
