"""python testes/test_ponte.py — testa juntar, resumo, Excel e CSV do relógio com dados fictícios (pasta temporária)."""
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import ponte  # noqa: E402

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
        print("FALHA", msg)


sheet = [
    {"id": "a1", "tipo": "treino", "data": "2026-10-20", "hora": "06:00", "item": "Flexões", "series": 3, "reps": 15, "duracao_min": "", "estado": "activo", "origem": "manual"},
    {"id": "a2", "tipo": "treino", "data": "2026-10-22", "hora": "17:00", "item": "Flexões", "series": 2, "reps": 10, "duracao_min": "", "estado": "activo", "origem": "manual"},
    {"id": "a3", "tipo": "social", "data": "2026-10-21", "hora": "12:00", "valor": 1, "descricao": "no mercado", "estado": "activo"},
    {"id": "a4", "tipo": "social", "data": "2026-10-21", "hora": "13:00", "valor": 1, "descricao": "duplicado", "estado": "apagado"},
    {"id": "a5", "tipo": "refeicao", "data": "2026-10-21", "hora": "13:00", "item": "Almoço", "descricao": "arroz e frango", "proteina_g": 30, "kcal": 600, "origem": "foto", "confianca": "media", "estado": "activo"},
    {"id": "a6", "tipo": "medida", "data": "2026-10-19", "hora": "07:00", "item": "Peso", "valor": 70.5, "unidade": "kg", "estado": "activo"},
    {"id": "a7", "tipo": "saude", "data": "2026-10-21", "hora": "", "item": "Passos", "valor": 8000, "unidade": "passos", "estado": "activo", "origem": "mifitness"},
    {"id": "a8", "tipo": "saude", "data": "2026-10-23", "hora": "18:00", "item": "Treino corrida", "valor": 3, "unidade": "km", "estado": "activo", "origem": "mifitness"},
    {"id": "a9", "tipo": "lixo", "data": "2026-10-21", "estado": "activo"},
]
# Excel antigo: a4 ainda lá (vai sair), a5 com proteína antiga (vai ser corrigida), z1 só no Excel (fica)
antes = {
    "a4": {"id": "a4", "tipo": "social", "data": "2026-10-21", "hora": "13:00", "valor": 1, "descricao": "duplicado"},
    "a5": {"id": "a5", "tipo": "refeicao", "data": "2026-10-21", "hora": "13:00", "item": "Almoço", "descricao": "arroz e frango", "proteina_g": 20, "kcal": 600, "origem": "foto", "confianca": "media"},
    "z1": {"id": "z1", "tipo": "medida", "data": "2026-09-01", "hora": "", "item": "Cintura", "valor": 84, "unidade": "cm"},
}
regs, mud = ponte.juntar(antes, sheet)
ok(mud == {"novos": 6, "corrigidos": 1, "apagados": 1}, f"mudanças {mud}")
ok("a4" not in regs and "z1" in regs and "a9" not in regs, "apagado sai, antigo fica, tipo inválido ignorado")
ok(regs["a5"]["proteina_g"] == 30, "correcção aplicada")

txt = ponte.resumo(regs, hoje=date(2026, 10, 23))
ok("| Dias de treino | 3 · meta 3 |" in txt, "dias de treino (2 manuais + 1 relógio)")
ok("| Conversas novas | 1 · meta 3 |" in txt, "conversas sem o apagado")
ok("| Flexões | 2 | 65 | — |" in txt, "reps totais 3x15 + 2x10")
ok("Último peso | 70.5 kg" in txt and "Última cintura | 84 cm" in txt, "peso e cintura")
ok("Passos por dia (relógio) | 8000" in txt, "passos")

with tempfile.TemporaryDirectory() as d:
    x = Path(d) / "Corpo.xlsx"
    ponte.escrever_excel(x, regs)
    lido = ponte.ler_excel(x)
    ok(set(lido) == set(regs), "Excel ida e volta (ids)")
    ok(lido["a1"]["reps"] == 15 and lido["a6"]["valor"] == 70.5, "Excel ida e volta (valores)")
    _, mud2 = ponte.juntar(lido, sheet)
    ok(mud2 == {"novos": 0, "corrigidos": 0, "apagados": 0}, f"segunda sincronização sem mudanças: {mud2}")

    c = Path(d) / "mi.csv"
    c.write_text("data,hora,item,valor,unidade,duracao_min\n2026-10-22,,Passos,9100,passos,\n2026-10-21,22:30,Sono,6.5,h,\n,,,,,\n", encoding="utf-8")
    s1, s2 = ponte.ler_csv_saude(c), ponte.ler_csv_saude(c)
    ok(len(s1) == 2 and s1[0]["item"] == "Sono", "CSV: 2 linhas, ordenadas por data")
    ok([r["id"] for r in s1] == [r["id"] for r in s2], "CSV: ids estáveis (reenviar não duplica)")

print(f"{falhas} falha(s)" if falhas else "OK — ponte")
sys.exit(1 if falhas else 0)
