# 🚁 SYSARP Mobile Link - Guia de Implementação

Este módulo é responsável por conectar o hardware da DJI (Série Enterprise) diretamente ao Centro de Comando Operacional (CCO) do SYSARP, permitindo telemetria em tempo real e gestão automatizada de ativos (baterias/hélices).

## 🛠️ Passo a Passo para Configuração

### 1. Registro do App (DJI Developer)
1. Acesse [developer.dji.com](https://developer.dji.com).
2. Crie um novo App:
   - **SDK Type:** Mobile SDK V5.
   - **App Name:** SYSARP Link.
   - **Package Name:** `br.gov.pr.cbm.sysarp.link` (CRÍTICO: Deve ser idêntico).
   - **Category:** Public Safety.
3. Copie a `App Key`.

### 2. Preparação do Ambiente Android
1. Instale o **Android Studio Hedgehog** (ou superior).
2. Certifique-se de ter o **JDK 17** configurado.
3. Substitua os arquivos da pasta `app/src/main/` pelos arquivos fornecidos neste diretório:
   - `AndroidManifest.xml` (Insira sua App Key aqui).
   - `java/br/gov/pr/cbm/sysarp/link/MainActivity.kt`.
   - `java/br/gov/pr/cbm/sysarp/link/TelemetryService.kt`.

### 3. Build e Instalação
1. No Android Studio, vá em `Build > Build APK(s)`.
2. Transfira o arquivo `.apk` para o Smart Controller (M30T / M350 / M3E).
3. Habilite "Fontes Desconhecidas" nas configurações do Android do controle.
4. Conceda permissão de **Localização (Sempre)** e **Notificações**.

## 📡 Sincronização de Telemetria e Hardware

### Configuração de Rede
- **Server URL:** Informe a URL do seu servidor SYSARP (ex: `https://sysarp.mil.br`). O app enviará dados para o endpoint `/api/telemetry/stream`.
- **Protocolo:** O envio é feito via HTTPS/JSON com buffer offline automático. Se o 4G/5G oscilar, os dados são armazenados e reenviados em lote.

### Reconhecimento de Baterias (Almoxarifado)
- O app lê o **Número de Série (SN)** e o **Contador de Ciclos** gravado no chip interno de cada bateria da DJI.
- Ao receber esses dados, o servidor busca o material correspondente no almoxarifado do sistema.
- **Automação:** Os ciclos no banco de dados são atualizados instantaneamente assim que o drone decola, sem necessidade de entrada manual pelo piloto.

## 🛡️ Segurança
- O serviço roda como um `Foreground Service` com uma notificação persistente para garantir que o Android não feche o processo durante o voo.
- Todos os dados trafegam de forma privada entre o controle e o seu servidor.