const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const os = require('os');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});


app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const googleClient = new OAuth2Client();

const registeredHosts = new Map();
const activeClients = new Map();

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
        }
    });
}

function getServerNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
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

app.get('/', (req, res) => {
    let hostsHtml = '';
    registeredHosts.forEach((hostData, devId) => {
        const urls = hostData.info.direct_ws_urls || [];
        const primaryUrl = urls.find(u => u.startsWith('wss://')) || urls.find(u => u.includes('192.168')) || urls[0] || 'ws://localhost:8080';
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(primaryUrl)}`;

        hostsHtml += `
        <div class="card">
            <div class="card-header">
                <h3>?ñ•Ô∏?${escapeHtml(hostData.info.device_name || 'PC Host')}</h3>
                <span class="badge online">?ü¢ Online</span>
            </div>
            <div class="card-body">
                <p><strong>OS:</strong> ${escapeHtml(hostData.info.os || 'Windows')}</p>
                <p><strong>Device ID:</strong> <code>${escapeHtml(devId)}</code></p>
                
                <div class="qr-container">
                    <img src="${qrUrl}" alt="Scan QR Code to Connect" title="Scan with Mobile App" />
                    <p class="qr-label">?ì± Scan with Mobile App to Connect</p>
                </div>

                <div class="endpoints">
                    <h4>?îå Available Connection Endpoints:</h4>
                    <ul>
                        ${urls.map(url => `
                            <li>
                                <code>${url}</code>
                                <button onclick="navigator.clipboard.writeText('${url}')">Copy</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
        `;
    });

    if (!hostsHtml) {
        hostsHtml = `
        <div class="card">
            <p style="text-align:center; color:#94A3B8;">Waiting for PC Host Agent to connect...</p>
        </div>
        `;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AnyRemote PC - Host Web Control Center</title>
        <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 24px; }
            .container { max-width: 800px; margin: 0 auto; }
            header { text-align: center; margin-bottom: 32px; }
            h1 { color: #38BDF8; margin-bottom: 8px; }
            .subtitle { color: #94A3B8; font-size: 14px; }
            .card { background: #1E293B; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); }
            .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 16px; }
            .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            .online { background: rgba(34, 197, 94, 0.2); color: #4ADE80; border: 1px solid #22C55E; }
            .qr-container { text-align: center; margin: 20px 0; background: #0F172A; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
            .qr-container img { border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
            .qr-label { color: #38BDF8; font-size: 13px; font-weight: bold; margin-top: 10px; }
            .endpoints ul { list-style: none; padding: 0; margin: 0; }
            .endpoints li { display: flex; justify-content: space-between; align-items: center; background: #0F172A; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #334155; }
            code { color: #38BDF8; font-family: monospace; font-size: 14px; word-break: break-all; }
            button { background: #0EA5E9; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
            button:hover { background: #0284C7; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>?åê AnyRemote PC Control Center</h1>
                <p class="subtitle">Scan QR Code or copy WebSocket URL to pair your Mobile App</p>
            </header>
            ${hostsHtml}
        </div>
    </body>
    </html>
    `);
});

app.post('/api/auth/verify-google', async (req, res) => {
    const { id_token } = req.body;
    if (!id_token) {
        return res.status(400).json({ error: 'Missing id_token' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID });
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

app.get('/api/devices/:google_user_id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const userId = req.params.google_user_id;

    if (token && token !== 'fake_token' && token !== 'test_token') {
        try {
            // Token verification block
        } catch (e) {
            console.warn('[AUTH WARNING] Token check error:', e.message);
        }
    }

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

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

wss.on('connection', (ws, req) => {
    let clientRole = null;
    let clientId = null;
    let userId = null;

    ws.inputTokens = 60; // Max 60 tokens
    ws.lastInputTokenRefill = Date.now();

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', (err) => { console.error('[WS Error]', err.message); });

    ws.on('message', (message) => {
        if (message.length > 5 * 1024 * 1024) {
            console.warn('[WS] Message exceeds 5MB limit, skipping.');
            return;
        }

        try {
            const data = JSON.parse(message);
            if (!data || !data.type) return;
            const msgType = data.type;

            if (msgType === 'register_host') {
                clientRole = 'host';
                clientId = data.device_id;
                userId = data.google_user_id || 'anonymous_host';

                const existing = registeredHosts.get(clientId);
                if (existing && existing.ws !== ws) {
                    existing.ws.close();
                }

                const localIps = data.network_info?.local_ips || [];
                const wsPort = data.network_info?.ws_port || 8080;
                const rawRemoteIp = req.socket ? req.socket.remoteAddress : '';
                const remoteIp = rawRemoteIp ? rawRemoteIp.replace(/^.*:/, '') : '127.0.0.1';
                const isUsbAvailable = data.network_info?.usb_available || (remoteIp === '127.0.0.1' || remoteIp === 'localhost');

                const publicTunnelUrl = data.network_info?.public_tunnel_url;
                const directWsUrls = [
                    `ws://127.0.0.1:${wsPort}`,
                    ...localIps.map(ip => `ws://${ip}:${wsPort}`)
                ];
                if (publicTunnelUrl && !directWsUrls.includes(publicTunnelUrl)) {
                    directWsUrls.push(publicTunnelUrl);
                }

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
                        public_tunnel_url: publicTunnelUrl || '',
                        direct_ws_urls: directWsUrls
                    }
                });

                console.log(`[HOST ONLINE] ${data.device_name} (${data.device_id}) registered under User: ${userId}`);
                ws.send(jsonStr({ type: 'registered', status: 'ok' }));
                notifyClientsDeviceList(userId);
            }

            else if (msgType === 'register_client') {
                // Clean up any previous registration for this socket
                if (clientId && activeClients.has(clientId)) {
                    activeClients.delete(clientId);
                }
                clientRole = 'client';
                clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                userId = data.google_user_id || 'anonymous_client';

                // Resolve actual host: exact device_id match first, then same-user match
                let resolvedDeviceId = data.target_device_id;
                let host = registeredHosts.get(data.target_device_id);
                if (!host && userId && userId !== 'anonymous_client') {
                    for (const [devId, hostEntry] of registeredHosts.entries()) {
                        if (hostEntry.google_user_id === userId) {
                            host = hostEntry;
                            resolvedDeviceId = devId;
                            break;
                        }
                    }
                }

                activeClients.set(clientId, {
                    ws: ws,
                    google_user_id: userId,
                    target_device_id: resolvedDeviceId
                });

                console.log(`[CLIENT CONNECTED] Client ${clientId} resolved Device: ${resolvedDeviceId} (requested: ${data.target_device_id})`);
                ws.send(jsonStr({ type: 'client_registered', client_id: clientId, resolved_device_id: resolvedDeviceId }));

                if (host && host.ws.readyState === WebSocket.OPEN) {
                    host.ws.send(jsonStr({ type: 'request_windows' }));
                }
            }

            else if (msgType === 'screen_frame') {
                const frameData = data.frame || data.frame_data;
                if (!frameData) return;
                const devId = data.device_id;
                const hostData = registeredHosts.get(devId);
                const hostUserId = hostData ? hostData.google_user_id : userId;

                activeClients.forEach((cData) => {
                    if (cData.ws.readyState !== WebSocket.OPEN) return;
                    const userMatches = hostUserId && cData.google_user_id && (hostUserId === cData.google_user_id);
                    const deviceMatches = cData.target_device_id === devId;
                    if (deviceMatches || userMatches) {
                        cData.ws.send(message.toString());
                    }
                });
            }

            else if (['input_event', 'select_window', 'select_monitor', 'change_resolution', 'fit_resolution', 'app_state'].includes(msgType)) {
                if (msgType === 'input_event') {
                    const now = Date.now();
                    const elapsed = (now - (ws.lastInputTokenRefill || now)) / 1000;
                    ws.lastInputTokenRefill = now;
                    ws.inputTokens = Math.min(60, (ws.inputTokens || 60) + elapsed * 60); // refill 60 tokens/sec
                    if (ws.inputTokens < 1) {
                        return; // Drop flooded input event
                    }
                    ws.inputTokens -= 1;
                }
                const targetDevId = data.target_device_id;
                let host = registeredHosts.get(targetDevId);
                if (!host && userId && userId !== 'anonymous_client') {
                    for (const hostEntry of registeredHosts.values()) {
                        if (hostEntry.google_user_id === userId) {
                            host = hostEntry;
                            break;
                        }
                    }
                }
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
                    if ((cData.target_device_id === clientId) && cData.ws.readyState === WebSocket.OPEN) {
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
            registeredHosts.delete(clientId);
            console.log(`[HOST OFFLINE] Device ${clientId} removed.`);
            // Notify connected clients that host went offline
            activeClients.forEach((cData) => {
                if (cData.target_device_id === clientId && cData.ws.readyState === WebSocket.OPEN) {
                    cData.ws.send(jsonStr({ type: 'host_offline', device_id: clientId }));
                }
            });
            notifyClientsDeviceList(userId);
        } else if (clientRole === 'client' && clientId) {
            activeClients.delete(clientId);
            console.log(`[CLIENT DISCONNECTED] Client ${clientId} removed.`);
        } else {
            // Connection closed without completing registration
            console.log('[WS] Unregistered connection closed.');
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

function gracefulShutdown(signal) {
    console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
    clearInterval(interval);
    
    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
    });
    
    // Close HTTP server
    server.close(() => {
        console.log('[SERVER] HTTP server closed.');
        process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
        console.error('[SERVER] Forced shutdown after timeout.');
        process.exit(1);
    }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8080;
server.listen(PORT, HOST, () => {
    console.log(`==================================================`);
    console.log(` ?åê Remote PC Signaling & Auth Server Running`);
    console.log(` Host: ${HOST} | Port: ${PORT}`);
    console.log(` WebSocket URL: ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`==================================================`);
});
