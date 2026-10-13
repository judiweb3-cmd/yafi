# YAFI · ¡Finanzas YA!

**Cobra, crece y paga desde tu celular.** Tus ventas son tu crédito.

> Una app de pagos que nunca menciona la blockchain. Cada venta por QR que recibe un comerciante informal paga automáticamente un pequeño microcrédito en **Monad**, y construye el historial crediticio que nunca tuvo.

**Track:** Consumer Products & Payments · Monad Metropolis Hackathon 2026
**Demo en vivo:** https://judiweb3-cmd.github.io/yafi/ (Monad Testnet)
**Contrato:** [`0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831`](https://testnet.monadexplorer.com/address/0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831) en Monad Testnet (chain ID 10143)

🇬🇧 [Read in English](README.md)

---

## El problema

Cerca del **70% de los trabajadores en Perú son informales** ([INEI, 2025](https://www.expreso.com.pe/economia/formalizacion-laboral-impulsaria-crecimiento-en-peru-mas-del-70-de-trabajadores-sigue-en-informalidad-epen-inei-noticia/1283864/)). Una vendedora como Rosa (ejemplo ilustrativo, no es una usuaria real) vende desayunos en su carrito todos los días, y muchos clientes ya le pagan escaneando un QR con su billetera móvil. Pero no tiene boletas ni historial crediticio formal, así que el banco le dice que no.

Cuando necesita capital de trabajo, muchas veces le queda el **gota a gota**. Un estudio del IPE encontró que unas **211,000 familias peruanas** lo usaron en un año, y que **la mitad de quienes se prestan informalmente paga más de 500% al año** ([IPE en Gestión, 2024](https://gestion.pe/tu-dinero/finanzas-personales/prestamos-gota-a-gota-acechan-a-211000-familias-cuanto-cobran-informalidad-noticia/)).

Rosa sí tiene algo que a un prestamista le interesa: un flujo constante de ventas diarias. YAFI convierte ese flujo en crédito.

## Cómo funciona

1. **El prestamista otorga un microcrédito** (en la demo: S/ 500 con 10% de retención por venta, tope de 30%). El dinero llega al instante a la billetera de Rosa.
2. **Un cliente le paga a Rosa con QR**, como ya lo hace con las billeteras móviles.
3. **El contrato inteligente divide cada venta en la misma transacción:** el 90% le llega a Rosa al instante y el 10% paga su préstamo. Sin cuotas fijas, sin ir a una agencia y sin cobradores.
4. **Cada venta y cada pago quedan registrados en la cadena.** Ese historial de comportamiento (número de ventas, monto pagado, préstamos pagados por completo) es la base para préstamos más grandes y para un historial crediticio de la economía informal.

## Controles de riesgo que el contrato hace cumplir (v2)

Tres reglas que las microfinancieras aplican a mano están escritas en `YafiCreditEscrowV2`, así que ningún administrador puede saltárselas:

| Regla | Qué hace el contrato | Por qué la usan los prestamistas |
|---|---|---|
| **Escalera de crédito** | El primer préstamo tiene tope (demo: S/ 500). Solo se puede dar uno nuevo cuando el actual está pagado por completo, y como máximo por el 150% del anterior. | Un primer préstamo pequeño limita la pérdida con un cliente nuevo; la línea crece solo con pagos demostrados. |
| **Sin autopago** | Un comerciante no puede pagar su propio QR. | Evita que alguien haga circular su propio dinero para fingir un historial de ventas. |
| **Venta mínima** | Se rechazan ventas por debajo de un mínimo (demo: S/ 1). | Evita que pagos diminutos inflen el número de ventas que se usa como historial. |

El paso de 150% y los límites de la demo son parámetros ilustrativos del prototipo, no cifras de un regulador. El tope y el mínimo se fijan al desplegar y el administrador puede cambiarlos con `setLimits`.

El cliente nunca ve una billetera, unas palabras secretas ni la palabra "blockchain": la app crea una cuenta invisible en el navegador y muestra los precios en soles.

## Qué construimos durante el hackathon

Todo el código de este repositorio se escribió durante el hackathon (octubre de 2026). No hay código previo.

| Pieza | Qué hace |
|---|---|
| `contracts/YafiCreditEscrowV2.sol` | Escrow que guarda la caja de préstamos, otorga créditos y divide cada venta entre el comerciante y el pago del préstamo, más los tres controles de riesgo de arriba. Retención en puntos básicos con tope de 30%, protección anti-reentrada, solo el administrador puede prestar y errores personalizados. |
| `contracts/YafiCreditEscrow.sol` | La primera versión (v1), usada en la primera prueba en la cadena. Misma división, sin los controles de riesgo. |
| `test/` | 31 pruebas en Hardhat: 18 para v2 (escalera, préstamo pendiente, autopago, venta mínima, avance por préstamo, división, nunca cobrar de más, líneas congeladas, controles del administrador) y 13 para v1. |
| `app/` | App web móvil (ES/EN). **Pagar a Rosa** (cliente), **Vista de Rosa** (saldo del préstamo, ventas en vivo leídas de los eventos del contrato y el tamaño de su próximo préstamo) y **panel de administración** (prestamista, con MetaMask, con la línea disponible para Rosa). La app detecta si el contrato es v1 o v2. |

### En vivo en Monad Testnet

- Contrato: [`0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831`](https://testnet.monadexplorer.com/address/0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831), desplegado con Remix (Solidity 0.8.34) con una caja de 5 MON.
- Comerciante de la demo, "Rosa": [`0x44e0C28209F3c2735613b13c3813826A9eeC135D`](https://testnet.monadexplorer.com/address/0x44e0C28209F3c2735613b13c3813826A9eeC135D).
- Este primer despliegue es el v1. El contrato v2 con los controles de riesgo está probado localmente (31 pruebas en verde) y lo reemplazará en Monad Testnet.
- Prueba en la cadena: se le otorgó a Rosa un préstamo de 0.5 MON (S/ 500 al tipo de cambio de la demo), y luego una venta de S/ 10 dejó su deuda en S/ 499, con 1 venta registrada. Todas las transacciones se ven en la página del contrato en el explorador.

## Pruébalo (jueces)

1. Abre la **demo en vivo** en tu celular o computadora. Se muestra en el idioma de tu navegador, y el botón ES/EN lo cambia.
2. Toca **Pagar a Rosa**, elige un monto y paga. Verás cuánto recibe Rosa y cuánto va a su préstamo, luego el tiempo de confirmación y un enlace al comprobante en el explorador.
3. Abre **Ver como Rosa** en otra pestaña o celular para ver bajar su deuda en vivo con cada venta.

**Saldo de prueba.** La cuenta invisible empieza vacía, y en este repositorio no se publica ninguna clave privada (regla 5.3 del hackathon). Si no tiene saldo, la app ofrece dos opciones:
- **Para jueces y desarrolladores → Pagar con MetaMask:** pagar directo desde MetaMask. La app cambia (o agrega) la red Monad Testnet por ti (chain ID 10143).
- **Enviar el código de activación:** copiarlo y abrir un issue en este repositorio. El equipo de YAFI envía saldo de prueba desde el panel de administración.

Por diseño, clientes y comerciantes solo ven soles: ni billeteras, ni tokens, ni nombres de redes. El único lenguaje cripto de la app está en esa opción plegada para jueces y desarrolladores, y en el panel de administración del prestamista.

## Capturas

Ver las capturas de la app y la prueba en Monad Testnet en el [README en inglés](README.md#screenshots).

## Por qué Monad

Pagar el préstamo venta por venta significa muchas transacciones diminutas por comerciante, de céntimos. Solo funciona si cada pago se confirma tan rápido como el pago con QR que reemplaza y cuesta casi nada.

- **Velocidad:** bloques de 300 ms y finalidad de 600 ms ([documentación de Monad](https://docs.monad.xyz/)). La app muestra el tiempo real de confirmación después de cada pago.
- **Compatibilidad total con EVM:** un contrato estándar en Solidity, pruebas en Hardhat, despliegue con Remix y ethers.js, sin cambios.
- **Experiencia en vivo con eventos:** la pantalla de Rosa consulta los eventos `SaleProcessed` cada pocos segundos, así que la venta aparece en su celular casi en cuanto el cliente paga.

Dos particularidades de Monad guiaron el diseño ([documentación de Monad: diferencias con Ethereum](https://docs.monad.xyz/developer-essentials/differences)):
- **El gas se cobra sobre el límite reservado, no sobre el usado.** La app deja que ethers calcule el límite exacto y mantiene un margen en el saldo de prueba del cliente.
- **Saldo de reserva (10 MON por cuenta).** Un pago que dejaría una cuenta normal por debajo de 10 MON se revierte, salvo que esa cuenta no haya enviado otra transacción en los últimos 3 bloques. Las cuentas de los clientes pagan una venta a la vez, y la app espera unos 2.5 segundos entre pagos de la misma cuenta para cumplir esa excepción.

## Arquitectura

Ver el diagrama en el [README en inglés](README.md#architecture).

- **Contrato:** guarda la caja, el registro de cada comerciante (`creditBalance`, `currentLoan`, `totalGranted`, `totalRepaid`, `salesCount`, `loansRepaid`, `retentionBps`, `isActive`) y la lógica de división. `previewSale` muestra la división antes de pagar y `creditLimit` muestra cuánto puede pedir prestado un comerciante ahora.
- **Frontend:** HTML, CSS y JavaScript estáticos, sin compilación ni servidor propio. Se conecta al RPC público de Monad con ethers.js.

## Tecnologías

Solidity 0.8.34 · Hardhat 2 (hardhat-toolbox, Chai, Mocha) · ethers.js 6.17 · HTML/CSS/JS · Remix IDE + MetaMask (despliegue) · GitHub Pages (alojamiento) · Monad Testnet.

## Ejecutarlo tú mismo

Requisitos: Node.js 18+ y npm.

```bash
git clone https://github.com/judiweb3-cmd/yafi
cd yafi
npm install
npx hardhat test          # 31 pruebas en verde
```

Para desplegar tu propio contrato, para la app local y para la tabla de mensajes de error, ver las secciones correspondientes del [README en inglés](README.md#run-it-yourself).

## Limitaciones (estado honesto)

- Es un **prototipo en testnet**: el MON de prueba representa soles con una tasa de demo de 1 sol = 0.001 MON.
- Un solo administrador define préstamos y retención; todavía no hay scoring automático.
- La cuenta invisible del cliente guarda su clave en el navegador (localStorage), aceptable solo en testnet.
- Los contratos no han sido auditados. Una revisión independiente del v1 encontró tres límites del contrato. El v2 corrige dos: las ventas diminutas o autopagadas ya no inflan `salesCount`, y el avance del pago se mide por préstamo. Queda el tercero:
  - Un cliente todavía puede pagarle al comerciante por fuera del contrato; la retención solo ocurre en las ventas que pasan por YAFI.
- El bloqueo de autopago impide que el comerciante pague desde su propia cuenta, no desde una segunda cuenta que controle. En producción, el scoring debería pesar el monto pagado y muchos pagadores distintos, no solo el número de ventas.
- Por la regla de saldo de reserva de Monad, una cuenta de cliente con poco saldo solo puede pagar si no envió otra transacción en los últimos 3 bloques, así que la app espacia los pagos seguidos unos 2.5 segundos.
- YAFI no es un banco y no capta depósitos. En Perú, captar ahorro del público requiere autorización de la SBS (art. 11, Ley 26702).

## Hoja de ruta

- Un motor de riesgo sobre la escalera del v2: tasas y tamaños de línea que respondan a la velocidad de pago y a la evolución de las ventas.
- Trabajadores independientes informales que cobran diario o semanal, no solo comerciantes.
- Alianzas con entidades reguladas y cajas municipales que usen el historial de comportamiento.
- Ahorro con rendimiento solo a través de un aliado con licencia.

## Créditos

- [ethers.js](https://github.com/ethers-io/ethers.js) v6.17 (MIT), incluido en `app/vendor/ethers.umd.min.js`.
- [Hardhat](https://hardhat.org) y `@nomicfoundation/hardhat-toolbox` (MIT), para compilar y probar.
- [Remix IDE](https://remix.ethereum.org) y MetaMask, para el despliegue.
- Las cifras de mercado vienen de fuentes públicas, enlazadas en el texto.

## Uso de herramientas de IA

Como exigen las reglas del hackathon, declaramos que este proyecto se construyó con ayuda de un asistente de programación con IA, **Claude (Anthropic)**. La IA redactó el contrato, las pruebas, el frontend y la documentación. Quien fundó el proyecto definió el producto y la lógica de crédito, a partir de 8 años de experiencia en microcrédito para pequeños negocios; revisó cada paso, desplegó el contrato e hizo las pruebas en la cadena.

## Licencia

[MIT](LICENSE). El nombre y la marca YAFI están reservados y no están cubiertos por la licencia.
