const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const os = require('os');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const googleClient = new OAuth2Client();

const registeredHosts = new Map();
const activeClients = new Map();

function getServerNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                results.push({
                    interface: name,
                    address: iface.address,
                    netmask: iface.netmask,
                    mac: iface.mac
                });
            }
        }
    }
    return results;
}

app.post('/api/auth/verify-google', async (req, res) => {
    const { id_token } = req.body;
    if (!id_token) {
        return res.status(400).json({ error: 'Missing id_token' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({ idToken: id_token });
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

app.get('/api/health', (req, res) => {
    res.json({
        status: "ok",
        service: "anyremote",
        server_interfaces: getServerNetworkInterfaces()
    });
});

app.get('/api/devices/:google_user_id', (req, res) => {
    const userId = req.params.google_user_id;
    const userDevices = [];

    registeredHosts.forEach((hostData, devId) => {
        if (hostData.google_user_id === userId) {
            userDevices.push({
                device_id: devId,
                device_name: hostData.info.device_name,
                os: hostData.info.os,
                resolution: hostData.info.resolution,
                windows: hostData.info.windows || [],
                supported_resolutions: hostData.info.supported_resolutions || [],
                status: 'online',
                local_ips: hostData.info.local_ips || [],
                remote_ip: hostData.info.remote_ip || '',
                usb_available: hostData.info.usb_available || false,
                direct_ws_urls: hostData.info.direct_ws_urls || []
            });
        }
    });

    res.json({ success: true, devices: userDevices });
});

wss.on('connection', (ws) => {
    let clientRole = null;
    let clientId = null;
    let userId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const msgType = data.type;

            if (msgType === 'register_host') {
                clientRole = 'host';
                clientId = data.device_id;
                userId = data.google_user_id;

                const localIps = data.network_info?.local_ips || [];
                const wsPort = data.network_info?.ws_port || 8080;
                const rawRemoteIp = ws._socket ? ws._socket.remoteAddress : '';
                const remoteIp = rawRemoteIp ? rawRemoteIp.replace(/^.*:/, '') : '127.0.0.1';
                const isUsbAvailable = data.network_info?.usb_available || (remoteIp === '127.0.0.1' || remoteIp === 'localhost');

                const directWsUrls = [
                    `ws://127.0.0.1:${wsPort}`,
                    ...localIps.map(ip => `ws://${ip}:${wsPort}`)
                ];

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
                        google_email: data.google_email,
                        local_ips: localIps,
                        remote_ip: remoteIp,
                        usb_available: isUsbAvailable,
                        direct_ws_urls: directWsUrls
                    }
                });

                console.log(`[HOST ONLINE] ${data.device_name} (${data.device_id}) registered under User: ${userId}`);
                ws.send(jsonStr({ type: 'registered', status: 'ok' }));
                notifyClientsDeviceList(userId);
            }

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

                const host = registeredHosts.get(data.target_device_id);
                if (host && host.ws.readyState === WebSocket.OPEN) {
                    host.ws.send(jsonStr({ type: 'request_windows' }));
                }
            }

            else if (msgType === 'screen_frame') {
                const devId = data.device_id;
                activeClients.forEach((cData) => {
                    if (cData.target_device_id === devId && cData.ws.readyState === WebSocket.OPEN) {
                        cData.ws.send(message.toString());
                    }
                });
            }

            else if (['input_event', 'select_window', 'change_resolution', 'fit_resolution', 'app_state'].includes(msgType)) {
                const targetDevId = data.target_device_id;
                const host = registeredHosts.get(targetDevId);
                if (host && host.ws.readyState === WebSocket.OPEN) {
                    host.ws.send(message.toString());
                }
            }

            else if (['windows_list_update', 'resolution_updated'].includes(msgType)) {
                const hostData = registeredHosts.get(clientId);
                if (hostData) {
                    if (msgType === 'windows_list_update') hostData.info.windows = data.windows;
                    if (msgType === 'resolution_updated') hostData.info.resolution = data.resolution;
                }
                activeClients.forEach((cData) => {
                    if (cData.target_device_id === clientId && cData.ws.readyState === WebSocket.OPEN) {
                        cData.ws.send(message.toString());
                    }
                });
            }

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
                status: 'online',
                local_ips: hData.info.local_ips || [],
                remote_ip: hData.info.remote_ip || '',
                usb_available: hData.info.usb_available || false,
                direct_ws_urls: hData.info.direct_ws_urls || []
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

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8080;
server.listen(PORT, HOST, () => {
    console.log(`==================================================`);
    console.log(` 🌐 Remote PC Signaling & Auth Server Running`);
    console.log(` Host: ${HOST} | Port: ${PORT}`);
    console.log(` WebSocket URL: ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`==================================================`);
});
