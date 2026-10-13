# YAFI · Tus ventas son tu crédito

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
4. **Cada venta y cada pago quedan registrados en la cadena.** Ese historial de comportamiento (número de ventas, monto pagado) es la base para préstamos más grandes y para un historial crediticio de la economía informal.

El cliente nunca ve una billetera, unas palabras secretas ni la palabra "blockchain": la app crea una cuenta invisible en el navegador y muestra los precios en soles.

## Qué construimos durante el hackathon

Todo el código de este repositorio se escribió durante el hackathon (octubre de 2026). No hay código previo.

| Pieza | Qué hace |
|---|---|
| `contracts/YafiCreditEscrow.sol` | Escrow que guarda la caja de préstamos, otorga créditos y divide cada venta entre el comerciante y el pago del préstamo. Retención en puntos básicos con tope de 30%, protección anti-reentrada y solo el administrador puede prestar. |
| `test/YafiCreditEscrow.test.js` | 13 pruebas en Hardhat: fondeo, reglas de préstamo, división de la venta, nunca cobrar de más, cierre de la línea al 100%, líneas congeladas, retiros de caja y control de acceso. |
| `app/` | App web móvil (ES/EN). **Pagar a Rosa** (cliente), **Vista de Rosa** (saldo del préstamo y ventas en vivo, leídos de los eventos del contrato) y **panel de administración** (prestamista, con MetaMask). |

### En vivo en Monad Testnet

- Contrato: [`0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831`](https://testnet.monadexplorer.com/address/0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831), desplegado con Remix (Solidity 0.8.34) con una caja de 5 MON.
- Comerciante de la demo, "Rosa": [`0x44e0C28209F3c2735613b13c3813826A9eeC135D`](https://testnet.monadexplorer.com/address/0x44e0C28209F3c2735613b13c3813826A9eeC135D).
- Prueba en la cadena: se le otorgó a Rosa un préstamo de 0.5 MON (S/ 500 al tipo de cambio de la demo), y luego una venta de S/ 10 dejó su deuda en S/ 499, con 1 venta registrada. Todas las transacciones se ven en la página del contrato en el explorador.

## Pruébalo (jueces)

1. Abre la **demo en vivo** en tu celular o computadora. Se muestra en el idioma de tu navegador, y el botón ES/EN lo cambia.
2. Toca **Pagar a Rosa**, elige un monto y paga. Verás cuánto recibe Rosa y cuánto va a su préstamo, luego el tiempo de confirmación y un enlace al comprobante en el explorador.
3. Abre **Ver como Rosa** en otra pestaña o celular para ver bajar su deuda en vivo con cada venta.

**Saldo de prueba.** La cuenta invisible empieza vacía, y en este repositorio no se publica ninguna clave privada (regla 5.3 del hackathon). Si no tiene saldo, la app ofrece dos opciones:
- **Pagar con mi billetera:** pagar directo desde MetaMask en Monad Testnet (chain ID 10143, RPC `https://testnet-rpc.monad.xyz`).
- **Enviar el código:** copiar el código de la cuenta y abrir un issue en este repositorio. El equipo de YAFI envía MON de prueba desde el panel de administración.

## Capturas

Ver las capturas de la app y la prueba en Monad Testnet en el [README en inglés](README.md#screenshots).

## Por qué Monad

Pagar el préstamo venta por venta significa muchas transacciones diminutas por comerciante, de céntimos. Solo funciona si cada pago se confirma tan rápido como el pago con QR que reemplaza y cuesta casi nada.

- **Velocidad:** bloques de 300 ms y finalidad de 600 ms ([documentación de Monad](https://docs.monad.xyz/)). La app muestra el tiempo real de confirmación después de cada pago.
- **Compatibilidad total con EVM:** un contrato estándar en Solidity, pruebas en Hardhat, despliegue con Remix y ethers.js, sin cambios.
- **Experiencia en vivo con eventos:** la pantalla de Rosa consulta los eventos `SaleProcessed` cada pocos segundos, así que la venta aparece en su celular casi en cuanto el cliente paga.

Dos particularidades de Monad guiaron el diseño ([documentación de Monad: diferencias con Ethereum](https://docs.monad.xyz/developer-essentials/differences)):
- **El gas se cobra sobre el límite reservado, no sobre el usado.** La app deja que ethers calcule el límite exacto y mantiene un margen en el saldo de prueba del cliente.
- **Saldo de reserva (10 MON por cuenta).** Un pago que dejaría una cuenta normal por debajo de 10 MON se revierte, salvo que esa cuenta no haya enviado otra transacción en los últimos 3 bloques. Las cuentas de los clientes pagan una venta a la vez, lo que encaja en esa excepción.

## Arquitectura

Ver el diagrama en el [README en inglés](README.md#architecture).

- **Contrato:** guarda la caja, el registro de cada comerciante (`creditBalance`, `totalGranted`, `totalRepaid`, `salesCount`, `retentionBps`, `isActive`) y la lógica de división. `previewSale` muestra la división antes de pagar.
- **Frontend:** HTML, CSS y JavaScript estáticos, sin compilación ni servidor propio. Se conecta al RPC público de Monad con ethers.js.

## Tecnologías

Solidity 0.8.34 · Hardhat 2 (hardhat-toolbox, Chai, Mocha) · ethers.js 6.17 · HTML/CSS/JS · Remix IDE + MetaMask (despliegue) · GitHub Pages (alojamiento) · Monad Testnet.

## Ejecutarlo tú mismo

Requisitos: Node.js 18+ y npm.

```bash
git clone https://github.com/judiweb3-cmd/yafi
cd yafi
npm install
npx hardhat test          # 13 pruebas en verde
```

Para desplegar tu propio contrato, para la app local y para la tabla de mensajes de error, ver las secciones correspondientes del [README en inglés](README.md#run-it-yourself).

## Limitaciones (estado honesto)

- Es un **prototipo en testnet**: el MON de prueba representa soles con una tasa de demo de 1 sol = 0.001 MON.
- Un solo administrador define préstamos y retención; todavía no hay scoring automático.
- La cuenta invisible del cliente guarda su clave en el navegador (localStorage), aceptable solo en testnet.
- El contrato no ha sido auditado.
- YAFI no es un banco y no capta depósitos. En Perú, captar ahorro del público requiere autorización de la SBS (art. 11, Ley 26702).

## Hoja de ruta

- Niveles de crédito que premian el pago puntual con mejores tasas o líneas más grandes.
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
