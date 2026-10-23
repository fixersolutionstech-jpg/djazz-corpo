# djazz-corpo — instalação

## 1. Backend (Google Apps Script)
1. Cria uma Google Sheet: **DJazz — Corpo**. Extensões → Apps Script (ou `clasp create`/`clasp clone` e `clasp push -f`).
2. Propriedades do script: `TOKEN` = senha longa; `GEMINI_KEY` = chave Gemini (para as fotos).
3. No editor, corre `autorizar()` uma vez (Sheets, Drive, pedidos externos).
4. Implementar → Nova implementação → **Aplicação Web** (Executar como: Eu · Acesso: Qualquer pessoa). Copia o URL `/exec`.

## 2. PWA (GitHub Pages)
1. Repositório `djazz-corpo` → Settings → Pages → `main` / root.
2. Abre o link no Chrome do telemóvel → **Instalar app** → Definições → URL + TOKEN → **Testar ligação**.

## 3. Ponte (PC)
1. Copia `.env.example` para `.env` e preenche `GAS_URL`, `GAS_TOKEN` (e `DJAZZ_DIR` se a pasta mudar).
2. `pip install requests openpyxl`
3. `python ponte.py seco` (ver) → `python ponte.py sincronizar` (escreve `The DJAZZ\Corpo\Corpo.xlsx` e `Resumo_semana.md`).
4. Agendar: `schtasks /create /tn "DJazz ponte" /tr "\"<pasta>\sincronizar.cmd\"" /sc daily /st 21:15`

## 4. Relógio (Mi Fitness)
1. Mi Fitness → Perfil → Health Connect → ligar passos, sono, treinos, peso.
2. Exportar do Health Connect para CSV (app de exportação) com as colunas `data,hora,item,valor,unidade,duracao_min`.
3. `python ponte.py saude ficheiro.csv` (reenviar o mesmo ficheiro não duplica).
