# djazz-corpo — contexto para o Claude Code

## O que é
Registo da câmara Física do Rei (príncipe **DJazz**): treino, alimentação, medidas e social, mais os dados do relógio (Mi Fitness). Irmão do `organic-caixa` (mesma arquitectura, sem segunda aprovação).

## Separação
- **Código** aqui (`Projectos IA\djazz-corpo`, Git público).
- **Dados** em `The castelo do Rei multiplicado\The DJAZZ\Corpo\` (`DJAZZ_DIR` no `.env`): `Corpo.xlsx` (registo oficial, só a `ponte.py` escreve) e `Resumo_semana.md` (o DJazz lê este). Fotos da comida só no Drive (pasta privada "DJazz — fotos da comida"). Nunca dados pessoais nesta pasta.

## Arquitectura
```
PWA (index.html: treino, refeição + foto, medida, +1 conversa) ─┐
Mi Fitness → Health Connect → CSV → ponte.py saude ─────────────┤
                                                                ↓
GAS (gas/Code.gs) → Sheet "Registos" (inbox; foto → Drive + Gemini estima proteína/kcal)
                                                                ↓
ponte.py sincronizar (tarefa diária) → The DJAZZ\Corpo\Corpo.xlsx + Resumo_semana.md
```
- GAS: POST `registar`, `corrigir`, `apagar` (estado 'apagado', a linha fica), `saude` (lote do relógio, id estável), `foto`; GET `listar` (PWA), `todos` (ponte). Propriedades: `TOKEN`, `GEMINI_KEY`, opcional `GEMINI_MODELO`.
- Sem aprovação: registar conta logo. Corrigir/apagar na PWA (separador Semana); a ponte aplica no Excel pelo id.

## Regras (lições do organic-caixa)
1. `.env`, `.clasp.json`, CSV do relógio, fotos e xlsx **nunca** no Git. Chave Gemini só nas Propriedades do script (vai no cabeçalho, nunca no URL).
2. `ponte.py` só age com subcomando (`sincronizar`, `seco`, `resumo`, `saude`); erros nunca mostram URL/token.
3. Deploy: fechar o separador do Apps Script, `clasp push -f`, editar a implementação existente (mesmo URL). Pedir confirmação ao Rei.
4. Ao mudar a PWA, subir `djazz-vN` em `sw.js`.
5. Uma fonte por facto: o relógio manda em passos/sono/treino com tempo; a PWA só regista o que ele não vê.
6. Limites do DJazz: estimativas de comida são aproximadas, sem dietas extremas; social sem nomes de terceiros.
7. Testes: `node testes/gas.test.js` e `python testes/test_ponte.py` antes de qualquer push.

## Estado (2026-10-23)
- [x] Código local: GAS, PWA, ponte, testes (verdes), ícones
- [x] Repositório público `fixersolutionstech-jpg/djazz-corpo` + Pages: https://fixersolutionstech-jpg.github.io/djazz-corpo/ (2026-10-23)
- [x] Sheet "DJazz — Corpo" + script ligado criados com `clasp create-script` (`.clasp.json` local; o clasp substitui `gas/appsscript.json` ao criar: repor do Git)
- [ ] `clasp push --force` (bloqueado no terminal do Claude: o Rei corre), Propriedades `TOKEN` (já no `.env`) e `GEMINI_KEY`, `autorizar()`, implementação → URL no `.env` e na PWA
- [ ] Mi Fitness → Health Connect → exportação CSV (testar app; adaptar `ler_csv_saude` ao formato real)
- [ ] Tarefa agendada "DJazz ponte" (`sincronizar.cmd`)
- [x] `The DJAZZ\CLAUDE.md`: secção "REGISTOS DO CORPO" aponta para `Corpo/Resumo_semana.md` (2026-10-23)
- [x] Implementação @1 a funcionar (registar/corrigir/apagar/saude/foto + Gemini testados 2026-10-23); `.env` com GAS_URL e TOKEN. Não editar código no editor do Apps Script (o push do PC sobrepõe)
