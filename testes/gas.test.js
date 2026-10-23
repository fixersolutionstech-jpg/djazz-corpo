// node testes/gas.test.js — testa lerGemini_ e normalizar_ (gas/Code.gs) sem o Apps Script
const fs = require('fs');
global.Utilities = { formatDate: () => '2026-10-23' };
eval(fs.readFileSync(__dirname + '/../gas/Code.gs', 'utf8') + ';global.lerGemini_=lerGemini_;global.normalizar_=normalizar_;');

let falhas = 0;
const igual = (nome, obtido, esperado) => {
  for (const k of Object.keys(esperado))
    if (obtido[k] !== esperado[k]) { falhas++; console.log('FALHA', nome, k, 'obtido', JSON.stringify(obtido[k]), 'esperado', JSON.stringify(esperado[k])); }
};

// respostas do Gemini (fictícias)
igual('json simples', lerGemini_('{"descricao":"arroz e frango","proteina_g":32.6,"kcal":610,"confianca":"alta"}'),
  { descricao: 'arroz e frango', proteina_g: 33, kcal: 610, confianca: 'alta' });
igual('json em bloco', lerGemini_('```json\n{"descricao":"matapa","proteina_g":"12","kcal":"400","confianca":"Média"}\n```'),
  { descricao: 'matapa', proteina_g: 12, kcal: 400, confianca: 'media' });
igual('valores absurdos', lerGemini_('{"descricao":"x","proteina_g":-5,"kcal":99999,"confianca":"talvez"}'),
  { proteina_g: '', kcal: '', confianca: 'baixa' });
igual('sem descrição', lerGemini_('{"proteina_g":10}'), { descricao: 'sem descrição', proteina_g: 10, kcal: '' });
try { lerGemini_('não sei'); falhas++; console.log('FALHA sem JSON devia lançar erro'); } catch (e) {}

// normalizar_
igual('treino', normalizar_({ tipo: 'treino', item: 'Flexões', series: '3', reps: 12, hora: '06:15:00' }),
  { series: 3, reps: 12, duracao_min: '', data: '2026-10-23', hora: '06:15', origem: 'manual', estado: 'activo' });
igual('medida', normalizar_({ tipo: 'medida', item: 'Peso', valor: '72.5', unidade: 'kg', data: '2026-10-20' }),
  { valor: 72.5, data: '2026-10-20', proteina_g: '' });
try { normalizar_({ tipo: 'dinheiro' }); falhas++; console.log('FALHA tipo inválido devia lançar erro'); } catch (e) {}

console.log(falhas ? falhas + ' falha(s)' : 'OK — gas');
process.exit(falhas ? 1 : 0);
