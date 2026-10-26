# Kart Cup 2026 — Regulamento

> **Nota:** documento reconstruído a partir de `00_inputs/IMPLEMENTATION_PLAN.md`, porque o
> original (`2.md`) não estava disponível. Os pontos marcados com **A definir** têm de ser
> confirmados pelo grupo antes de serem publicados como definitivos.

## 1. Objetivo

A Kart Cup 2026 é um campeonato de karting de aluguer entre amigos, disputado ao longo de
7 Grandes Prémios (GP), com o apoio técnico da **Trillian Driving Coach**.

## 2. Pilotos

| N.º | Piloto     |
| --- | ---------- |
| #1  | Emídio     |
| #2  | P. Queirós |
| #3  | Joel       |
| #4  | Dinis      |

## 3. Calendário

O campeonato tem **7 GP**. Cada GP realiza-se num circuito de karting de aluguer, que pode ser
**Indoor** ou **Outdoor**.

| GP  | Circuito  | Tipo      | Localização | Data      |
| --- | --------- | --------- | ----------- | --------- |
| GP1 | A definir | A definir | A definir   | A definir |
| GP2 | A definir | A definir | A definir   | A definir |
| GP3 | A definir | A definir | A definir   | A definir |
| GP4 | A definir | A definir | A definir   | A definir |
| GP5 | A definir | A definir | A definir   | A definir |
| GP6 | A definir | A definir | A definir   | A definir |
| GP7 | A definir | A definir | A definir   | A definir |

As datas são acordadas no grupo e publicadas no site assim que confirmadas.

## 4. Formato da sessão

- Cada GP consiste numa **sessão livre de 10 minutos**.
- Os karts são atribuídos por **sorteio** antes da sessão.
- A classificação da sessão é feita pelo **tempo médio por volta** (do mais baixo para o mais
  alto).
- No final da sessão é registada, para cada piloto, a volta mais rápida e a segunda volta mais
  rápida (usadas para desempate e para a volta mais rápida).

## 5. Pontuação

| Posição na sessão | Pontos |
| ----------------- | ------ |
| 1.º               | 8      |
| 2.º               | 6      |
| 3.º               | 4      |
| 4.º               | 0      |
| Falta (ausência)  | 0      |

## 6. Volta mais rápida (VR)

O piloto com a **volta mais rápida da sessão** recebe um bónus de **+4 pontos**, independentemente
da posição em que terminou.

## 7. Faltas e desempates

### 7.1 Faltas

- Um piloto que não compareça a um GP regista uma **falta** e recebe **0 pontos** nesse GP.
- **A definir:** quando há ausentes, os pilotos presentes ocupam as primeiras posições por ordem
  (com 3 presentes: 8/6/4) ou mantém-se a tabela fixa de 4 pilotos (8/6/0)? O site usa, por
  omissão, a primeira opção (configurável via `ABSENCE_RANKING_MODE`).

### 7.2 Desempate na sessão

Se dois pilotos tiverem o mesmo tempo médio por volta, fica à frente:

1. quem tiver a melhor volta mais rápida;
2. se persistir, quem tiver a melhor segunda volta mais rápida.

### 7.3 Desempate no campeonato

Em caso de igualdade de pontos na classificação geral, fica à frente:

1. quem tiver mais vitórias;
2. se persistir, quem tiver mais voltas mais rápidas (VR);
3. se persistir, quem tiver menos faltas.

## 8. Conduta e transparência

- Espera-se de todos os pilotos fair play e respeito pelas regras e pela equipa do kartódromo.
- Após cada sessão, a **folha de tempos** oficial é partilhada no grupo, e os resultados
  publicados no site são baseados nessa folha.
