package br.gov.pr.cbm.sysarp.link

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import dji.sdk.keyvalue.key.FlightControllerKey
import dji.sdk.keyvalue.key.BatteryKey
import dji.sdk.keyvalue.key.AirLinkKey
import dji.sdk.keyvalue.key.ComponentIndexType
import dji.v5.manager.KeyManager
import kotlinx.coroutines.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.ConcurrentLinkedQueue

data class BatteryInfo(
    val sn: String,
    val cycles: Int,
    val voltage: Double,
    val temperature: Double
)

data class TelemetryPacket(
    val pilot_id: String,
    val drone_sn: String,
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val battery_percent: Int,
    val batteries: List<BatteryInfo>, // Informação detalhada de cada pack
    val signal: Int,
    val speed_h: Double,
    val speed_v: Double,
    val motors_on: Boolean,
    val flight_mode: String,
    val system_status: String,
    val timestamp: Long = System.currentTimeMillis()
)

interface SysarpApi {
    @POST("api/telemetry/stream")
    suspend fun sendTelemetry(@Body data: List<TelemetryPacket>): retrofit2.Response<Unit>
}

class TelemetryService : Service() {
    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.Main + serviceJob)
    private var api: SysarpApi? = null
    private var pilotId = ""
    private val telemetryBuffer = ConcurrentLinkedQueue<TelemetryPacket>()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val serverUrl = intent?.getStringExtra("SERVER_URL") ?: ""
        pilotId = intent?.getStringExtra("PILOT_ID") ?: "UNKNOWN"

        if (serverUrl.isNotEmpty()) {
            val retrofit = Retrofit.Builder()
                .baseUrl(serverUrl)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            api = retrofit.create(SysarpApi::class.java)
        }

        createNotificationChannel()
        startForeground(1, NotificationCompat.Builder(this, "TELEMETRY_CHAN")
            .setContentTitle("SYSARP Link Ativo")
            .setContentText("Sincronizando telemetria e ciclos de bateria...")
            .setSmallIcon(android.R.drawable.ic_menu_compass).build())

        startTelemetryLoop()
        startSyncLoop()
        return START_STICKY
    }

    private fun startTelemetryLoop() {
        serviceScope.launch {
            while (isActive) {
                try {
                    val pos = KeyManager.getInstance().getValue(FlightControllerKey.KeyAircraftLocation)
                    val droneSn = KeyManager.getInstance().getValue(FlightControllerKey.KeySerialNumber) ?: "N/A"
                    
                    if (pos != null) {
                        val batteryList = mutableListOf<BatteryInfo>()
                        
                        // Captura dados dos slots (Enterprise: LEFT/RIGHT, Consumidor: Nulo)
                        val slots = listOf(ComponentIndexType.LEFT, ComponentIndexType.RIGHT, null)
                        
                        for (slot in slots) {
                            val sn = if (slot == null) KeyManager.getInstance().getValue(BatteryKey.KeySerialNumber)
                                     else KeyManager.getInstance().getValue(BatteryKey.KeySerialNumber.create(slot))
                            
                            if (!sn.isNullOrEmpty()) {
                                val cycles = (if (slot == null) KeyManager.getInstance().getValue(BatteryKey.KeyCycleCount)
                                             else KeyManager.getInstance().getValue(BatteryKey.KeyCycleCount.create(slot))) ?: 0
                                
                                val volt = (if (slot == null) KeyManager.getInstance().getValue(BatteryKey.KeyVoltage)
                                            else KeyManager.getInstance().getValue(BatteryKey.KeyVoltage.create(slot)))?.toDouble() ?: 0.0
                                
                                val temp = (if (slot == null) KeyManager.getInstance().getValue(BatteryKey.KeyBatteryTemperature)
                                            else KeyManager.getInstance().getValue(BatteryKey.KeyBatteryTemperature.create(slot))) ?: 0.0
                                
                                batteryList.add(BatteryInfo(sn, cycles, volt / 1000.0, temp))
                            }
                        }

                        val packet = TelemetryPacket(
                            pilot_id = pilotId,
                            drone_sn = droneSn,
                            latitude = pos.latitude,
                            longitude = pos.longitude,
                            altitude = KeyManager.getInstance().getValue(FlightControllerKey.KeyAltitude) ?: 0.0,
                            battery_percent = KeyManager.getInstance().getValue(BatteryKey.KeyChargeRemainingInPercent) ?: 0,
                            batteries = batteryList,
                            signal = KeyManager.getInstance().getValue(AirLinkKey.KeySignalQuality) ?: 0,
                            speed_h = calculateSpeedH(),
                            speed_v = KeyManager.getInstance().getValue(FlightControllerKey.KeyAircraftVelocityZ) ?: 0.0,
                            motors_on = KeyManager.getInstance().getValue(FlightControllerKey.KeyAreMotorsOn) ?: false,
                            flight_mode = KeyManager.getInstance().getValue(FlightControllerKey.KeyFlightModeString) ?: "N/A",
                            system_status = KeyManager.getInstance().getValue(FlightControllerKey.KeySystemStatus).toString()
                        )
                        telemetryBuffer.add(packet)
                        if (telemetryBuffer.size > 3600) telemetryBuffer.poll()
                    }
                } catch (e: Exception) { e.printStackTrace() }
                delay(1000) 
            }
        }
    }

    private fun calculateSpeedH(): Double {
        val vx = KeyManager.getInstance().getValue(FlightControllerKey.KeyAircraftVelocityX) ?: 0.0
        val vy = KeyManager.getInstance().getValue(FlightControllerKey.KeyAircraftVelocityY) ?: 0.0
        return Math.sqrt(vx * vx + vy * vy)
    }

    private fun startSyncLoop() {
        serviceScope.launch(Dispatchers.IO) {
            while (isActive) {
                if (telemetryBuffer.isNotEmpty() && api != null) {
                    try {
                        val toSend = telemetryBuffer.toList()
                        if (api?.sendTelemetry(toSend)?.isSuccessful == true) {
                            repeat(toSend.size) { telemetryBuffer.poll() }
                        }
                    } catch (e: Exception) {}
                }
                delay(2000)
            }
        }
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("TELEMETRY_CHAN", "Telemetria", NotificationManager.IMPORTANCE_LOW))
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { serviceJob.cancel(); super.onDestroy() }
}