import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

  @override
  void initState() {
    super.initState();
    _refreshDeviceList();
  }

  Future<void> _refreshDeviceList() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    if (auth.currentUser == null) {
      if (mounted) {
        setState(() {
          _devices = [];
          _isLoading = false;
        });
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final userId = auth.currentUser!.id;

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

      _devices = combined;
    } catch (e) {
      debugPrint("Error refreshing devices: $e");
      _devices = [];
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildTransportBadges(Map<String, dynamic> dev) {
    final bool usb = dev["usb_available"] == true ||
        (dev["direct_ws_urls"] as List<dynamic>?)?.any((u) => u.toString().contains("127.0.0.1")) == true;
    final bool wifi = (dev["local_ips"] as List<dynamic>?)?.isNotEmpty == true;

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        if (usb) _badge('🔌 USB ADB', Colors.purpleAccent),
        if (wifi) _badge('📶 LAN Wi-Fi', Colors.cyanAccent),
        _badge('🌐 Cloud Relay', Colors.blueAccent),
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
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
            ),
          ],
        ),
        actions: [
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
