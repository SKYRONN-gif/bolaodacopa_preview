# Migracao manual do bolao

Use este checklist quando migrar dados do app antigo para o Firebase novo.

## Colecao `matches`

Cada jogo deve ficar em `matches/{id}`.

Campos principais:

```json
{
  "id": "m1",
  "teamA": "Mexico",
  "flagA": "🇲🇽",
  "teamB": "Africa do Sul",
  "flagB": "🇿🇦",
  "date": "11/06/2026",
  "time": "16:00",
  "startsAt": "2026-06-11T19:00:00.000Z",
  "startsAtMs": 1781204400000,
  "status": "finished",
  "scoreA": 2,
  "scoreB": 1,
  "group": "Grupo A",
  "venue": "Estadio Azteca",
  "city": "Mexico City"
}
```

Use `status: "scheduled"` para jogos abertos e `status: "finished"` para jogos
encerrados. Quando marcar como `finished`, preencha `scoreA` e `scoreB`.

`startsAtMs` e obrigatorio para as rules travarem palpites pelo horario. Jogos
cadastrados pelo Painel ADM ja recebem esse campo automaticamente.

## Colecao `players`

Cada participante fica em `players/{uid}` ou `players/manual-...`.
Para permissao de admin via perfil, use obrigatoriamente `players/{uid}` com o
UID da Conta Google. Documento `manual-...` pode aparecer no ranking, mas nao
libera escrita admin nas rules.

Campos principais:

```json
{
  "id": "uid-ou-manual-id",
  "name": "Nome do participante",
  "avatar": "⚽",
  "email": "email@exemplo.com",
  "isAdmin": false,
  "points": 0,
  "exactHits": 0,
  "partialHits": 0,
  "errorHits": 0,
  "manualPointsAdjustment": 0,
  "manualPointsAdjustmentUpdatedAt": "",
  "lastPredictionMatchId": "",
  "predictions": {
    "m1": {
      "scoreA": 2,
      "scoreB": 1,
      "createdAt": "2026-06-11T18:30:00.000Z",
      "updatedAt": "2026-06-11T18:30:00.000Z"
    }
  }
}
```

Nao edite `points`, `exactHits`, `partialHits` ou `errorHits` para tentar mudar
o ranking. O front recalcula esses campos com base em `matches`,
`predictions` e `manualPointsAdjustment`.

Para trazer pontos antigos que nao existem mais como palpite/jogo, use
`Painel ADM > Ajuste manual de pontos`.

## Como conferir

1. Altere um placar em `matches` ou pelo Painel ADM.
2. Recarregue o app ou aguarde alguns segundos.
3. O ranking e a conferencia de palpites devem mudar automaticamente.
4. Entre sem admin e confirme que nao aparece `Painel ADM`.
5. Entre na aba de jogos e confirme que nao aparece lista de outros
   participantes embaixo dos cards.
6. Para admin por perfil, confirme que o documento e `players/{uid-do-google}`,
   com `email` igual ao email logado e `isAdmin: true`.

Se o app mostrar "Modo local ativo", ele nao esta conectado ao Firebase certo.
Confira as variaveis `VITE_FIREBASE_*` na Vercel e se `firestore.rules` foi
publicado no projeto correto.

## Safari/iPhone

O app nao deve criar ou atualizar perfil automaticamente enquanto a lista de
participantes vier apenas do cache local do navegador. Isso evita que Safari ou
rede instavel gere um perfil vazio por cima de dados reais.

Se um usuario no iPhone vir "Modo local ativo" ou nao conseguir salvar:

1. Peca para recarregar a pagina.
2. Confirme se o dominio da Vercel esta em Firebase Authentication >
   Authorized domains.
3. Confirme se as variaveis `VITE_FIREBASE_*` estao no ambiente Production do
   Vercel.
4. Confira no console do Firebase se o documento do participante tem `email`
   igual ao email da Conta Google usada.
