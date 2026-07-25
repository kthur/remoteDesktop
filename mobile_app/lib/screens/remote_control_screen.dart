import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/remote_service.dart';

class RemoteControlScreen extends StatefulWidget {
  final String targetDeviceId;
  final String deviceName;
  final List<String>? directWsUrls;
  final List<String>? knownLocalIps;

  const RemoteControlScreen({
    Key? key,
    required this.targetDeviceId,
    required this.deviceName,
    this.directWsUrls,
    this.knownLocalIps,
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

    _remoteService.connect(
      "ws://localhost:8080",
      userId,
      widget.targetDeviceId,
      candidateUrls: widget.directWsUrls,
      knownLocalIps: widget.knownLocalIps,
    );
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
      _remoteService.ensureConnected();
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
    final displayList = windows;

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
              if (displayList.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'No open windows reported by host.',
                      style: TextStyle(color: Colors.white60),
                    ),
                  ),
                )
              else
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
                            win["title"] ?? "Window",
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

  void _showDebugModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Consumer<RemoteService>(
          builder: (context, service, _) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.8,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.bug_report_rounded, color: Color(0xFF38BDF8)),
                          SizedBox(width: 8),
                          Text(
                            '🐛 Diagnostics & Connection HUD',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.white60),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: Column(
                      children: [
                        _debugRow("State", service.connectionState.name.toUpperCase(), color: service.isConnected ? Colors.greenAccent : Colors.amberAccent),
                        _debugRow("Transport", service.activeTransportBadge),
                        _debugRow("Active URL", service.activeUrl ?? "None (Probing)"),
                        _debugRow("FPS / Performance", "${service.currentFps.toStringAsFixed(1)} FPS | Total Frames: ${service.framesReceivedCount}"),
                        _debugRow("Frame Size", "${(service.lastFrameSizeBytes / 1024).toStringAsFixed(1)} KB"),
                        if (service.lastErrorMsg != null)
                          _debugRow("Last Error", service.lastErrorMsg!, color: Colors.redAccent),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('📜 Real-time Connection Logs', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                      Row(
                        children: [
                          TextButton.icon(
                            icon: const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF38BDF8)),
                            label: const Text('Re-probe', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                            onPressed: () {
                              service.ensureConnected();
                            },
                          ),
                          TextButton.icon(
                            icon: const Icon(Icons.delete_sweep_rounded, size: 16, color: Colors.white60),
                            label: const Text('Clear', style: TextStyle(color: Colors.white60, fontSize: 12)),
                            onPressed: () {
                              service.clearDiagnosticLogs();
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: service.diagnosticLogs.isEmpty
                          ? const Center(child: Text('No diagnostic logs recorded yet.', style: TextStyle(color: Colors.white38)))
                          : ListView.builder(
                              itemCount: service.diagnosticLogs.length,
                              itemBuilder: (context, index) {
                                final log = service.diagnosticLogs[service.diagnosticLogs.length - 1 - index];
                                final isError = log.contains("ERROR") || log.contains("FAILED") || log.contains("Exception");
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 2),
                                  child: Text(
                                    log,
                                    style: TextStyle(
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      color: isError ? Colors.redAccent : (log.contains("CONNECTED") ? Colors.greenAccent : Colors.white70),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _debugRow(String label, String value, {Color color = Colors.white}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
          Flexible(
            child: Text(
              value,
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _remoteService,
      child: Consumer<RemoteService>(
        builder: (context, service, _) {
<<<<<<< HEAD
=======
          final bodyContent = Stack(
            children: [
              // Remote Video Stream Container (Isolated with RepaintBoundary & ValueListenableBuilder)
              Positioned.fill(
                child: ValueListenableBuilder<Uint8List?>(
                  valueListenable: service.frameNotifier,
                  builder: (context, frameBytes, _) {
                    if (frameBytes == null) {
                      return _buildPlaceholderView(service);
                    }
                    return RepaintBoundary(
                      child: GestureDetector(
                        key: _canvasKey,
                        onDoubleTap: () {
                          // Double tap toggles control bar overlay cleanly without conflicting with single tap click
                          setState(() {
                            _showOverlay = !_showOverlay;
                          });
                        },
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
                        child: Container(
                          color: Colors.black,
                          child: Center(
                            child: Image.memory(
                              frameBytes,
                              gaplessPlayback: true,
                              fit: _fitMode,
                              width: double.infinity,
                              height: double.infinity,
                              errorBuilder: (context, error, stackTrace) {
                                debugPrint("Image decode error: $error");
                                return _buildPlaceholderView(service);
                              },
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Reconnection Banner Overlay
              if (service.connectionState == RemoteConnectionState.reconnecting ||
                  service.connectionState == RemoteConnectionState.connecting)
                Positioned(
                  top: _isFullscreen ? 20 : 10,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.92),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withOpacity(0.6)),
                      boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 8)],
                    ),
                    child: Row(
                      children: [
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.amberAccent),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            service.connectionState == RemoteConnectionState.connecting
                                ? 'Connecting to Host (${service.activeTransportBadge})...'
                                : 'Reconnecting (Attempt ${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts}) via ${service.activeTransportBadge}...',
                            style: const TextStyle(color: Colors.amberAccent, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              if (service.isBackground)
                Positioned(
                  top: _isFullscreen ? 30 : 20,
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

              // Floating Controls Bar Overlay
              if (_showOverlay)
                Positioned(
                  bottom: 20,
                  left: 20,
                  right: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withOpacity(0.9),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withOpacity(0.15)),
                      boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        IconButton(
                          tooltip: 'Mouse Instructions',
                          icon: const Icon(Icons.mouse_rounded, color: Color(0xFF38BDF8)),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Tap: Left Click | Double-Tap: Menu Toggle | Long Press: Right Click | Drag: Move'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                        ),
                        IconButton(
                          tooltip: 'Keyboard Input',
                          icon: const Icon(Icons.keyboard_rounded, color: Colors.white70),
                          onPressed: () {
                            _remoteService.sendInputEvent({"type": "text", "text": " "});
                          },
                        ),
                        IconButton(
                          tooltip: 'Fit Mode (${_getFitModeLabel(_fitMode)})',
                          icon: Icon(_getFitModeIcon(_fitMode), color: const Color(0xFF38BDF8)),
                          onPressed: _cycleFitMode,
                        ),
                        IconButton(
                          tooltip: 'Toggle Fullscreen',
                          icon: Icon(
                            _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                            color: Colors.amberAccent,
                          ),
                          onPressed: _toggleFullscreen,
                        ),
                        IconButton(
                          tooltip: 'Rotate Screen',
                          icon: Icon(
                            Icons.screen_rotation_rounded,
                            color: _isLandscape ? const Color(0xFF38BDF8) : Colors.white70,
                          ),
                          onPressed: _toggleOrientation,
                        ),
                        IconButton(
                          tooltip: 'Windows Manager',
                          icon: const Icon(Icons.window_rounded, color: Colors.white70),
                          onPressed: _showWindowSelectorMenu,
                        ),
                        IconButton(
                          tooltip: 'Display Resolution',
                          icon: const Icon(Icons.aspect_ratio_rounded, color: Colors.white70),
                          onPressed: _showResolutionModal,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );

          return Scaffold(
            backgroundColor: Colors.black,
            appBar: _isFullscreen
                ? null
                : AppBar(
                    backgroundColor: const Color(0xFF1E293B),
                    elevation: 0,
                    title: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              widget.deviceName,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                service.activeTransportBadge,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          service.isBackground
                              ? '⏸️ Background Mode (Data Saver)'
                              : (service.isConnected
                                  ? '🟢 Connected (${service.activeUrl ?? "Live"})'
                                  : (service.connectionState == RemoteConnectionState.reconnecting
                                      ? '🟠 Reconnecting (${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})...'
                                      : '🔴 ${service.connectionState.name.toUpperCase()}')),
                          style: TextStyle(
                            fontSize: 11,
                            color: service.isBackground
                                ? Colors.orangeAccent
                                : (service.isConnected ? Colors.greenAccent : Colors.amberAccent),
                          ),
                        ),
                      ],
                    ),
                    actions: [
                      IconButton(
                        tooltip: 'Toggle Fullscreen',
                        icon: const Icon(Icons.fullscreen_rounded, color: Colors.amberAccent),
                        onPressed: _toggleFullscreen,
                      ),
                      IconButton(
                        tooltip: 'Rotate Orientation',
                        icon: Icon(
                          Icons.screen_rotation_rounded,
                          color: _isLandscape ? const Color(0xFF38BDF8) : Colors.white,
                        ),
                        onPressed: _toggleOrientation,
                      ),
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
            body: _isFullscreen
                ? bodyContent
                : SafeArea(
                    child: bodyContent,
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
            Text(
              service.connectionState == RemoteConnectionState.reconnecting
                  ? 'Reconnecting to Host... (Attempt ${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})'
                  : 'Connecting Stream (${service.activeTransportBadge})...',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
