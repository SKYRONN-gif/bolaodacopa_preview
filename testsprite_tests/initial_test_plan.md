# Plano inicial de testes frontend - ciclo público

## Prioridade 1 - Carregamento e navegação inicial
- Validar que a aplicação carrega na porta 3000 sem erros críticos
- Confirmar que a homepage é exibida com conteúdo principal
- Validar que não há quebra de layout na primeira renderização

## Prioridade 2 - Autenticação pública
- Confirmar que o botão de login com Google está visível para usuário não autenticado
- Validar que o botão não quebra a navegação da página

## Prioridade 3 - Regras do bolão
- Verificar que a seção de regras do bolão é exibida e legível
- Confirmar que o conteúdo público está acessível sem login

## Prioridade 4 - Ranking público
- Acessar a seção de ranking, quando disponível
- Validar que o conteúdo do ranking é exibido corretamente
- Confirmar que o layout se adapta ao tamanho de tela

## Prioridade 5 - Partidas e responsividade
- Acessar a área de partidas
- Validar que os cards de partidas aparecem corretamente
- Verificar comportamento básico em desktop e mobile
- Confirmar se há overflow visual ou layout quebrado

## Critérios de parada para este ciclo
- Os testes públicos e somente leitura foram mapeados corretamente
- O ambiente está pronto para execução futura
- Nenhuma escrita no Firestore foi feita
- Nenhum fluxo de login real foi executado
