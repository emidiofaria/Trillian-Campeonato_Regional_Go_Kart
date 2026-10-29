# Kart Cup 2026 — Layout do site

> **Nota:** documento reconstruído a partir de `00_inputs/IMPLEMENTATION_PLAN.md`, porque o
> original (`3.md`) não estava disponível. A numeração de secções (3A–3E) segue as referências
> desse plano.

## 1. Visão geral

Página única (one-page), estática, em português europeu (pt-PT). O estilo é desportivo e
inspirado em telemetria, em modo escuro, profissional e sem exageros.

## 2. Identidade visual

- Fundo `#0d1117`; superfícies ligeiramente mais claras; texto principal claro e texto
  secundário atenuado.
- Cores de destaque: amarelo de corrida, azul e verde, tiradas do logótipo da Trillian:
  azul `#0f4174`, amarelo `#e9be00`, verde `#19833c`, anel `#82b07a`.
- Cada piloto tem uma cor própria (avatar com iniciais, ou fotografia circular com anel nessa cor),
  que nunca é o único indicador de
  significado.
- Motivos de corrida subtis: divisória em xadrez e linhas de velocidade, desativados quando o
  utilizador prefere movimento reduzido.
- Tipografia: uma fonte condensada para títulos e uma fonte com algarismos tabulares para tempos
  e pontos.

## 3. Estrutura da página

### Barra de navegação (fixa no topo)

- À esquerda, "Kart Cup 2026" com ícone de troféu.
- Âncoras: **Classificação**, **Calendário**, **Pilotos**, **Patrocinador**, **Regulamento**.
- Em mobile, as âncoras ficam num menu acessível que abre e fecha.
- A secção visível no ecrã fica destacada na navegação.

### 3A. Hero / Patrocinador

- Badge "Patrocinador Oficial".
- Título: **"Melhora as tuas voltas com a Trillian Driving Coach"**.
- Subtítulo: assistente oficial do campeonato, focado na análise de telemetria e na melhoria da
  condução.
- Botões: **"Download na Play Store"** (verde, principal) e **"Visitar Website"** (secundário).
- Visual: o logótipo oficial da Trillian dentro de um anel decorativo em gradiente
  (azul/verde/amarelo), com um brilho suave.
- Por baixo: atalhos para o **próximo GP** e para o **líder atual** (o do líder fica oculto
  enquanto não houver resultados).
- Em mobile, os elementos ficam empilhados; em ecrãs grandes, ficam em duas colunas.

### 3B. Classificação Geral

- Cabeçalho com ícone de bandeira xadrez, título "Classificação Geral" e indicação "N Pilotos" (calculado a partir de `src/data/pilots.json`; hoje 5).
- Tabela com as colunas Pos, Piloto (avatar colorido + nome), Pontos Totais e GP1 a GP7.
- Cada célula de GP mostra os pontos desse GP:
  - "—" para GP ainda não realizado;
  - "F" (falta) com estilo distinto;
  - marcador "VR" quando o piloto ganhou o bónus de volta mais rápida.
- O líder tem o badge "Líder" e o total em amarelo. Antes do primeiro GP aparece
  "A temporada ainda não começou".
- Nota de rodapé: "+N−1 pontos pela volta mais rápida (VR) da sessão" (hoje +4).
- Painel recolhível "Critérios de desempate".

### 3C. Calendário

- Grelha de 7 cartões, um por GP: número do GP, badge Indoor/Outdoor (cor e ícone distintos),
  circuito, localização, estado (Próximo GP / Agendado / Concluído) e data, se existir.
- Nos GP concluídos, o cartão expande para mostrar o pódio, os tempos médios, as melhores voltas,
  o vencedor da VR e a ligação para a folha de tempos, se existir.

### 3D. Pilotos

- Um cartão por piloto (hoje 5): avatar circular (iniciais na cor do piloto ou fotografia), nome,
  número (#1–#N) e estatísticas
  (pontos, vitórias, VR, faltas).
- Grelha de 2 colunas em mobile/tablet e de 3 colunas em ecrãs grandes.

### 3E. Regulamento

- Caixa de resumo com a tabela de pontos (2×(N−1)…2/0 com N pilotos, hoje 8/6/4/2/0; falta = 0; VR +N−1, hoje +4).
- Acordeão com o regulamento completo: formato, faltas, desempates, conduta e transparência (ver
  `docs/rules.md`).

### Patrocinador

- Bloco compacto (`#patrocinador`) com o logótipo da Trillian, uma descrição curta e os mesmos
  botões do hero.

### Rodapé

- Copyright, ligações rápidas, logótipo pequeno da Trillian e o texto "Com o apoio técnico da
  Trillian Driving Coach", com ligação para o website da app.

## 4. Ligações do patrocinador

- Website da app: https://emidiofaria.github.io/Trillian-website/
- Play Store: https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian
