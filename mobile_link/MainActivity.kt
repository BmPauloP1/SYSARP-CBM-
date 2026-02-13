package br.gov.pr.cbm.sysarp.link

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import dji.v5.common.error.IDJIError
import dji.v5.common.register.DJISDKInitEvent
import dji.v5.manager.SDKManager
import dji.v5.manager.interfaces.SDKManagerCallback

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var btnToggle: Button
    private var isServiceRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main) // Assume layout simples com IDs abaixo

        val editUrl = findViewById<EditText>(R.id.editServerUrl)
        val editPilot = findViewById<EditText>(R.id.editPilotId)
        statusText = findViewById(R.id.txtStatus)
        btnToggle = findViewById(R.id.btnToggleService)

        // Inicializar SDK DJI
        SDKManager.getInstance().init(this, object : SDKManagerCallback {
            override fun onInitProcess(event: DJISDKInitEvent?, error: IDJIError?) {
                if (error == null) {
                    runOnUiThread { statusText.text = "DJI SDK Pronto. Aguardando Aeronave." }
                } else {
                    runOnUiThread { statusText.text = "Erro SDK: ${error.description()}" }
                }
            }
            override fun onRegisterSuccess() {}
            override fun onRegisterFailure(error: IDJIError?) {}
            override fun onProductDisconnect(productId: Int) {}
            override fun onProductConnect(productId: Int) {}
            override fun onProductChanged(productId: Int) {}
            override fun onDatabaseDownloadProgress(current: Long, total: Long) {}
        })

        btnToggle.setOnClickListener {
            if (!isServiceRunning) {
                val intent = Intent(this, TelemetryService::class.java).apply {
                    putExtra("SERVER_URL", editUrl.text.toString())
                    putExtra("PILOT_ID", editPilot.text.toString())
                }
                startForegroundService(intent)
                btnToggle.text = "PARAR TELEMETRIA"
                isServiceRunning = true
            } else {
                stopService(Intent(this, TelemetryService::class.java))
                btnToggle.text = "INICIAR TELEMETRIA"
                isServiceRunning = false
            }
        }
    }
}