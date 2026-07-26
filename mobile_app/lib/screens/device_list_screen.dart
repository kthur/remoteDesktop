import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/network_discovery_service.dart';
import 'remote_control_screen.dart';
import 'login_screen.dart';

class DeviceListScreen extends StatefulWidget {
  const DeviceListScreen({Key? key}) : super(key: key);

  @override
  State<DeviceListScreen> createState() => _DeviceListScreenState();
}

class _DeviceListScreenState extends State<DeviceListScreen> {
  bool _isLoading = false;
  List<Map<String, dynamic>> _devices = [];
  List<String> _recentUrls = [];

  @override
  void initState() {
    super.initState();
    _loadCachedUrls();
    _refreshDeviceList();
  }

  Future<void> _loadCachedUrls() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _recentUrls = prefs.getStringList('recent_tunnel_urls') ?? [];
    });
  }

  Future<void> _saveConnectedUrl(String url) async {
    if (url.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final urls = prefs.getStringList('recent_tunnel_urls') ?? [];
    urls.remove(url);
    urls.insert(0, url);
    if (urls.length > 5) urls.removeLast();
    await prefs.setStringList('recent_tunnel_urls', urls);
    await prefs.setString('last_connected_tunnel_url', url);
    setState(() {
      _recentUrls = urls;
    });
  }

  Future<void> _refreshDeviceList() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final userId = auth.currentUser?.id ?? "google_user_12345";

    setState(() {
      _isLoading = true;
    });

    try {
      final serverHosts = await NetworkDiscoveryService.fetchServerRegisteredDevices(
        "http://localhost:8080",
        userId,
      );

      final udpHosts = await NetworkDiscoveryService.discoverViaUdpBroadcast();

      final List<Map<String, dynamic>> combined = [];

      for (var host in serverHosts) {
        combined.add({
          "device_id": host.deviceId,
          "device_name": host.deviceName,
          "os": host.os,
          "resolution": host.resolution,
          "status": host.status,
          "usb_available": host.usbAvailable,
          "local_ips": host.localIps,
          "direct_ws_urls": host.directWsUrls,
          "windows": host.windows,
        });
      }

      for (var host in udpHosts) {
        if (!combined.any((d) => d["device_id"] == host.deviceId)) {
          combined.add({
            "device_id": host.deviceId,
            "device_name": host.deviceName,
            "os": host.os,
            "resolution": host.resolution,
            "status": host.status,
            "usb_available": host.usbAvailable,
            "local_ips": host.localIps,
            "direct_ws_urls": host.directWsUrls,
            "windows": host.windows,
          });
        }
      }

      if (combined.isEmpty) {
        _devices = [
          {
            "device_id": "pc_win_desktop_01",
            "device_name": "🖥️ Local PC Host (Auto Detect)",
            "os": "Windows PC",
            "resolution": {"width": 1920, "height": 1080},
            "status": "online",
            "usb_available": true,
            "local_ips": ["127.0.0.1", "10.0.2.2"],
            "direct_ws_urls": ["ws://127.0.0.1:8080", "ws://10.0.2.2:8080"],
            "windows": []
          }
        ];
      } else {
        _devices = combined;
      }
    } catch (e) {
      debugPrint("Error refreshing devices: $e");
      _devices = [
        {
          "device_id": "pc_win_desktop_01",
          "device_name": "🖥️ Local PC Host (Auto Detect)",
          "os": "Windows PC",
          "resolution": {"width": 1920, "height": 1080},
          "status": "online",
          "usb_available": true,
          "local_ips": ["127.0.0.1", "10.0.2.2"],
          "direct_ws_urls": ["ws://127.0.0.1:8080", "ws://10.0.2.2:8080"],
          "windows": []
        }
      ];
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildTransportBadges(Map<String, dynamic> dev) {
    final urls = (dev["direct_ws_urls"] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
    final bool usb = dev["usb_available"] == true || urls.any((u) => u.contains("127.0.0.1"));
    final bool wifi = (dev["local_ips"] as List<dynamic>?)?.isNotEmpty == true;
    final bool tunnel = urls.any((u) => u.contains("trycloudflare.com") || u.contains("ngrok") || (u.startsWith("wss://") && !u.contains("localhost")));

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        if (usb) _badge('🔌 USB ADB', Colors.purpleAccent),
        if (wifi) _badge('📶 LAN Wi-Fi', Colors.cyanAccent),
        if (tunnel) _badge('🌐 LTE/5G Public Tunnel', Colors.greenAccent),
        _badge('☁️ Cloud Relay', Colors.blueAccent),
      ],
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        text,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  void _connectFromQrPayload(String rawPayload) {
    if (rawPayload.isEmpty) return;
    String targetUrl = "";
    String deviceId = "pc_b6fca047";
    String deviceName = "📱 Remote PC Host (QR Connect)";
    List<String> directUrls = [];

    try {
      final decoded = jsonDecode(rawPayload);
      if (decoded is Map<String, dynamic>) {
        if (decoded["url"] != null) targetUrl = decoded["url"].toString();
        if (decoded["device_id"] != null) deviceId = decoded["device_id"].toString();
        if (decoded["device_name"] != null) deviceName = decoded["device_name"].toString();
        if (decoded["direct_urls"] != null) {
          directUrls = List<String>.from(decoded["direct_urls"]);
        }
      }
    } catch (_) {
      targetUrl = rawPayload.trim();
    }

    if (targetUrl.isNotEmpty && (targetUrl.startsWith("ws://") || targetUrl.startsWith("wss://"))) {
      _saveConnectedUrl(targetUrl);
      if (!directUrls.contains(targetUrl)) {
        directUrls.insert(0, targetUrl);
      }
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RemoteControlScreen(
            targetDeviceId: deviceId,
            deviceName: deviceName,
            directWsUrls: directUrls,
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Invalid QR Code Payload or URL format!'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showQrScannerDialog() {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.qr_code_scanner_rounded, color: Color(0xFF38BDF8), size: 28),
            SizedBox(width: 10),
            Text('📷 Scan Host PC QR Code', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 170,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.4), width: 2),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF38BDF8).withOpacity(0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.qr_code_2_rounded, size: 50, color: Color(0xFF38BDF8)),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Point Mobile Camera at Host PC QR Code',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Paste or enter scanned QR Code string / URL below:',
                style: TextStyle(color: Colors.white60, fontSize: 12),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Paste QR JSON or wss:// URL...',
                        hintStyle: const TextStyle(color: Colors.white30),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.paste_rounded, color: Color(0xFF38BDF8)),
                    tooltip: 'Paste from Clipboard',
                    onPressed: () async {
                      final data = await Clipboard.getData(Clipboard.kTextPlain);
                      if (data?.text != null && data!.text!.isNotEmpty) {
                        controller.text = data.text!.trim();
                      }
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.flash_on_rounded, color: Colors.amberAccent, size: 18),
            label: const Text('Connect QR', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            onPressed: () {
              final payload = controller.text.trim();
              Navigator.of(ctx).pop();
              _connectFromQrPayload(payload);
            },
          ),
        ],
      ),
    );
  }

  Future<void> _showCustomTunnelDialog() async {
    final prefs = await SharedPreferences.getInstance();
    final lastUrl = prefs.getString('last_connected_tunnel_url') ?? "wss://";
    final controller = TextEditingController(text: lastUrl);

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.public_rounded, color: Color(0xFF38BDF8)),
              SizedBox(width: 8),
              Text('🌐 Connect via LTE/5G Tunnel', style: TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Enter Cloudflare / ngrok Public Tunnel WSS URL or scan PC QR Code:',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: controller,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'wss://xxx.trycloudflare.com',
                          hintStyle: const TextStyle(color: Colors.white30),
                          filled: true,
                          fillColor: const Color(0xFF0F172A),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.paste_rounded, color: Color(0xFF38BDF8)),
                      tooltip: 'Paste from Clipboard',
                      onPressed: () async {
                        final data = await Clipboard.getData(Clipboard.kTextPlain);
                        if (data?.text != null && data!.text!.isNotEmpty) {
                          setDialogState(() {
                            controller.text = data.text!.trim();
                          });
                        }
                      },
                    ),
                  ],
                ),
                if (_recentUrls.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text(
                    '🕒 Cached Recent Connection History:',
                    style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _recentUrls.map((url) {
                      return InkWell(
                        onTap: () {
                          setDialogState(() {
                            controller.text = url;
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.3)),
                          ),
                          child: Text(
                            url.length > 28 ? '${url.substring(0, 25)}...' : url,
                            style: const TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0EA5E9)),
              onPressed: () {
                final url = controller.text.trim();
                Navigator.of(ctx).pop();
                if (url.isNotEmpty && (url.startsWith('wss://') || url.startsWith('ws://'))) {
                  _saveConnectedUrl(url);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => RemoteControlScreen(
                        targetDeviceId: "pc_b6fca047",
                        deviceName: "🌐 Remote PC (LTE/5G Public Tunnel)",
                        directWsUrls: [url, 'ws://127.0.0.1:8080'],
                      ),
                    ),
                  );
                }
              },
              child: const Text('Connect Now', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final user = auth.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.devices_rounded, color: Color(0xFF38BDF8)),
            SizedBox(width: 10),
            Text(
              'Available PCs',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.amberAccent),
            tooltip: 'Scan Host PC QR Code',
            onPressed: _showQrScannerDialog,
          ),
          IconButton(
            icon: const Icon(Icons.public_rounded, color: Color(0xFF38BDF8)),
            tooltip: 'Connect via LTE/5G Public Tunnel',
            onPressed: _showCustomTunnelDialog,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white70),
            onPressed: () async {
              await auth.signOut();
              if (mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          )
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (user != null)
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: const Color(0xFF0284C7),
                      child: Text(
                        user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : 'G',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.displayName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            user.email,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.6),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.green.withOpacity(0.5)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.g_mobiledata_rounded, color: Colors.green, size: 20),
                          SizedBox(width: 2),
                          Text(
                            'Synced',
                            style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'HOST COMPUTERS (${_devices.length})',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.5),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _isLoading ? null : _refreshDeviceList,
                    icon: _isLoading
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                          )
                        : const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF38BDF8)),
                    label: const Text('Refresh', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 13)),
                  ),
                ],
              ),
            ),

            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _devices.length,
                itemBuilder: (context, index) {
                  final dev = _devices[index];
                  final res = dev["resolution"] ?? {"width": 1920, "height": 1080};

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      leading: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.laptop_windows_rounded,
                          color: Color(0xFF38BDF8),
                          size: 30,
                        ),
                      ),
                      title: Text(
                        dev["device_name"] ?? "Remote Host PC",
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(
                            dev["os"] ?? "Windows",
                            style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          _buildTransportBadges(dev),
                          const SizedBox(height: 4),
                          Text(
                            'Res: ${res["width"]}x${res["height"]}',
                            style: TextStyle(color: const Color(0xFF38BDF8).withOpacity(0.8), fontSize: 12),
                          ),
                        ],
                      ),
                      trailing: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        ),
                        onPressed: () {
                          final directUrls = (dev["direct_ws_urls"] as List<dynamic>?)?.map((e) => e.toString()).toList();
                          final localIps = (dev["local_ips"] as List<dynamic>?)?.map((e) => e.toString()).toList();

                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => RemoteControlScreen(
                                targetDeviceId: dev["device_id"],
                                deviceName: dev["device_name"],
                                directWsUrls: directUrls,
                                knownLocalIps: localIps,
                              ),
                            ),
                          );
                        },
                        child: const Text('Connect', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
