# Contratos REST de contabilidad

Esta guía resume los contratos expuestos para el plan de cuentas, asientos, mayor y reportes contables. Todas las rutas requieren encabezado `Authorization: Bearer <token>` salvo el login inicial. El super usuario (ID=1) tiene acceso completo sin filtros de compañía ni scopes, y el backend `sisa.api` mantiene la premisa de **no usar FOREIGN KEY**.

## Reglas contables
- **Inmutabilidad**: los asientos y sus líneas no se editan ni borran; las correcciones se realizan con asientos inversos con referencia al origen. Cada línea conserva `origin_type`/`origin_id` sin FK para auditar su procedencia.
- **Referencias obligatorias**: `company_id` es obligatorio para todos los usuarios salvo el super usuario. `origin_type` y `origin_id` deben indicar la entidad lógica que disparó el asiento (Transfer, Invoice, ManualAdjust, etc.).
- **Consistencia**: todo asiento debe balancear `debit` y `credit`. Los reportes (mayor, balance general y estado de resultados) se calculan únicamente a partir de asientos publicados, manteniendo el criterio de doble partida.

## Endpoints

### Plan de cuentas
`GET /accounts/plan?company_id=:company_id&with_balances=true`

Devuelve el árbol de cuentas. El parámetro `with_balances` agrega los acumulados por nodo. Ejemplo:
```json
{
  "data": [
    {
      "id": 10,
      "name": "Activos",
      "number": "1",
      "type": "asset",
      "children": [
        {
          "id": 11,
          "name": "Caja y bancos",
          "number": "11",
          "totals": {"debit": 15200, "credit": 2000, "net": 13200},
          "children": [
            {
              "id": 12,
              "name": "Caja principal",
              "number": "1101",
              "totals": {"debit": 8000, "credit": 1000, "net": 7000},
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Asientos contables
`POST /accounting-entries`

Crea un asiento con múltiples líneas. Las líneas deben balancear `debit` y `credit` y llevar referencias de origen. Ejemplo de payload:
```json
{
  "company_id": "{{company_id}}",
  "posted_at": "2024-04-10 10:00:00",
  "description": "Asiento manual de ajuste",
  "lines": [
    {"account_id": "{{account_id}}", "debit": 1200.00, "credit": 0, "origin_type": "ManualAdjust", "origin_id": 9901},
    {"account_id": "{{counterpart_account_id}}", "debit": 0, "credit": 1200.00, "origin_type": "ManualAdjust", "origin_id": 9901}
  ]
}
```
La respuesta devuelve las líneas guardadas y los totales (`debit`, `credit`, `net`).

### Mayor (ledger)
`GET /accounting/ledger?company_id=:company_id&account_id=:account_id&start_date=:start&end_date=:end`

Incluye `opening_balance`, las entradas con saldo acumulado y `closing_balance`. Se calcula solo con asientos inmutables publicados.

### Balance general
`GET /accounting/balance-sheet?company_id=:company_id&as_of=:date`

Entrega los totales de Activos, Pasivos y Patrimonio. La ecuación Activos = Pasivos + Patrimonio debe cumplirse; los nodos desglosan cuentas y saldos.

### Estado de resultados
`GET /accounting/income-statement?company_id=:company_id&start_date=:start&end_date=:end`

Lista ingresos, costos y gastos del período y el `net_income` resultante. El cálculo se basa en las cuentas de resultados del plan de cuentas y los asientos correspondientes.
