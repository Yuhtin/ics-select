# Aula (ideia): Como o carrinho da Uber anda liso no mapa

**Tema irmão de `motorista-mais-perto`, mas foco diferente.** Aquela é sobre o lado SERVIDOR (achar o motorista mais perto: geohash, quadtree, H3, dispatch/ETA). Esta seria sobre o lado CLIENTE + entrega em tempo real: como o carro desliza na tela do passageiro apesar do GPS chegar só a cada ~4s.

Surgiu quando o usuário trouxe dois materiais pro matching; o conteúdo de "smooth real-time map" não cabia lá (é outro problema), então virou candidato a aula própria.

## Gancho / curiosidade
O carro anda liso na tela, mas o GPS do motorista só manda posição a cada ~4 segundos. Como o app não mostra o carro pulando de 4 em 4s?

## Espinha (primitivas transferíveis)
1. **Push vs Polling.** Perguntar "cadê o motorista?" a cada segundo desperdiça rede (na Uber, ~80% das requisições eram só polling). Migraram pra push: Server-Sent Events (SSE) e gRPC com streams bidirecionais. (Primitiva: pub/sub, conexões long-lived, fan-out.)
2. **Interpolação / dead reckoning.** Entre dois pings, o cliente PREVÊ onde o carro está: última posição + velocidade + direção (course) + tempo decorrido. (Primitiva: estimar estado entre amostras esparsas.)
3. **Filtro de Kalman.** Suaviza o ruído do GPS e funde previsão com medição, gerando animação contínua em vez de saltos. (Aparece também no map-matching pra limpar GPS em túneis/reflexões.)
4. **Entrega em escala (RAMEN).** RAMEN = Real-time Asynchronous Messaging Network. Pipeline de 3 componentes: Fireball (decide o timing) -> API Gateway (prepara o payload) -> RAMEN (entrega). Milhões de updates de localização por minuto. Particionamento espacial reduz o escopo do broadcast a regiões relevantes. Milhares de edge servers no mundo com dado cacheado.
5. **(Ponte com a outra aula)** O mesmo índice H3 / k-ring aparece pra decidir QUEM recebe o update de QUEM (só vê supply na sua vizinhança).

## Beats mandatórios
- Arquitetura: fluxo completo do ping do motorista -> Fireball/Gateway/RAMEN -> SSE pro app -> dead reckoning + Kalman na tela.
- AWS: API Gateway + (managed websockets/SSE), Kinesis/MSK pro stream, ElastiCache pro estado quente, edge (CloudFront/Lambda@Edge) pros edge servers.

## Fontes
- "The tech behind Uber's smooth real-time map experience" (Medium, @ndriqim.muhadri99)
- "The Genius System Behind the Uber App's Real-Time Map" (YouTube `gHIs0Mdow8M`)
- Uber Eng: RAMEN / real-time push platform; H3 (uber.com/blog/h3)

## Cohort fit (Hot Stuff 2026.2)
- `pubsub` / `message-queues`: checar quem estudou (puxar matriz item-level, cuidado com inflação de overview).
- Rayssa de novo forte se entrar caching/consistent hashing; graph continua gap.

## Estilo visual (awesome-design-md)
Evitar repetir Linear (já usado aqui) e Uber (usado no Ledger). Candidato: algo com sensação de "tempo real / movimento / streaming". Avaliar `spotify`, `framer`, ou um automotivo (`tesla`/`bmw`) pelo tema movimento.
