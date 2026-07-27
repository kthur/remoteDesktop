import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final TransformationController _transformationController = TransformationController();

  bool _isFullscreen = false;
  BoxFit _fitMode = BoxFit.contain;
  bool _isLandscape = false;
  bool _showOverlay = true;

  Offset? _touchPos;
  double _touchOpacity = 0.0;
  Timer? _touchFadeTimer;

  // ── Pinch-to-Zoom state ──────────────────────────────────────
  double _viewScale = 1.0;       // current zoom level (1.0 = no zoom)
  double _scaleAtStart = 1.0;    // scale when pinch started
  bool _isScaling = false;       // true while 2-finger pinch is active
  bool _showZoomBadge = false;   // show zoom % badge during pinch
  Timer? _zoomBadgeTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _remoteService = RemoteService();

    final auth = Provider.of<AuthService>(context, listen: false);
    auth.getValidIdToken().then((token) {
      if (!mounted) return;
      final userId = auth.currentUser?.id ?? "google_user_12345";
      final String serverUrl = (widget.directWsUrls != null && widget.directWsUrls!.isNotEmpty)
          ? widget.directWsUrls!.first
          : const String.fromEnvironment('SIGNALING_SERVER', defaultValue: 'ws://192.168.1.100:8080');

      _remoteService.connect(
        serverUrl,
        userId,
        widget.targetDeviceId,
        token,
        candidateUrls: widget.directWsUrls,
        knownLocalIps: widget.knownLocalIps,
      );
    });
  }

  @override
  void dispose() {
    _touchFadeTimer?.cancel();
    _zoomBadgeTimer?.cancel();
    _transformationController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _remoteService.disconnect();
    super.dispose();
  }

  void _resetZoom() {
    setState(() {
      _viewScale = 1.0;
    });
    _transformationController.value = Matrix4.identity();
  }

  void _showZoomIndicator() {
    _zoomBadgeTimer?.cancel();
    setState(() => _showZoomBadge = true);
    _zoomBadgeTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _showZoomBadge = false);
    });
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

  void _triggerTouchVisual(Offset localPosition, {bool isRightClick = false}) {
    if (isRightClick) {
      HapticFeedback.mediumImpact();
    } else {
      HapticFeedback.lightImpact();
    }
    setState(() {
      _touchPos = localPosition;
      _touchOpacity = 1.0;
    });
    _touchFadeTimer?.cancel();
    _touchFadeTimer = Timer(const Duration(milliseconds: 350), () {
      if (mounted) {
        setState(() {
          _touchOpacity = 0.0;
        });
      }
    });
  }

  void _sendNormalizedInput(String type, Offset localPosition, Size canvasSize, {Map<String, dynamic>? extra}) {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    double normX = (localPosition.dx / canvasSize.width).clamp(0.0, 1.0);
    double normY = (localPosition.dy / canvasSize.height).clamp(0.0, 1.0);

    final payload = {
      "type": type,
      "x": normX,
      "y": normY,
      ...?extra
    };
    _remoteService.sendInputEvent(payload);
  }

  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  void _toggleOrientation() {
    setState(() {
      _isLandscape = !_isLandscape;
    });
    if (_isLandscape) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);
    }
  }

  void _cycleFitMode() {
    setState(() {
      if (_fitMode == BoxFit.contain) {
        _fitMode = BoxFit.fill;
      } else if (_fitMode == BoxFit.fill) {
        _fitMode = BoxFit.cover;
      } else {
        _fitMode = BoxFit.contain;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Display Fit: ${_getFitModeLabel(_fitMode)}'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _getFitModeLabel(BoxFit fit) {
    switch (fit) {
      case BoxFit.contain:
        return 'Fit Aspect (Contain)';
      case BoxFit.fill:
        return 'Stretch Full (Fill)';
      case BoxFit.cover:
        return 'Zoom Crop (Cover)';
      default:
        return 'Default';
    }
  }

  IconData _getFitModeIcon(BoxFit fit) {
    switch (fit) {
      case BoxFit.contain:
        return Icons.aspect_ratio_rounded;
      case BoxFit.fill:
        return Icons.fit_screen_rounded;
      case BoxFit.cover:
        return Icons.zoom_out_map_rounded;
      default:
        return Icons.aspect_ratio_rounded;
    }
  }

  void _showWindowSelectorMenu() {
    final windows = _remoteService.openWindows;

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
                    '?첒 Windows Manager (Select Window)',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white60),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (windows.isEmpty)
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
                    itemCount: windows.length,
                    itemBuilder: (context, index) {
                      final win = windows[index];
                      final handle = (win["handle"] as num?)?.toInt() ?? 0;
                      final isSelected = handle == _remoteService.selectedWindowHandle;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF0284C7).withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? const Color(0xFF38BDF8) : Colors.white.withValues(alpha: 0.08),
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
                '?숋툘 Display Resolution Control (Windows)',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                'Adjust Windows PC resolution to match your mobile screen.',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 13),
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
                    '?벑 Fit to Mobile Resolution (${screenSize.width.toInt()} x ${screenSize.height.toInt()})',
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
      backgroundColor: Colors.white.withValues(alpha: 0.08),
      label: Text(label, style: const TextStyle(color: Colors.white)),
      onPressed: () {
        _remoteService.changeResolution(w, h);
        Navigator.pop(context);
      },
    );
  }

  void _showVirtualKeyboardSheet() {
    final textController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            top: 20,
            left: 20,
            right: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.keyboard_rounded, color: Color(0xFF38BDF8)),
                      SizedBox(width: 8),
                      Text(
                        '?⑨툘 Virtual Keyboard & Windows Shortcuts',
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

              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: textController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      autofocus: true,
                      decoration: InputDecoration(
                        hintText: 'Type text to send to Host PC...',
                        hintStyle: const TextStyle(color: Colors.white30),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onSubmitted: (val) {
                        if (val.isNotEmpty) {
                          _remoteService.sendInputEvent({"type": "text", "text": val});
                          textController.clear();
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      final val = textController.text;
                      if (val.isNotEmpty) {
                        _remoteService.sendInputEvent({"type": "text", "text": val});
                        textController.clear();
                      }
                    },
                    child: const Icon(Icons.send_rounded, color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text('?? Quick Windows Key Shortcuts:', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),

              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _shortcutChip('?뮲 Win + D', 'win_d'),
                  _shortcutChip('?봽 Alt + Tab', 'alt_tab'),
                  _shortcutChip('?⑼툘 Enter', 'enter'),
                  _shortcutChip('??Backspace', 'backspace'),
                  _shortcutChip('??Tab', 'tab'),
                  _shortcutChip('??Esc', 'esc'),
                  _shortcutChip('?⑼툘 Ctrl + Z', 'ctrl_z'),
                  _shortcutChip('?뱥 Ctrl + C', 'ctrl_c'),
                  _shortcutChip('?뱦 Ctrl + V', 'ctrl_v'),
                  _shortcutChip('?첒 Windows Key', 'win'),
                  _shortcutChip('燧놅툘 Up', 'up'),
                  _shortcutChip('燧뉛툘 Down', 'down'),
                  _shortcutChip('燧낉툘 Left', 'left'),
                  _shortcutChip('?∽툘 Right', 'right'),
                ],
              ),
            ],
          ),
        );
      },
    ).then((_) => textController.dispose());
  }

  Widget _shortcutChip(String label, String action) {
    return ActionChip(
      backgroundColor: const Color(0xFF0F172A),
      side: BorderSide(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
      label: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
      onPressed: () {
        HapticFeedback.lightImpact();
        _remoteService.sendShortcut(action);
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
                            '?맀 Diagnostics & Connection HUD',
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
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
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
                      const Text('?뱶 Real-time Connection Logs', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
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
                        color: Colors.black.withValues(alpha: 0.5),
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
          final bodyContent = Stack(
            children: [
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
                        // ── Double Tap: toggle UI / reset zoom ─────────────
                        onDoubleTap: () {
                          if (_viewScale > 1.0) {
                            _resetZoom();       // double-tap while zoomed → reset
                          } else {
                            setState(() => _showOverlay = !_showOverlay);
                          }
                        },
                        // ── Single Tap → PC mouse click ────────────────────
                        onTapUp: (details) {
                          if (_isScaling) return;
                          final localPos = _transformationController.toScene(details.localPosition);
                          _triggerTouchVisual(localPos);
                          final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                          if (renderBox != null) {
                            _sendNormalizedInput("click", localPos, renderBox.size);
                          }
                        },
                        // ── Long Press → PC right-click ────────────────────
                        onLongPressStart: (details) {
                          final localPos = _transformationController.toScene(details.localPosition);
                          _triggerTouchVisual(localPos, isRightClick: true);
                          final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                          if (renderBox != null) {
                            _sendNormalizedInput("rclick", localPos, renderBox.size);
                          }
                        },
                        // ── Scale (replaces onPanUpdate) ───────────────────
                        // 1 finger → mouse move on PC
                        // 2 fingers → pinch-to-zoom (local viewport)
                        onScaleStart: (details) {
                          _scaleAtStart = _viewScale;
                          _isScaling = details.pointerCount > 1;
                        },
                        onScaleUpdate: (details) {
                          if (details.pointerCount > 1 || _isScaling) {
                            // ── Pinch to zoom ──────────────────────────────
                            _isScaling = true;
                            final newScale = (_scaleAtStart * details.scale).clamp(1.0, 4.0);
                            if ((newScale - _viewScale).abs() < 0.001) return;

                            // Apply zoom centered on the pinch focal point
                            final focal = details.localFocalPoint;
                            final oldM = _transformationController.value.clone();
                            final scaleChange = newScale / _viewScale;

                            final newM = Matrix4.identity()
                              ..translateByDouble(focal.dx, focal.dy, 0.0, 1.0)
                              ..scaleByDouble(scaleChange, scaleChange, 1.0, 1.0)
                              ..translateByDouble(-focal.dx, -focal.dy, 0.0, 1.0)
                              ..multiply(oldM);

                            _transformationController.value = newM;
                            setState(() => _viewScale = newScale);
                            _showZoomIndicator();
                          } else if (!_isScaling) {
                            // ── Single finger: move PC mouse ───────────────
                            final localPos = _transformationController.toScene(details.localFocalPoint);
                            _triggerTouchVisual(localPos);
                            final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                            if (renderBox != null) {
                              _sendNormalizedInput("move", localPos, renderBox.size);
                            }
                          }
                        },
                        onScaleEnd: (_) {
                          _isScaling = false;
                          // Snap back to 1× if almost there
                          if (_viewScale < 1.05) _resetZoom();
                        },
                        child: Container(
                          color: Colors.black,
                          child: Stack(
                            children: [
                              // ── Screen Frame (transformed) ───────────────
                              InteractiveViewer(
                                transformationController: _transformationController,
                                panEnabled: false,   // we handle pan ourselves
                                scaleEnabled: false, // we handle scale ourselves
                                minScale: 0.5,
                                maxScale: 4.0,
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

                              // ── Touch Ripple Pointer ─────────────────────
                              if (_touchPos != null && _touchOpacity > 0)
                                Positioned(
                                  left: _touchPos!.dx - 22,
                                  top: _touchPos!.dy - 22,
                                  child: IgnorePointer(
                                    child: AnimatedOpacity(
                                      opacity: _touchOpacity,
                                      duration: const Duration(milliseconds: 300),
                                      child: Container(
                                        width: 44,
                                        height: 44,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: const Color(0xFF38BDF8).withValues(alpha: 0.35),
                                          border: Border.all(color: Colors.white, width: 2.5),
                                          boxShadow: const [
                                            BoxShadow(color: Color(0xFF38BDF8), blurRadius: 16, spreadRadius: 2)
                                          ],
                                        ),
                                        child: const Center(
                                          child: Icon(Icons.touch_app_rounded, color: Colors.white, size: 20),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),

                              // ── Zoom Level Badge ─────────────────────────
                              if (_showZoomBadge)
                                Positioned(
                                  top: 14,
                                  right: 14,
                                  child: AnimatedOpacity(
                                    opacity: _showZoomBadge ? 1.0 : 0.0,
                                    duration: const Duration(milliseconds: 200),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.72),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: const Color(0xFF38BDF8).withValues(alpha: 0.7),
                                          width: 1.5,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.zoom_in_rounded, color: Color(0xFF38BDF8), size: 14),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${(_viewScale * 100).round()}%',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Reconnection Banner Overlay with Instant Retry Button
              if (service.connectionState == RemoteConnectionState.reconnecting ||
                  service.connectionState == RemoteConnectionState.connecting)
                Positioned(
                  top: _isFullscreen ? 20 : 10,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.6)),
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
                                ? 'Connecting (${service.activeTransportBadge})...'
                                : 'Reconnecting (${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})...',
                            style: const TextStyle(color: Colors.amberAccent, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          icon: const Icon(Icons.bolt_rounded, size: 14),
                          label: const Text('Retry Now', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          onPressed: () {
                            service.retryConnectionNow();
                          },
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
                      color: Colors.orange.withValues(alpha: 0.9),
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
                      color: const Color(0xFF1E293B).withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
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
                                content: Text('Tap: Left Click | Double-Tap: Toggle Menu | Long Press: Right Click | Pinch: Zoom'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                        ),
                        IconButton(
                          tooltip: 'Virtual Keyboard & Shortcuts',
                          icon: const Icon(Icons.keyboard_rounded, color: Colors.white70),
                          onPressed: _showVirtualKeyboardSheet,
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
                                color: Colors.white.withValues(alpha: 0.12),
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
                              ? '?몌툘 Background Mode (Data Saver)'
                              : (service.isConnected
                                  ? '?윟 Connected (${service.activeUrl ?? "Live"})'
                                  : (service.connectionState == RemoteConnectionState.reconnecting
                                      ? '?윝 Reconnecting (${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})...'
                                      : '?뵶 ${service.connectionState.name.toUpperCase()}')),
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
                        tooltip: '?맀 Debug HUD',
                        icon: const Icon(Icons.bug_report_rounded, color: Color(0xFF38BDF8)),
                        onPressed: _showDebugModal,
                      ),
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
    if (service.connectionState == RemoteConnectionState.failed) {
      return Container(
        color: const Color(0xFF0F172A),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 48),
              const SizedBox(height: 16),
              const Text(
                'Connection Failed',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                service.lastErrorMsg ?? 'Unable to connect to host.',
                style: const TextStyle(color: Colors.white70, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                label: const Text('Retry Connection', style: TextStyle(color: Colors.white)),
                onPressed: () {
                  service.retryConnectionNow();
                },
              ),
            ],
          ),
        ),
      );
    }
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

