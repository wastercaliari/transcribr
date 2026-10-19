# CALCULATIONS

## C-1 | 2026-10-18 | Impacto financeiro do buffer de áudio (I-9 / SCRUM-53) no Railway
- **Entradas**: Buffer máximo de 25 MB (0,024414 GB), operação 24 horas/dia por 30 dias/mês, taxa de RAM Railway de \$0,000231 por GB-hora.
- **Código executado**:
  ```js
  const bufferGB = 25 / 1024;
  const gbHoursPerDay = bufferGB * 24;
  const costPerMonthUSD = gbHoursPerDay * 30 * 0.000231;
  const costPerMonthBRL = costPerMonthUSD * 5.60;
  ```
- **Saída**:
  - Consumo diário: 0,5859 GB-horas/dia (\$0,000135/dia).
  - Custo mensal adicional máximo: \$0,00406 USD (aproximadamente R\$ 0,02 por mês).

## C-2 | 2026-10-19 | Impacto financeiro da persistencia em blocos de 50 falas (SCRUM-76)
- **Entradas**: Armazenamento local SQLite (tabela speech_blocks), processamento aritmetico local em Node.js, chamadas a API Groq mantidas com janela de tokens controlada (~22k chars).
- **Custo adicional em nuvem**: $0.00 USD (zero custo adicional de API, banco ou infraestrutura).
- **Economia de tokens e processamento**: A estruturacao em blocos e ranking factual reduz alucinacoes da LLM e elimina a necessidade de reprocessamento ou chamadas repetidas de /resumo.
