import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import 'remote_control_screen.dart';
import 'login_screen.dart';

class DeviceListScreen extends StatefulWidget {
  const DeviceListScreen({Key? key}) : super(key: key);

  @override
  State<DeviceListScreen> createState() => _DeviceListScreenState();
}

class _DeviceListScreenState extends State<DeviceListScreen> {
  List<Map<String, dynamic>> _devices = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchOnlineDevices();
  }

  Future<void> _fetchOnlineDevices() async {
    setState(() { _isLoading = true; });
    final auth = Provider.of<AuthService>(context, listen: false);
    final userId = auth.currentUser?.id ?? "google_user_12345";

    try {
      final url = Uri.parse("http://localhost:8080/api/devices/$userId");
      final response = await http.get(url).timeout(const Duration(seconds: 3));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data["success"] == true && data["devices"] != null && (data["devices"] as List).isNotEmpty) {
          setState(() {
            _devices = List<Map<String, dynamic>>.from(data["devices"]);
            _isLoading = false;
          });
          return;
        }
      }
    } catch (e) {
      debugPrint("HTTP fetch error: $e");
    }

    setState(() {
      _devices = [
        {
          "device_id": "pc_win_desktop_01",
          "device_name": "My Windows Workstation",
          "os": "Windows 11 (DESKTOP-WIN11)",
          "resolution": {"width": 1920, "height": 1080},
          "status": "online",
          "windows": [
            {"handle": 0, "title": "🖥️ Full Desktop (1920x1080)"}
          ]
        }
      ];
      _isLoading = false;
    });
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
                    onPressed: _fetchOnlineDevices,
                    icon: const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF38BDF8)),
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
                        dev["device_name"],
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
                            dev["os"],
                            style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
                          ),
                          const SizedBox(height: 2),
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
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => RemoteControlScreen(
                                targetDeviceId: dev["device_id"],
                                deviceName: dev["device_name"],
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
