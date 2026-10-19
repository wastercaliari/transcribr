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
