#!/data/data/com.termux/files/usr/bin/bash
# passos-djazz.sh — lê o contador de passos do telemóvel e envia o total do dia ao GAS do DJazz Corpo.
# Requer no Termux: pkg install termux-api jq curl  (+ app Termux:API com a permissão "Actividade física")
# Corre de hora a hora, numa tarefa própria (o Job 0 é o dos SMS do Organic):
#   termux-job-scheduler --job-id 1 --script ~/djazz/passos-djazz.sh --period-ms 3600000 --persisted true
# O contador do hardware conta desde que o telemóvel ligou e volta a 0 ao reiniciar:
# guardamos a última leitura e somamos só a diferença ao total do dia.

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/config.sh"                 # GAS_URL, GAS_TOKEN
EST="$DIR/.passos"                      # "data ultima_leitura total_do_dia"
ENV="$DIR/.passos_enviado"              # "data total" do último envio com sucesso

# 3 leituras de 1 em 1 s e fica a última com número: a primeira amostra vem muitas vezes vazia ({}) neste Redmi
cur=$(timeout 20 termux-sensor -s step_counter -d 1000 -n 3 2>/dev/null | jq -r '.[]? | .values[0]? // empty' 2>/dev/null | tail -1)
termux-sensor -c >/dev/null 2>&1        # desliga o sensor (senão fica a gastar bateria)
cur=${cur%.*}
hoje=$(date +%F)
read -r dia ult total 2>/dev/null < "$EST"

if [ -n "$cur" ]; then
  if [ -z "$ult" ]; then d=0                       # primeira vez: só marca o ponto de partida
  elif [ "$cur" -lt "$ult" ]; then d=$cur          # o telemóvel reiniciou
  else d=$((cur - ult)); fi
  [ "$dia" = "$hoje" ] || total=0                   # dia novo: recomeça (a diferença entra no dia de hoje)
  total=$(( ${total:-0} + d ))
  echo "$hoje $cur $total" > "$EST"
elif [ "$dia" != "$hoje" ]; then
  exit 0                                            # sem leitura e sem passos hoje: nada a enviar
fi

[ "$(cat "$ENV" 2>/dev/null)" = "$hoje $total" ] && exit 0   # nada mudou desde o último envio

corpo=$(jq -n --arg t "$GAS_TOKEN" --arg d "$hoje" --arg h "$(date +%H:%M)" --argjson v "${total:-0}" \
  '{token:$t, acao:"saude", regs:[{id:("passos-"+$d), data:$d, hora:$h, item:"Passos", valor:$v, unidade:"passos", origem:"telemovel"}]}')
for i in 1 2 3 4; do                                # o GAS falha de vez em quando: repete
  resp=$(curl -sL -m 30 -H 'Content-Type: text/plain' -d "$corpo" "$GAS_URL")
  if [ "$(echo "$resp" | jq -r '.ok' 2>/dev/null)" = "true" ]; then echo "$hoje $total" > "$ENV"; exit 0; fi
  sleep 3
done
exit 1                                              # tenta na próxima ronda (o total fica guardado)
