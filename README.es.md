# YAFI · ¡Finanzas YA!

**Cobra, crece y paga desde tu celular.** Tus ventas son tu crédito.

> Una app de pagos que nunca menciona la blockchain. Cada venta por QR que recibe un comerciante informal paga automáticamente un pequeño microcrédito en **Monad**, y construye el historial crediticio que nunca tuvo.

**Track:** Consumer Products & Payments · Monad Metropolis Hackathon 2026
**Demo en vivo:** https://judiweb3-cmd.github.io/yafi/ (Monad Testnet; no necesitas billetera, el saldo de prueba llega solo)
**Contrato (v2):** [`0x21B86c97989ae1962928706dCe8042568C340845`](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845) en Monad Testnet (chain ID 10143)
**Video demo:** https://youtu.be/tZQGx8nTA9I · **Video pitch:** https://youtu.be/tbX6vABEUr0

🇬🇧 [Read in English](README.md)

---

## El problema

Cerca del **70% de los trabajadores en Perú son informales** ([INEI, 2025](https://www.expreso.com.pe/economia/formalizacion-laboral-impulsaria-crecimiento-en-peru-mas-del-70-de-trabajadores-sigue-en-informalidad-epen-inei-noticia/1283864/)). Una vendedora como Rosa (ejemplo ilustrativo, no es una usuaria real) vende desayunos en su carrito todos los días, y muchos clientes ya le pagan escaneando un QR con una billetera móvil como Yape (parecida a Bizum en España o Nequi en Colombia). Pero no tiene boletas ni historial crediticio formal, así que el banco le dice que no.

Cuando necesita capital de trabajo, muchas veces le queda el **gota a gota**, un préstamo informal que se cobra a diario. Un estudio del IPE encontró que unas **211,000 familias peruanas** lo usaron en un año, y que **la mitad de quienes se prestan informalmente paga más de 500% al año** ([IPE en Gestión, 2024](https://gestion.pe/tu-dinero/finanzas-personales/prestamos-gota-a-gota-acechan-a-211000-familias-cuanto-cobran-informalidad-noticia/)).

Rosa sí tiene algo que a un prestamista le interesa: un flujo constante de ventas diarias. YAFI convierte ese flujo en crédito.

## Quién lo construye

Trabajé 8 años como asesora de negocios en Perú: en un banco, en el segmento de pequeña empresa, y en financieras, en el segmento de microempresa. Mis clientes más pequeños (desayunos y snacks al paso, venta de ropa, servicios de masajes) vendían S/ 100–200 al día. Yo veía esas ventas en campo, pero compraban sus insumos en el mercado sin boleta, así que ningún papel las probaba y se les negaba el crédito. Muchos terminaban prestándose al 20% mensual, o hasta al 5% diario, con prestamistas informales.

YAFI es mi primer proyecto técnico. No soy programadora, pero estoy en proceso de aprendizaje.

## Cómo funciona

1. **El prestamista otorga un microcrédito** (en la demo: S/ 500 con 10% de retención por venta, tope de 30%). El dinero llega al instante a la billetera de Rosa.
2. **Un cliente le paga a Rosa con QR**, como ya lo hace con las billeteras móviles, y recibe un comprobante con la marca YAFI que puede compartir por WhatsApp. El cliente nunca ve nada del préstamo de Rosa: esa información es de ella.
3. **El contrato inteligente divide cada venta en la misma transacción:** el 90% le llega a Rosa al instante y el 10% paga su préstamo. Sin cuotas fijas, sin ir a una agencia y sin cobradores. El celular de Rosa suena con el sonido de YAFI y muestra la venta.
4. **Cada venta y cada pago quedan registrados en la cadena.** Ese historial de comportamiento (número de ventas, monto pagado, préstamos pagados por completo) es la base para préstamos más grandes y para un historial crediticio de la economía informal.
5. **El interés es simple y solo sobre el capital** (demo: 6% mensual, 72% al año). Cada pago cubre primero el interés, así que pagar antes, con ventas o en efectivo, baja el costo.

## Controles de riesgo y precio (v2)

En mi experiencia como asesora de negocios, los prestamistas aplican estas reglas a mano. `YafiCreditEscrowV2` las hace cumplir, así que ningún administrador puede saltárselas:

| Regla | Qué hace el contrato | Por qué la usan los prestamistas |
|---|---|---|
| **Escalera de crédito** | El primer préstamo tiene tope (demo: S/ 500). Solo se puede dar uno nuevo cuando el actual está pagado por completo, y como máximo por el 150% del anterior. | Un primer préstamo pequeño limita la pérdida con un cliente nuevo; la línea crece solo con pagos demostrados. |
| **Sin autopago** | Un comerciante no puede pagar su propio QR. Sí puede hacer un pago adelantado (por ejemplo, con ventas en efectivo) con `repay()`: eso baja la deuda y cuenta como pago, pero no como venta. | Evita que alguien haga circular su propio dinero para fingir un historial de ventas. |
| **Venta mínima** | Se rechazan ventas por debajo de un mínimo (demo: S/ 1). | Evita que pagos diminutos inflen el número de ventas que se usa como historial. |
| **Tope de tasa y congelamiento** | El interés nunca puede pasar un tope fijado al desplegar (demo: 75% al año). El prestamista puede congelar a un comerciante en un reclamo: sin retención y sin interés mientras está congelado. | Protege al deudor de tasas abusivas y de que el interés crezca durante un reclamo. |

El paso de 150% y los límites de la demo son parámetros ilustrativos del prototipo, no cifras de un regulador. Los topes y el mínimo se fijan al desplegar y el administrador puede cambiarlos con `setLimits`.

El cliente nunca ve una billetera, una frase semilla ni la palabra "blockchain": la app crea una cuenta invisible en el navegador, un pequeño servicio fondeador le da saldo de prueba, y todos los montos se muestran en soles.

## Pruebas con usuarios

El 13 de octubre de 2026 probé la app en vivo con personas reales: familia, amigos y pequeños comerciantes (puestos de mercado, bodegas, un puesto de comida en la calle y una tienda de ropa), en persona y por WhatsApp. Las notas son anónimas: sin nombres ni datos personales.

| Dónde | Quién | Qué pasó |
|---|---|---|
| Puesto de mercado | Comerciante y un cliente, dos celulares | Venta de S/ 10; la pantalla de Rosa se actualizó en vivo y su deuda bajó de S/ 481.32 a S/ 480.32 |
| Bodega (tiendita de barrio) | Comerciante y un cliente | Pago de S/ 44; la venta apareció en vivo en el celular del comerciante |
| Otro comercio | Un cliente | Pago de S/ 10.80, confirmado |
| Puesto en la calle en Lima, de noche | Un cliente | Escaneó el QR y pagó S/ 20 |
| A distancia, por WhatsApp | Una amiga que no sabe de cripto | Pagó S/ 5 desde su celular (confirmado en 1.0 s) y dijo: "qué rápida" |
| Tienda de ropa | Dueña | Entrevista sobre cómo vende (ver abajo) |

Lo que aprendí:
- Una amiga que no sabe nada de cripto pagó sola y dijo: "qué rápida". Sin billetera y sin registrarse.
- Una dueña de tienda de ropa no vende nada algunos días de semana y vende S/ 500–800 los fines de semana y feriados. Una cuota fija la haría caer en mora en semanas flojas; un porcentaje de cada venta sigue el ritmo de su negocio.
- La gente no entendía el link al explorador de blockchain en el comprobante ("¿qué es esto?"), así que ahora el comprobante se parece a un voucher de pago conocido y se puede compartir por WhatsApp. La prueba en la blockchain sigue disponible para jueces y auditores.

**Los próximos 100 usuarios.** En Perú, los comerciantes de mercado están organizados en asociaciones. El plan es presentar YAFI a dos asociaciones de mercado (Piura y Lima), con la meta de 50 comerciantes en cada una. Cada comerciante pone su QR de YAFI en el puesto, y sus clientes se vuelven usuarios. Mis 8 años en campo con pequeños negocios son el canal.

## Qué se construyó durante el hackathon

Todo lo de este repositorio se escribió durante el hackathon (octubre de 2026). No hay código previo.

| Pieza | Qué hace |
|---|---|
| `contracts/YafiCreditEscrowV2.sol` | Escrow que guarda la caja de préstamos, otorga créditos, divide cada venta entre el comerciante y el pago del préstamo, cobra interés simple sobre el capital y hace cumplir los controles de arriba. La retención tiene un tope fijo de 30%; protección contra reentrada, préstamos solo del dueño y errores personalizados. |
| `contracts/YafiCreditEscrow.sol` | La primera versión (v1), usada para la primera prueba en cadena. Misma lógica de división, sin los controles de riesgo. |
| `test/` | 45 pruebas en Hardhat: 32 del v2 (la escalera, interés solo sobre el capital, sin interés mientras está congelado, préstamos pendientes, autopago, venta mínima, avance por préstamo, la división, nunca cobrar de más, controles del administrador) y 13 del v1. |
| `app/` | App web para celular (ES/EN). **Pagar a Rosa** (cliente, con comprobante para compartir), **Vista de Rosa** (saldo del préstamo en vivo, ventas con sonido y voz, y el tamaño de su próximo préstamo) y un **panel de administración** (prestamista, con MetaMask). |
| `sponsor/` | Un pequeño Cloudflare Worker que envía 0.1 MON de prueba a cada visitante nuevo, para que nadie necesite billetera ni faucet. Su llave es un secreto de Cloudflare y nunca está en este repositorio. |

### En vivo en Monad Testnet

- **Contrato v2:** [`0x21B86c97989ae1962928706dCe8042568C340845`](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845), desplegado con Remix (Solidity 0.8.34) y con una caja de préstamos de 1 MON.
- **Comerciante de demo "Rosa":** [`0x44e0C28209F3c2735613b13c3813826A9eeC135D`](https://testnet.monadexplorer.com/address/0x44e0C28209F3c2735613b13c3813826A9eeC135D). Préstamo otorgado en el v2: S/ 500 (0.5 MON) con 10% de retención y 6% mensual.
- **Actividad en cadena:** los pagos de las pruebas con usuarios aparecen en la página del contrato en el explorador, cada uno con su retención al préstamo de Rosa.
- **Prueba del v1:** la primera versión, [`0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831`](https://testnet.monadexplorer.com/address/0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831), conserva la primera prueba en cadena: un préstamo de 0.5 MON y luego una venta de S/ 10 que dejó la deuda de Rosa en S/ 499.

## Pruébalo (jueces)

No necesitas billetera, faucet ni configuración.

1. En una computadora o celular, abre la **vista de Rosa**: https://judiweb3-cmd.github.io/yafi/app/#/rosa y toca **Activar sonido de ventas**.
2. En otro celular (o pestaña), abre **Pagar a Rosa**: https://judiweb3-cmd.github.io/yafi/app/#/escanear, elige un monto y paga. El primer pago tarda unos segundos mientras llega el saldo de prueba.
3. Recibes un comprobante que puedes compartir. En la pantalla de Rosa, la venta llega con el sonido de YAFI y una voz, y su deuda baja.
4. Para ver el lado de Monad, abre el [contrato en el explorador](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845).

La app sigue el idioma de tu navegador; el botón EN/ES lo cambia. Si el fondeador se queda sin saldo de prueba, la pantalla de pago ofrece **Pagar con MetaMask** (Monad Testnet, chain ID 10143) dentro de una opción plegada para jueces y desarrolladores.

Por diseño, clientes y comerciantes solo ven soles: ningún nombre de billetera, token ni red. La única palabra cripto está en esa opción plegada y en el panel del prestamista.

## Capturas

| Inicio | Comprobante | Vista de Rosa en vivo |
|---|---|---|
| ![Inicio](docs/screenshots/1-home.png) | ![Comprobante](docs/screenshots/3-paid.png) | ![Rosa](docs/screenshots/4-rosa.png) |


## Por qué Monad

Pagar por cada venta significa muchas transacciones diminutas por comerciante, de céntimos. Solo funciona si cada pago se confirma tan rápido como el pago por QR que reemplaza y casi no cuesta.

- **Velocidad:** bloques y finalidad en menos de un segundo ([documentación de Monad](https://docs.monad.xyz/)). El comprobante muestra el tiempo real de confirmación de cada pago.
- **Compatibilidad total con EVM:** un contrato estándar en Solidity, pruebas en Hardhat, despliegue en Remix y ethers.js, sin cambios.
- **Experiencia en vivo con eventos:** la pantalla de Rosa revisa los eventos `SaleProcessed` cada pocos segundos, así que la venta aparece en su celular casi en cuanto el cliente paga.

Dos particularidades de Monad marcaron el diseño ([Monad: diferencias con Ethereum](https://docs.monad.xyz/developer-essentials/differences)):
- **El gas se cobra sobre el límite, no sobre lo usado.** La app deja que ethers estime el límite exacto y guarda un margen en el saldo de prueba del cliente.
- **Saldo de reserva (10 MON por cuenta).** Un pago que deje una cuenta normal por debajo de 10 MON se revierte, salvo que la cuenta no haya enviado otra transacción en los últimos 3 bloques. Las cuentas de clientes pagan una venta a la vez; la app espera unos 2.5 segundos después de recibir el saldo de prueba y entre pagos de la misma cuenta. La cuenta del fondeador se mantiene sobre 10 MON.

## Arquitectura

```
 Celular del cliente (navegador)                    Monad Testnet
 ┌───────────────────────────┐   processSale()  ┌──────────────────────────────┐
 │ app/ · Pagar a Rosa        │ ───────────────► │ YafiCreditEscrowV2            │
 │ cuenta invisible (local)   │                  │  • retiene X% → préstamo+interés│
 └─────────────┬─────────────┘                  │  • paga el neto → Rosa (misma tx)│
               │ primera visita                  │  • actualiza deuda e historial│
               ▼                                 │                              │
 ┌───────────────────────────┐  0.1 MON prueba  │ grantCredit() ◄── prestamista│
 │ sponsor/ · Cloudflare      │ ───────────────► │                              │
 │ Worker (llave secreta)     │                  └──────────────┬───────────────┘
 └───────────────────────────┘                                 │ SaleProcessed
 ┌───────────────────────────┐   eventos / lecturas            │
 │ app/ · Vista de Rosa       │ ◄────────────────────────────────┘
 └───────────────────────────┘
 ┌───────────────────────────┐   grantCredit()
 │ app/ · Admin (MetaMask)    │ ─────────────────────────────►
 └───────────────────────────┘
```

- **Contrato:** guarda la caja, el registro de cada comerciante (`creditBalance`, `accruedInterest`, `currentLoan`, `creditLine`, `annualRateBps`, `frozen`, `totalRepaid`, `salesCount`, `loansRepaid`, `retentionBps`, `lastRepaymentAt`…) y la lógica de división. `previewSale` muestra la división antes de pagar, `currentDebt` incluye el interés a la fecha y `creditLimit` muestra cuánto puede pedir un comerciante ahora.
- **Frontend:** HTML, CSS y JavaScript estáticos, sin compilación. Habla con el RPC público de Monad mediante ethers.js. La imagen del comprobante se dibuja en el navegador.
- **Fondeador:** un único endpoint en Cloudflare Workers. Solo recarga cuentas con menos de 0.1 MON y solo acepta pedidos desde el dominio de la app.

## Tecnologías

Solidity 0.8.34 · Hardhat 2 (con hardhat-toolbox, Chai y Mocha) · ethers.js 6.17 · HTML/CSS/JS sin frameworks · Cloudflare Workers + Wrangler (fondeador) · Remix IDE + MetaMask (despliegue) · GitHub Pages (hosting) · Monad Testnet.

## Ejecútalo tú

Requisitos: Node.js 18+ y npm.

```bash
git clone https://github.com/judiweb3-cmd/yafi
cd yafi
npm install
npx hardhat test          # 45 pasan
```

**Despliega tu propio contrato (opcional).** Pega `contracts/YafiCreditEscrowV2.sol` en [Remix](https://remix.ethereum.org), compila con 0.8.34 y despliega con MetaMask en Monad Testnet con los argumentos `_firstLoanCap = 500000000000000000` (0.5 MON), `_maxLoanCap = 5000000000000000000` (5 MON), `_minSaleAmount = 1000000000000000` (0.001 MON) y `_maxAnnualRateBps = 7500` (75% al año), o usa Hardhat:

```bash
cp .env.example .env      # agrega la PRIVATE_KEY de una billetera solo de testnet
INITIAL_TREASURY=1 npm run deploy:testnet          # v2; VERSION=1 despliega el v1
```

En Monad, pon un límite de gas manual (unos 4,000,000 para el v2) y deja al que despliega con más de 10 MON después de cualquier envío de valor. Luego fondea la caja con `fundTreasury()` y llama `grantCredit(comerciante, montoEnWei, retencionBps, tasaAnualBps)` desde la cuenta dueña, por ejemplo `grantCredit(<comerciante>, 500000000000000000, 1000, 7200)` para 0.5 MON, 10% de retención por venta y 72% de interés simple anual (6% mensual).

**Corre la app en tu compu.** Pon `contract` y `merchant` en `app/config.js` y sirve la carpeta:

```bash
npx serve app             # o: python3 -m http.server -d app 8080
```

Rutas: `#/` inicio, `#/escanear` pagar a Rosa, `#/rosa` vista del comerciante, `#/admin` panel del prestamista.

**Despliega el fondeador (opcional).** Desde `sponsor/`, con una cuenta de Cloudflare y una billetera solo de testnet:

```bash
npm install
npx wrangler secret put SPONSOR_KEY   # pega la llave privada; queda guardada en Cloudflare
npx wrangler deploy
```

Pon el dominio de tu app en `ALLOWED_ORIGINS` de `sponsor/wrangler.toml`, y la URL resultante como `sponsorUrl` en `app/config.js`.

## Mensajes de error del contrato

El v2 usa errores personalizados de Solidity con nombres en inglés (`SaleBelowMinimum`, `SelfPayment`, `OutstandingLoan`, `AboveCreditLimit`, `RateAboveMaximum`, `MerchantFrozen`, `NotOwner`, `InsufficientTreasury`, `RetentionOutOfRange`…), y la app los convierte en mensajes simples en español o inglés.

Los comentarios y mensajes de error del contrato v1 están en español, para el mercado objetivo. El código desplegado debe coincidir exactamente con este archivo para verificarlo en el explorador, así que se publica sin cambios.

## Ruta legal para lanzar

Perú no tiene una ley específica para cripto, así que un YAFI real se diseñaría para encajar en reglas que ya existen:

- **Préstamos:** un YAFI real prestaría con fondos propios. En Perú eso no requiere licencia de banco, solo inscribirse en la SBS para la supervisión antilavado ([Res. SBS 00650-2024](https://busquedas.elperuano.pe/dispositivo/NL/2264383-1)). Las tasas tendrían que quedar por debajo del máximo del BCRP para operaciones fuera del sistema financiero (a confirmar con un abogado); el contrato ya aplica un tope de tasa.
- **Pagos:** los clientes pagarían por un proveedor de pagos con licencia, como las redes de tarjetas o una billetera autorizada, así que YAFI nunca tendría el dinero de los comercios ([Circular BCRP 0026-2026](https://busquedas.elperuano.pe/dispositivo/NL/2561268-1)).
- **Blockchain:** Monad sería el registro interno. Los usuarios solo ven soles y nunca compran, guardan ni cambian cripto.
- **Piloto:** desde 2025, el sandbox de la SBS también acepta empresas que la SBS no supervisa ([Res. SBS 04142-2025](https://busquedas.elperuano.pe/dispositivo/NL/2461089-1)). El siguiente paso es un piloto supervisado ahí, junto con un aliado regulado.

## Limitaciones (estado honesto)

- Es un **prototipo en testnet**: el MON de prueba reemplaza a los soles con una tasa de demo de 1 sol = 0.001 MON.
- Un solo administrador define préstamos y retención; todavía no hay calificación automática.
- La cuenta invisible del cliente guarda su llave en el localStorage del navegador, aceptable solo en testnet.
- El fondeador no tiene límite de pedidos: un script podría pedir saldo de prueba para muchas cuentas nuevas. En testnet se acepta y su saldo se mantiene bajo.
- Los contratos no han sido auditados. Una revisión de código asistida por IA del v1 encontró tres límites del contrato. El v2 corrige dos: las ventas diminutas y los autopagos ya no inflan `salesCount`, y el avance del pago se mide por préstamo. El tercero sigue: un cliente puede pagarle al comerciante por fuera del contrato; el préstamo solo se paga con las ventas que pasan por YAFI.
- El bloqueo de autopago impide que el comerciante pague desde su propia cuenta, no desde una segunda cuenta que controle. En producción, la calificación debe pesar el monto pagado y muchos pagadores distintos, no solo el número de ventas.
- YAFI no es un banco y no capta depósitos. En Perú, captar depósitos del público requiere autorización de la SBS (art. 11, Ley 26702).
- Un lanzamiento con activos virtuales probablemente tendría que registrarse como proveedor de servicios de activos virtuales ante la UIF (DS 006-2023-JUS).
- Antes de lanzar, un abogado peruano debe validar este diseño.

## Hoja de ruta

- Un motor de riesgo sobre la escalera del v2: tasas y líneas que reaccionan a la velocidad de pago y a cómo evolucionan las ventas.
- Trabajadores informales independientes que cobran por día o por semana (no solo comerciantes).
- Alianzas con prestamistas regulados y cajas municipales que usarían el historial de comportamiento.
- Ahorro con rendimiento solo a través de un aliado con licencia.
- Alertas por días sin pagos, en tramos de 3–7, 8–15, 16–30 y más de 30 días, leídos de `lastRepaymentAt`. Los mensajes se envían solo con el consentimiento del comerciante y nunca fuera del horario que permite la ley peruana de protección al consumidor.
- Pagos en soles. Un registro en soles evita prestar dólares a comerciantes que ganan en soles, lo que sumaría riesgo cambiario.
- Seguridad para producción: una llave de administrador multifirma con retardo, y una lista de permitidos para que solo proveedores de pago con licencia registren ventas.
- Una voz de marca grabada para el aviso de venta, y un dominio propio.

## Créditos

- [ethers.js](https://github.com/ethers-io/ethers.js) v6.17 (MIT), incluido en `app/vendor/ethers.umd.min.js` y usado por el fondeador.
- [Hardhat](https://hardhat.org) y `@nomicfoundation/hardhat-toolbox` (MIT), para compilar y probar.
- [Wrangler](https://github.com/cloudflare/workers-sdk) (MIT/Apache-2.0) y Cloudflare Workers, para el fondeador.
- [Remix IDE](https://remix.ethereum.org) y MetaMask, para desplegar.
- [Rates by Exchange Rate API](https://www.exchangerate-api.com), para la referencia en dólares en vivo que se muestra en inglés.
- Las cifras de mercado vienen de fuentes públicas, enlazadas en el texto.

## Uso de herramientas de IA

Como piden las reglas del hackathon, declaro que este proyecto se construyó con la ayuda de un asistente de programación con IA, **Claude (Anthropic)**. Redactó el contrato inteligente, las pruebas, el frontend, el servicio fondeador y la documentación. Yo definí el producto y la lógica de crédito desde mis 8 años como asesora de negocios en microcrédito, revisé cada paso, desplegué los contratos y el fondeador, e hice las pruebas en cadena y con usuarios. Es mi primer proyecto técnico: no soy programadora, pero estoy en proceso de aprendizaje.

## Licencia

[MIT](LICENSE). El nombre y la marca YAFI están reservados y no están cubiertos por la licencia.
