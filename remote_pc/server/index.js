const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const googleClient = new OAuth2Client();

// Device and connection registry
// Key: google_user_id -> Array of Host PCs
const registeredHosts = new Map(); // device_id -> { ws, info, google_user_id }
const activeClients = new Map();    // client_id -> { ws, google_user_id, target_device_id }

// HTTP Google Auth Verification Endpoint
app.post('/api/auth/verify-google', async (req, res) => {
    const { id_token } = req.body;
    if (!id_token) {
        return res.status(400).json({ error: 'Missing id_token' });
    }

    try {
        // Verification with Google OAuth Client
        // For development/demo: if token is 'demo_token', return demo user
        if (id_token === 'demo_token' || id_token.startsWith('mock_')) {
            return res.json({
                success: true,
                user: {
                    id: 'google_user_12345',
                    email: 'demo.user@gmail.com',
                    name: 'Demo User'
                }
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
        });
        const payload = ticket.getPayload();
        return res.json({
            success: true,
            user: {
                id: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            }
        });
    } catch (err) {
        console.error("Google Auth verification failed:", err.message);
        return res.status(401).json({ error: 'Invalid Google ID Token' });
    }
});

// HTTP List Available PCs for User
app.get('/api/devices/:google_user_id', (req, res) => {
    const userId = req.params.google_user_id;
    const userDevices = [];

    registeredHosts.forEach((hostData, devId) => {
        if (hostData.google_user_id === userId) {
            userDevices.append ? userDevices.append(hostData.info) : userDevices.push({
                device_id: devId,
                device_name: hostData.info.device_name,
                os: hostData.info.os,
                resolution: hostData.info.resolution,
                windows: hostData.info.windows || [],
                supported_resolutions: hostData.info.supported_resolutions || [],
                status: 'online'
            });
        }
    });

    res.json({ success: true, devices: userDevices });
});

// WebSocket Connection Router
wss.on('connection', (ws) => {
    let clientRole = null;
    let clientId = null;
    let userId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const msgType = data.type;

            // 1. Host PC Registration
            if (msgType === 'register_host') {
                clientRole = 'host';
                clientId = data.device_id;
                userId = data.google_user_id;

                registeredHosts.set(clientId, {
                    ws: ws,
                    google_user_id: userId,
                    info: {
                        device_id: data.device_id,
                        device_name: data.device_name,
                        os: data.os,
                        resolution: data.resolution,
                        windows: data.windows,
                        supported_resolutions: data.supported_resolutions,
                        google_email: data.google_email
                    }
                });

                console.log(`[HOST ONLINE] ${data.device_name} (${data.device_id}) registered under User: ${userId}`);
                ws.send(jsonStr({ type: 'registered', status: 'ok' }));

                // Notify connected mobile clients of host list change
                notifyClientsDeviceList(userId);
            }

            // 2. Mobile App Client Connect
            else if (msgType === 'register_client') {
                clientRole = 'client';
                clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                userId = data.google_user_id;

                activeClients.set(clientId, {
                    ws: ws,
                    google_user_id: userId,
                    target_device_id: data.target_device_id
                });

                console.log(`[CLIENT CONNECTED] Client ${clientId} watching Device ${data.target_device_id}`);
                ws.send(jsonStr({ type: 'client_registered', client_id: clientId }));

                // Request initial windows list from host
                const host = registeredHosts.get(data.target_device_id);
                if (host && host.ws.readyState === WebSocket.OPEN) {
                    host.ws.send(jsonStr({ type: 'request_windows' }));
                }
            }

            // 3. Screen Frame Relay (Host -> Client)
            else if (msgType === 'screen_frame') {
                const devId = data.device_id;
                // Broadcast frame to watching clients
                activeClients.forEach((cData) => {
                    if (cData.target_device_id === devId && cData.ws.readyState === WebSocket.OPEN) {
                        cData.ws.send(message.toString());
                    }
                });
            }

            // 4. Input Commands Relay (Client -> Host)
            else if (msgType === 'input_event' || msgType === 'select_window' || msgType === 'change_resolution' || msgType === 'fit_resolution' || msgType === 'app_state') {
                const targetDevId = data.target_device_id;
                const host = registeredHosts.get(targetDevId);
                if (host && host.ws.readyState === WebSocket.OPEN) {
                    host.ws.send(message.toString());
                }
            }

            // 5. Windows List Update Relay (Host -> Client)
            else if (msgType === 'windows_list_update' || msgType === 'resolution_updated') {
                const hostData = registeredHosts.get(clientId);
                if (hostData) {
                    if (msgType === 'windows_list_update') hostData.info.windows = data.windows;
                    if (msgType === 'resolution_updated') hostData.info.resolution = data.resolution;
                }
                // Forward to clients
                activeClients.forEach((cData) => {
                    if (cData.target_device_id === clientId && cData.ws.readyState === WebSocket.OPEN) {
                        cData.ws.send(message.toString());
                    }
                });
            }

            // 6. Low-Data Heartbeat Ping
            else if (msgType === 'ping') {
                ws.send(jsonStr({ type: 'pong' }));
            }

        } catch (e) {
            console.error("WS message parse error:", e);
        }
    });

    ws.on('close', () => {
        if (clientRole === 'host' && clientId) {
            console.log(`[HOST OFFLINE] Device ${clientId}`);
            registeredHosts.delete(clientId);
            if (userId) notifyClientsDeviceList(userId);
        } else if (clientRole === 'client' && clientId) {
            console.log(`[CLIENT DISCONNECTED] ${clientId}`);
            activeClients.delete(clientId);
        }
    });
});

function notifyClientsDeviceList(userId) {
    const devices = [];
    registeredHosts.forEach((hData, dId) => {
        if (hData.google_user_id === userId) {
            devices.push({
                device_id: dId,
                device_name: hData.info.device_name,
                os: hData.info.os,
                resolution: hData.info.resolution,
                windows: hData.info.windows || [],
                supported_resolutions: hData.info.supported_resolutions || [],
                status: 'online'
            });
        }
    });

    activeClients.forEach((cData) => {
        if (cData.google_user_id === userId && cData.ws.readyState === WebSocket.OPEN) {
            cData.ws.send(jsonStr({
                type: 'device_list_update',
                devices: devices
            }));
        }
    });
}

function jsonStr(obj) {
    return JSON.stringify(obj);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` 🌐 Remote PC Signaling & Auth Server Running`);
    console.log(` Port: ${PORT}`);
    console.log(` WebSocket URL: ws://localhost:${PORT}`);
    console.log(`==================================================`);
});
