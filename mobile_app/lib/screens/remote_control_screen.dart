import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/remote_service.dart';

class RemoteControlScreen extends StatefulWidget {
  final String targetDeviceId;
  final String deviceName;

  const RemoteControlScreen({
    Key? key,
    required this.targetDeviceId,
    required this.deviceName,
  }) : super(key: key);

  @override
  State<RemoteControlScreen> createState() => _RemoteControlScreenState();
}

class _RemoteControlScreenState extends State<RemoteControlScreen> with WidgetsBindingObserver {
  late RemoteService _remoteService;
  final GlobalKey _canvasKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _remoteService = RemoteService();

    final auth = Provider.of<AuthService>(context, listen: false);
    final userId = auth.currentUser?.id ?? "google_user_12345";
    _remoteService.connect("ws://localhost:8080", userId, widget.targetDeviceId);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _remoteService.disconnect();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _remoteService.updateAppState(true);
    } else if (state == AppLifecycleState.resumed) {
      _remoteService.updateAppState(false);
    }
  }

  void _sendNormalizedInput(String type, Offset localPosition, Size canvasSize, {Map<String, dynamic>? extra}) {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    final normX = (localPosition.dx / canvasSize.width).clamp(0.0, 1.0);
    final normY = (localPosition.dy / canvasSize.height).clamp(0.0, 1.0);

    final payload = {
      "type": type,
      "x": normX,
      "y": normY,
      ...?extra
    };
    _remoteService.sendInputEvent(payload);
  }

  void _showWindowSelectorMenu() {
    final windows = _remoteService.openWindows;
    final displayList = windows.isNotEmpty ? windows : [
      {"handle": 0, "title": "🖥️ Full Desktop"},
      {"handle": 1024, "title": "🌐 Google Chrome"},
      {"handle": 2048, "title": "📝 Visual Studio Code"}
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '🪟 Windows Manager (Select Screen / Window)',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white60),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: displayList.length,
                  itemBuilder: (context, index) {
                    final win = displayList[index];
                    final handle = win["handle"] as int;
                    final isSelected = handle == _remoteService.selectedWindowHandle;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF0284C7).withOpacity(0.25) : Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF38BDF8) : Colors.white.withOpacity(0.08),
                        ),
                      ),
                      child: ListTile(
                        leading: Icon(
                          win["is_desktop"] == true ? Icons.desktop_windows_rounded : Icons.window_rounded,
                          color: isSelected ? const Color(0xFF38BDF8) : Colors.white70,
                        ),
                        title: Text(
                          win["title"],
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        trailing: isSelected ? const Icon(Icons.check_circle_rounded, color: Color(0xFF38BDF8)) : null,
                        onTap: () {
                          _remoteService.selectWindow(handle);
                          Navigator.pop(context);
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showResolutionModal() {
    final screenSize = MediaQuery.of(context).size;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '⚙️ Display Resolution Control (Windows)',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                'Adjust Windows PC resolution to match your mobile screen.',
                style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
              ),
              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.aspect_ratio_rounded, color: Colors.white),
                  label: Text(
                    '📱 Fit to Mobile Resolution (${screenSize.width.toInt()} x ${screenSize.height.toInt()})',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    _remoteService.fitMobileResolution(screenSize.width, screenSize.height);
                    Navigator.pop(context);
                  },
                ),
              ),
              const SizedBox(height: 16),
              const Text('Standard Resolutions:', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),

              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _resChip(1920, 1080, '1920x1080 (FHD)'),
                  _resChip(1600, 900, '1600x900'),
                  _resChip(1366, 768, '1366x768'),
                  _resChip(1280, 720, '1280x720 (HD)'),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _resChip(int w, int h, String label) {
    return ActionChip(
      backgroundColor: Colors.white.withOpacity(0.08),
      label: Text(label, style: const TextStyle(color: Colors.white)),
      onPressed: () {
        _remoteService.changeResolution(w, h);
        Navigator.pop(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _remoteService,
      child: Consumer<RemoteService>(
        builder: (context, service, _) {
          return Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: const Color(0xFF1E293B),
              elevation: 0,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.deviceName,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    service.isBackground
                        ? '⏸️ Background Mode (Data Saver)'
                        : (service.isConnected ? '🟢 Live Connected' : '🔴 Connecting...'),
                    style: TextStyle(
                      fontSize: 11,
                      color: service.isBackground ? Colors.orangeAccent : Colors.greenAccent,
                    ),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  tooltip: 'Windows Manager Menu',
                  icon: const Icon(Icons.window_rounded, color: Color(0xFF38BDF8)),
                  onPressed: _showWindowSelectorMenu,
                ),
                IconButton(
                  tooltip: 'Display Resolution',
                  icon: const Icon(Icons.settings_display_rounded, color: Colors.white),
                  onPressed: _showResolutionModal,
                ),
              ],
            ),
            body: SafeArea(
              child: Stack(
                children: [
                  Center(
                    child: service.latestFrameBytes != null
                        ? GestureDetector(
                            key: _canvasKey,
                            onTapUp: (details) {
                              final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                              if (renderBox != null) {
                                _sendNormalizedInput("click", details.localPosition, renderBox.size);
                              }
                            },
                            onLongPressStart: (details) {
                              final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                              if (renderBox != null) {
                                _sendNormalizedInput("rclick", details.localPosition, renderBox.size);
                              }
                            },
                            onPanUpdate: (details) {
                              final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                              if (renderBox != null) {
                                _sendNormalizedInput("move", details.localPosition, renderBox.size);
                              }
                            },
                            child: Image.memory(
                              service.latestFrameBytes!,
                              gaplessPlayback: true,
                              fit: BoxFit.contain,
                            ),
                          )
                        : _buildPlaceholderView(service),
                  ),

                  if (service.isBackground)
                    Positioned(
                      top: 20,
                      left: 20,
                      right: 20,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.9),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.nature_people_rounded, color: Colors.white),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Background Low-Data Mode Active\nVideo stream paused to save network usage.',
                                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  Positioned(
                    bottom: 20,
                    left: 20,
                    right: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B).withOpacity(0.9),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.15)),
                      ),
                      child: Row(
                        mainAxisAlignment: Main.spaceAround,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.mouse_rounded, color: Color(0xFF38BDF8)),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Tap: Left Click | Long Press: Right Click | Drag: Move')),
                              );
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.keyboard_rounded, color: Colors.white70),
                            onPressed: () {
                              _remoteService.sendInputEvent({"type": "text", "text": " "});
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.crop_free_rounded, color: Colors.white70),
                            onPressed: _showWindowSelectorMenu,
                          ),
                          IconButton(
                            icon: const Icon(Icons.aspect_ratio_rounded, color: Colors.white70),
                            onPressed: _showResolutionModal,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPlaceholderView(RemoteService service) {
    return Container(
      color: const Color(0xFF0F172A),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFF38BDF8)),
            const SizedBox(height: 20),
            const Text(
              'Connecting Stream & Fetching Host Screen...',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
