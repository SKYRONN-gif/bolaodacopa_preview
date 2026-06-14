# Contexto para pedir ajuda ao ChatGPT

Use este arquivo como "cola" quando quiser pedir melhorias sem entregar o
projeto inteiro de uma vez.

## Prompt base

```text
Estou trabalhando em um app React + Vite + TypeScript chamado Bolao da Copa
2026. Ele usa Firebase Auth com Google e Cloud Firestore.

Objetivo do app:
- Participantes fazem palpites de jogos.
- Admin cadastra/edita jogos, resultados, participantes e ajustes manuais.
- Ranking e premiacao sao recalculados no front a partir dos jogos finalizados.
- A conferencia de palpites mostra quem palpitou, o horario salvo e a pontuacao.

Regras importantes:
- Nao quebrar as regras de seguranca do Firestore.
- Nao salvar pontos finais manualmente; o ranking vem de `computeLeaderboard`.
- Jogos precisam ter `date`, `time`, `startsAt`, `startsAtMs`, `status` e times.
- Palpites ficam em `players/{playerId}.predictions.{matchId}`.
- `createdAt` e `updatedAt` de palpites devem ser datas validas.
- Admin no front vem de `VITE_ADMIN_EMAILS`, mas escrita no banco vem de
  `firestore.rules`.

Antes de sugerir codigo, me explique quais arquivos devo abrir e por que.
Depois proponha uma mudanca pequena, com o minimo de arquivos possivel.

Minha tarefa agora:
[descreva aqui a melhoria ou bug]
```

## Mapa rapido do projeto

- `src/App.tsx`: estado principal, login, abas, chamadas de salvar no Firestore.
- `src/firebase.ts`: config do Firebase, Auth, Firestore e emuladores.
- `src/types.ts`: contratos principais de `Match`, `Player` e `Prediction`.
- `src/data.ts`: jogos base usados pela sincronizacao admin.
- `src/services/matchesService.ts`: leitura/escrita da colecao `matches`.
- `src/services/playersService.ts`: leitura/escrita da colecao `players`.
- `src/services/firestoreNormalizers.ts`: limpa dados vindos do banco antes do UI.
- `src/domain/scoring.ts`: calcula pontos e ranking.
- `src/domain/rules.ts`: decide se palpite esta travado.
- `src/domain/matches.ts`: ordena jogos pela data.
- `src/domain/finance.ts`: calcula premiacao e remove admins do pote.
- `src/components/AdminPanel.tsx`: junta os formularios admin.
- `src/features/admin/*`: formularios de admin.
- `src/features/matches/*`: tela/cartoes de jogos e inputs de palpite.
- `src/features/leaderboard/*`: ranking, premios e conferencia de palpites.
- `firestore.rules`: permissoes reais do banco.

## Quando mandar arquivos para o ChatGPT

Para bug em palpites:
- `src/App.tsx`
- `src/services/playersService.ts`
- `src/services/firestoreNormalizers.ts`
- `src/domain/rules.ts`
- `firestore.rules`

Para bug em jogos/trava por horario:
- `src/features/admin/MatchEditorForm.tsx`
- `src/services/matchesService.ts`
- `src/domain/matches.ts`
- `src/domain/rules.ts`
- `firestore.rules`

Para ranking/pontos:
- `src/domain/scoring.ts`
- `src/components/Leaderboard.tsx`
- `src/features/leaderboard/*`
- `src/types.ts`

Para admin/permissao:
- `src/config/admins.ts`
- `src/App.tsx`
- `src/firebase.ts`
- `firestore.rules`
- `.env.example`

Para visual/layout:
- o componente da tela que voce quer mudar
- `src/index.css`
- componentes vizinhos da mesma pasta

## Schema mental do Firestore

`matches/{matchId}`:

```ts
{
  id: string;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string;      // exemplo: "13/06/2026"
  time: string;      // exemplo: "16:00"
  startsAt: string;  // ISO, usado pelo front
  startsAtMs: number;// epoch ms, usado pelas rules
  status: "scheduled" | "finished";
  scoreA?: number;
  scoreB?: number;
  group: string;
  venue?: string;
  city?: string;
}
```

`players/{playerId}`:

```ts
{
  id: string;
  name: string;
  avatar: string;
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
  isAdmin?: boolean;
  email?: string;
}
```

## Checklist antes de aceitar resposta do ChatGPT

- A resposta mexe nas `firestore.rules` se a tarefa envolver permissao?
- A resposta preserva `startsAtMs` nos jogos?
- A resposta nao tenta confiar em `VITE_ADMIN_EMAILS` para proteger o banco?
- A resposta nao salva pontuacao final como fonte da verdade?
- A resposta considera dados antigos ou manuais do Firestore?
- A resposta manda rodar `npm run test:resilience`, `npm run lint` e `npm run build`?
