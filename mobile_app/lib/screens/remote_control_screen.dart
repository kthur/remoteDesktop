import 'dart:async';
import 'package:flutter/gestures.dart';
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
  Timer? _zoomDebounceTimer;

  // ── Control Modes (Drag / Scroll / Floating Bar UX) ──────────
  bool _isDragMode = false;      // Drag Mode: 1-finger holds left mouse button
  bool _isScrollMode = false;    // Scroll Mode: 1-finger drag sends mouse wheel scroll
  bool _isTrackpadMode = false;  // Phase 2 UX: Trackpad Mode (relative mouse move)
  Offset _trackpadVirtualPos = const Offset(0.5, 0.5); // Normalized trackpad cursor position
  bool _isDraggingMouse = false; // Currently holding mouse button down
  bool _isOverlayCollapsed = false; // Floating Bar UX: collapse into tiny trigger pill
  bool _overlayAtTop = false;     // Floating Bar UX: toggle position (Top vs Bottom)

  // ── Phase 1: Sticky Modifier Key States (Ctrl / Shift / Alt Hold) ──
  bool _isCtrlHold = false;
  bool _isShiftHold = false;
  bool _isAltHold = false;

  // ── Physical Keyboard & Mouse ────────────────────────────────
  final FocusNode _keyboardFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _remoteService = RemoteService();

    final auth = Provider.of<AuthService>(context, listen: false);
    if (!auth.isLoggedIn) return;
    auth.getValidIdToken().then((token) {
      if (!mounted || !auth.isLoggedIn) return;
      final userId = auth.currentUser!.id;
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
    _zoomDebounceTimer?.cancel();
    _transformationController.dispose();
    _keyboardFocusNode.dispose();
    WidgetsBinding.instance.removeObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _remoteService.disconnect();
    _remoteService.dispose();
    super.dispose();
  }

  void _notifyZoomRegion() {
    _zoomDebounceTimer?.cancel();
    _zoomDebounceTimer = Timer(const Duration(milliseconds: 150), () {
      if (!mounted) return;
      if (_viewScale <= 1.15) {
        _remoteService.sendInputEvent({
          "type": "zoom_region",
          "scale": 1.0,
        });
        return;
      }
      final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
      if (renderBox == null || renderBox.size.isEmpty) return;

      final Size canvasSize = renderBox.size;
      final topLeft = _transformationController.toScene(Offset.zero);
      final bottomRight = _transformationController.toScene(Offset(canvasSize.width, canvasSize.height));

      final normX = (topLeft.dx / canvasSize.width).clamp(0.0, 1.0);
      final normY = (topLeft.dy / canvasSize.height).clamp(0.0, 1.0);
      final normW = ((bottomRight.dx - topLeft.dx) / canvasSize.width).clamp(0.05, 1.0);
      final normH = ((bottomRight.dy - topLeft.dy) / canvasSize.height).clamp(0.05, 1.0);

      _remoteService.sendInputEvent({
        "type": "zoom_region",
        "scale": _viewScale,
        "x": normX,
        "y": normY,
        "w": normW,
        "h": normH,
      });
    });
  }

  void _resetZoom() {
    setState(() {
      _viewScale = 1.0;
    });
    _transformationController.value = Matrix4.identity();
    _notifyZoomRegion();
  }

  void _showZoomIndicator() {
    _zoomBadgeTimer?.cancel();
    setState(() => _showZoomBadge = true);
    _zoomBadgeTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _showZoomBadge = false);
    });
  }

  void _zoomIn() {
    final newScale = (_viewScale * 1.25).clamp(1.0, 4.0);
    if (newScale == _viewScale) return;
    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    final center = renderBox != null
        ? Offset(renderBox.size.width / 2, renderBox.size.height / 2)
        : const Offset(200, 300);
    final scaleChange = newScale / _viewScale;
    final oldM = _transformationController.value.clone();
    final newM = Matrix4.identity()
      ..translate(center.dx, center.dy)
      ..scale(scaleChange)
      ..translate(-center.dx, -center.dy)
      ..multiply(oldM);

    _transformationController.value = newM;
    setState(() => _viewScale = newScale);
    _showZoomIndicator();
    _notifyZoomRegion();
  }

  void _zoomOut() {
    final newScale = (_viewScale / 1.25).clamp(1.0, 4.0);
    if (newScale <= 1.05) {
      _resetZoom();
      return;
    }
    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    final center = renderBox != null
        ? Offset(renderBox.size.width / 2, renderBox.size.height / 2)
        : const Offset(200, 300);
    final scaleChange = newScale / _viewScale;
    final oldM = _transformationController.value.clone();
    final newM = Matrix4.identity()
      ..translate(center.dx, center.dy)
      ..scale(scaleChange)
      ..translate(-center.dx, -center.dy)
      ..multiply(oldM);

    _transformationController.value = newM;
    setState(() => _viewScale = newScale);
    _showZoomIndicator();
  }

  void _sendNormalizedScroll(Offset localPos, Size widgetSize, double dy) {
    final normX = (localPos.dx / widgetSize.width).clamp(0.0, 1.0);
    final normY = (localPos.dy / widgetSize.height).clamp(0.0, 1.0);
    _remoteService.sendInputEvent({
      "type": "scroll",
      "x": normX,
      "y": normY,
      "dy": dy,
    });
  }

  // ── Physical Keyboard Key Handler ─────────────────────────────
  KeyEventResult _handlePhysicalKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final key = event.logicalKey;
    final isCtrl = HardwareKeyboard.instance.isControlPressed;
    final isAlt = HardwareKeyboard.instance.isAltPressed;
    final isMeta = HardwareKeyboard.instance.isMetaPressed;

    if (isCtrl && key == LogicalKeyboardKey.keyC) {
      _remoteService.sendInputEvent({"type": "shortcut", "action": "ctrl_c"});
      return KeyEventResult.handled;
    }
    if (isCtrl && key == LogicalKeyboardKey.keyV) {
      _remoteService.sendInputEvent({"type": "shortcut", "action": "ctrl_v"});
      return KeyEventResult.handled;
    }
    if (isCtrl && key == LogicalKeyboardKey.keyZ) {
      _remoteService.sendInputEvent({"type": "shortcut", "action": "ctrl_z"});
      return KeyEventResult.handled;
    }
    if (isAlt && key == LogicalKeyboardKey.tab) {
      _remoteService.sendInputEvent({"type": "shortcut", "action": "alt_tab"});
      return KeyEventResult.handled;
    }
    if (isMeta) {
      _remoteService.sendInputEvent({"type": "shortcut", "action": "win"});
      return KeyEventResult.handled;
    }

    final keyMap = <LogicalKeyboardKey, String>{
      LogicalKeyboardKey.enter: "enter",
      LogicalKeyboardKey.numpadEnter: "enter",
      LogicalKeyboardKey.backspace: "backspace",
      LogicalKeyboardKey.tab: "tab",
      LogicalKeyboardKey.space: "space",
      LogicalKeyboardKey.escape: "esc",
      LogicalKeyboardKey.arrowUp: "up",
      LogicalKeyboardKey.arrowDown: "down",
      LogicalKeyboardKey.arrowLeft: "left",
      LogicalKeyboardKey.arrowRight: "right",
      LogicalKeyboardKey.delete: "delete",
      LogicalKeyboardKey.home: "home",
      LogicalKeyboardKey.end: "end",
      LogicalKeyboardKey.pageUp: "pageup",
      LogicalKeyboardKey.pageDown: "pagedown",
      LogicalKeyboardKey.f1: "f1",
      LogicalKeyboardKey.f2: "f2",
      LogicalKeyboardKey.f3: "f3",
      LogicalKeyboardKey.f4: "f4",
      LogicalKeyboardKey.f5: "f5",
      LogicalKeyboardKey.f6: "f6",
      LogicalKeyboardKey.f7: "f7",
      LogicalKeyboardKey.f8: "f8",
      LogicalKeyboardKey.f9: "f9",
      LogicalKeyboardKey.f10: "f10",
      LogicalKeyboardKey.f11: "f11",
      LogicalKeyboardKey.f12: "f12",
    };

    if (keyMap.containsKey(key)) {
      _remoteService.sendInputEvent({"type": "key", "key": keyMap[key]});
      return KeyEventResult.handled;
    }

    if (event.character != null && event.character!.isNotEmpty) {
      _remoteService.sendInputEvent({"type": "text", "text": event.character});
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
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

    final res = _remoteService.currentResolution;
    if (_fitMode == BoxFit.contain && res != null && res['width'] != null && res['height'] != null) {
      double hostW = (res['width'] as num).toDouble();
      double hostH = (res['height'] as num).toDouble();
      if (hostW > 0 && hostH > 0) {
        double canvasAspect = canvasSize.width / canvasSize.height;
        double hostAspect = hostW / hostH;

        double renderW = canvasSize.width;
        double renderH = canvasSize.height;
        double offsetX = 0.0;
        double offsetY = 0.0;

        if (canvasAspect > hostAspect) {
          renderW = canvasSize.height * hostAspect;
          offsetX = (canvasSize.width - renderW) / 2.0;
        } else {
          renderH = canvasSize.width / hostAspect;
          offsetY = (canvasSize.height - renderH) / 2.0;
        }

        normX = ((localPosition.dx - offsetX) / renderW).clamp(0.0, 1.0);
        normY = ((localPosition.dy - offsetY) / renderH).clamp(0.0, 1.0);
      }
    }

    final payload = {
      "type": type,
      "x": normX,
      "y": normY,
      if (_isCtrlHold) "ctrl": true,
      if (_isShiftHold) "shift": true,
      if (_isAltHold) "alt": true,
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
    _remoteService.requestWindowsList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final activeWindows = _remoteService.openWindows;
            final currentHandle = _remoteService.selectedWindowHandle;

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.window_rounded, color: Color(0xFF38BDF8)),
                          SizedBox(width: 8),
                          Text(
                            '🪟 Windows 앱 선택 & 표시 모드',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF38BDF8)),
                            tooltip: '윈도우 목록 새로고침',
                            onPressed: () {
                              _remoteService.requestWindowsList();
                              Future.delayed(const Duration(milliseconds: 300), () {
                                if (mounted) setModalState(() {});
                              });
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Colors.white60),
                            onPressed: () => Navigator.pop(context),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '연결된 모니터 또는 작업표시줄의 특정 앱을 선택하여 스트리밍 대상을 전환할 수 있습니다.',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  const SizedBox(height: 12),

                  // ── MULTI-MONITOR SELECTION ──────────────────────────────────
                  if (_remoteService.openMonitors.isNotEmpty) ...[
                    const Text('🖥️ 디스플레이 모니터 선택:', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    SizedBox(
                      height: 38,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _remoteService.openMonitors.length,
                        itemBuilder: (context, idx) {
                          final mon = _remoteService.openMonitors[idx];
                          final isSelectedMon = (currentHandle == 0 && _remoteService.selectedMonitorIndex == idx);
                          final monTitle = mon["title"] ?? "Monitor $idx";

                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              selected: isSelectedMon,
                              selectedColor: const Color(0xFF0284C7),
                              backgroundColor: const Color(0xFF0F172A),
                              side: BorderSide(color: isSelectedMon ? const Color(0xFF38BDF8) : Colors.white24),
                              label: Text(
                                monTitle,
                                style: TextStyle(
                                  color: isSelectedMon ? Colors.white : Colors.white70,
                                  fontSize: 11,
                                  fontWeight: isSelectedMon ? FontWeight.bold : FontWeight.normal,
                                ),
                              ),
                              onSelected: (_) {
                                _remoteService.selectMonitor(idx);
                                Navigator.pop(context);
                              },
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // ── MODE 1: PC Full Desktop Option ──────────────────────────
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: currentHandle == 0
                          ? const Color(0xFF0284C7).withValues(alpha: 0.25)
                          : const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: currentHandle == 0 ? const Color(0xFF38BDF8) : Colors.white10,
                        width: 1.5,
                      ),
                    ),
                    child: ListTile(
                      leading: const Icon(Icons.desktop_windows_rounded, color: Color(0xFF38BDF8), size: 28),
                      title: const Text(
                        '1. 🖥️ PC 전체 화면 (Full Desktop)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      subtitle: const Text(
                        'PC 모니터 전체 화면을 그대로 스트리밍합니다.',
                        style: TextStyle(color: Colors.white60, fontSize: 11),
                      ),
                      trailing: currentHandle == 0
                          ? const Icon(Icons.check_circle_rounded, color: Color(0xFF38BDF8))
                          : null,
                      onTap: () {
                        _remoteService.selectWindow(0);
                        Navigator.pop(context);
                      },
                    ),
                  ),

                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      '📱 Windows 실행 중인 앱 목록 (특정 앱 화면 전용):',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),

                  if (activeWindows.isEmpty)
                    const Expanded(
                      child: Center(
                        child: Text(
                          '호스트 PC에서 실행 중인 윈도우를 탐색 중입니다...',
                          style: TextStyle(color: Colors.white60),
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: ListView.builder(
                        itemCount: activeWindows.length,
                        itemBuilder: (context, index) {
                          final win = activeWindows[index];
                          final handle = (win["handle"] as num?)?.toInt() ?? 0;
                          if (win["is_desktop"] == true || handle == 0) return const SizedBox.shrink();

                          final isSelected = handle == currentHandle;
                          final title = win["title"] ?? "Window";

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF0284C7).withValues(alpha: 0.25)
                                  : const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF38BDF8) : Colors.white10,
                                width: isSelected ? 1.5 : 1.0,
                              ),
                            ),
                            child: ExpansionTile(
                              key: PageStorageKey('win_$handle'),
                              initiallyExpanded: isSelected,
                              leading: Icon(
                                Icons.window_rounded,
                                color: isSelected ? const Color(0xFF38BDF8) : Colors.white70,
                              ),
                              title: Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                  fontSize: 13,
                                ),
                              ),
                              subtitle: Text(
                                'Handle: $handle | ${win["width"] ?? 0}x${win["height"] ?? 0}',
                                style: const TextStyle(color: Colors.white38, fontSize: 10),
                              ),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                                  child: Row(
                                    children: [
                                      // MODE 2: Specific App - Fill Mobile Screen
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: (isSelected && _fitMode == BoxFit.fill)
                                                ? const Color(0xFF0284C7)
                                                : const Color(0xFF1E293B),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(vertical: 10),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              side: BorderSide(
                                                color: (isSelected && _fitMode == BoxFit.fill)
                                                    ? const Color(0xFF38BDF8)
                                                    : Colors.white24,
                                              ),
                                            ),
                                          ),
                                          icon: const Icon(Icons.aspect_ratio_rounded, size: 16),
                                          label: const Text('2. 모바일 전체화면 채움', style: TextStyle(fontSize: 11)),
                                          onPressed: () {
                                            _remoteService.selectWindow(handle);
                                            setState(() => _fitMode = BoxFit.fill);
                                            Navigator.pop(context);
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 8),

                                      // MODE 3: Specific App - Windows Original Aspect
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: (isSelected && _fitMode == BoxFit.contain)
                                                ? const Color(0xFF0284C7)
                                                : const Color(0xFF1E293B),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(vertical: 10),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              side: BorderSide(
                                                color: (isSelected && _fitMode == BoxFit.contain)
                                                    ? const Color(0xFF38BDF8)
                                                    : Colors.white24,
                                              ),
                                            ),
                                          ),
                                          icon: const Icon(Icons.fit_screen_rounded, size: 16),
                                          label: const Text('3. Windows 원본 해상도', style: TextStyle(fontSize: 11)),
                                          onPressed: () {
                                            _remoteService.selectWindow(handle);
                                            setState(() => _fitMode = BoxFit.contain);
                                            Navigator.pop(context);
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
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
                '🖥️ Display Resolution Control (Windows)',
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
                        '⌨️ 가상 키보드 & 빠른 단축키',
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
                        hintText: 'PC로 전송할 텍스트 입력 (한글/영문 가능)...',
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
              const Text('📌 보조키 고정 토글 (Sticky Modifier Keys):', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              StatefulBuilder(
                builder: (context, setSheetState) {
                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilterChip(
                        selected: _isCtrlHold,
                        selectedColor: const Color(0xFF0284C7),
                        backgroundColor: const Color(0xFF0F172A),
                        side: BorderSide(color: _isCtrlHold ? const Color(0xFF38BDF8) : Colors.white24),
                        label: Text(
                          _isCtrlHold ? '📌 Ctrl (고정됨)' : 'Ctrl 고정',
                          style: TextStyle(color: _isCtrlHold ? Colors.white : Colors.white70, fontSize: 12, fontWeight: _isCtrlHold ? FontWeight.bold : FontWeight.normal),
                        ),
                        onSelected: (val) {
                          setState(() => _isCtrlHold = val);
                          setSheetState(() {});
                        },
                      ),
                      FilterChip(
                        selected: _isShiftHold,
                        selectedColor: const Color(0xFF0284C7),
                        backgroundColor: const Color(0xFF0F172A),
                        side: BorderSide(color: _isShiftHold ? const Color(0xFF38BDF8) : Colors.white24),
                        label: Text(
                          _isShiftHold ? '📌 Shift (고정됨)' : 'Shift 고정',
                          style: TextStyle(color: _isShiftHold ? Colors.white : Colors.white70, fontSize: 12, fontWeight: _isShiftHold ? FontWeight.bold : FontWeight.normal),
                        ),
                        onSelected: (val) {
                          setState(() => _isShiftHold = val);
                          setSheetState(() {});
                        },
                      ),
                      FilterChip(
                        selected: _isAltHold,
                        selectedColor: const Color(0xFF0284C7),
                        backgroundColor: const Color(0xFF0F172A),
                        side: BorderSide(color: _isAltHold ? const Color(0xFF38BDF8) : Colors.white24),
                        label: Text(
                          _isAltHold ? '📌 Alt (고정됨)' : 'Alt 고정',
                          style: TextStyle(color: _isAltHold ? Colors.white : Colors.white70, fontSize: 12, fontWeight: _isAltHold ? FontWeight.bold : FontWeight.normal),
                        ),
                        onSelected: (val) {
                          setState(() => _isAltHold = val);
                          setSheetState(() {});
                        },
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 16),
              const Text('⚡ 자주 쓰는 Windows 단축키 목록:', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),

              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _shortcutChip('🚨 Ctrl+Alt+Del (작업관리자)', 'ctrl_alt_del'),
                  _shortcutChip('🔒 Win + L (화면 잠금)', 'win_l'),
                  _shortcutChip('💻 Win + D (바탕화면)', 'win_d'),
                  _shortcutChip('🔄 Alt + Tab (창 전환)', 'alt_tab'),
                  _shortcutChip('↵ Enter (엔터)', 'enter'),
                  _shortcutChip('⌫ Backspace', 'backspace'),
                  _shortcutChip('⇥ Tab (탭)', 'tab'),
                  _shortcutChip('⏹️ Esc (취소)', 'esc'),
                  _shortcutChip('↩️ Ctrl + Z (되돌리기)', 'ctrl_z'),
                  _shortcutChip('📋 Ctrl + C (복사)', 'ctrl_c'),
                  _shortcutChip('📌 Ctrl + V (붙여넣기)', 'ctrl_v'),
                  _shortcutChip('🪟 Windows 키', 'win'),
                  _shortcutChip('⬆️ 위 (Up)', 'up'),
                  _shortcutChip('⬇️ 아래 (Down)', 'down'),
                  _shortcutChip('⬅️ 왼쪽 (Left)', 'left'),
                  _shortcutChip('➡️ 오른쪽 (Right)', 'right'),
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
                            '📊 Diagnostics & Connection HUD',
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

  Widget _buildReconnectionBanner() {
    return Container(
      width: double.infinity,
      color: Colors.amber.shade900.withOpacity(0.9),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          ),
          SizedBox(width: 10),
          Text(
            'Reconnecting to Host PC...',
            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
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
              if (service.connectionState == RemoteConnectionState.reconnecting)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _buildReconnectionBanner(),
                ),
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
                          if (_isScaling) {
                            _touchOpacity = 0.0;
                          } else if (_isDragMode) {
                            _isDraggingMouse = true;
                            final localPos = _transformationController.toScene(details.localFocalPoint);
                            final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                            if (renderBox != null) {
                              _sendNormalizedInput("mousedown", localPos, renderBox.size);
                            }
                          }
                        },
                        onScaleUpdate: (details) {
                          if (details.pointerCount > 1) {
                            if (!_isScaling) {
                              // Transition to 2-finger zoom mode seamlessly
                              _isScaling = true;
                              _scaleAtStart = _viewScale;
                              _touchOpacity = 0.0;
                              if (_isDraggingMouse) {
                                _isDraggingMouse = false;
                                final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                                if (renderBox != null) {
                                  _sendNormalizedInput("mouseup", Offset.zero, renderBox.size);
                                }
                              }
                            }

                             // ── 2 Fingers: Pinch to Zoom, Smooth Pan, and 2-Finger Wheel Scroll ─────
                            final delta = details.focalPointDelta;
                            final focal = details.localFocalPoint;

                            final newScale = (_scaleAtStart * details.scale).clamp(1.0, 4.0);
                            final scaleChange = newScale / _viewScale;

                            // 2-Finger Vertical Swipe -> Automatic Mouse Wheel Scroll
                            if (_viewScale <= 1.05 && (scaleChange - 1.0).abs() < 0.04 && delta.dy.abs() > 0.4) {
                              final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                              if (renderBox != null) {
                                final localPos = _transformationController.toScene(focal);
                                _sendNormalizedScroll(localPos, renderBox.size, -delta.dy);
                              }
                            } else {
                              final m = _transformationController.value.clone();

                              // Apply smooth pan
                              if (delta.dx != 0 || delta.dy != 0) {
                                m.translate(delta.dx / _viewScale, delta.dy / _viewScale);
                              }

                              // Apply zoom centered on pinch focal point
                              if ((scaleChange - 1.0).abs() > 0.001) {
                                final sceneFocal = _transformationController.toScene(focal);
                                m.translate(sceneFocal.dx, sceneFocal.dy);
                                m.scale(scaleChange);
                                m.translate(-sceneFocal.dx, -sceneFocal.dy);
                                _viewScale = newScale;
                              }

                              _transformationController.value = m;
                              setState(() {});
                              _showZoomIndicator();
                              _notifyZoomRegion();
                            }
                          } else if (!_isScaling) {
                            // ── Single finger: move PC mouse / Drag / Scroll / Trackpad ─
                            final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                            if (renderBox != null) {
                              if (_isScrollMode) {
                                final dy = details.focalPointDelta.dy;
                                if (dy.abs() > 0.3) {
                                  final localPos = _transformationController.toScene(details.localFocalPoint);
                                  _sendNormalizedScroll(localPos, renderBox.size, -dy);
                                }
                              } else if (_isTrackpadMode) {
                                // Trackpad mode: relative cursor movement
                                final delta = details.focalPointDelta;
                                final newNormX = (_trackpadVirtualPos.dx + (delta.dx / renderBox.size.width) / _viewScale).clamp(0.0, 1.0);
                                final newNormY = (_trackpadVirtualPos.dy + (delta.dy / renderBox.size.height) / _viewScale).clamp(0.0, 1.0);
                                _trackpadVirtualPos = Offset(newNormX, newNormY);

                                final scenePos = Offset(newNormX * renderBox.size.width, newNormY * renderBox.size.height);
                                _triggerTouchVisual(scenePos);
                                _sendNormalizedInput("move", scenePos, renderBox.size);
                              } else {
                                final localPos = _transformationController.toScene(details.localFocalPoint);
                                _triggerTouchVisual(localPos);
                                _sendNormalizedInput("move", localPos, renderBox.size);
                              }
                            }
                          }
                        },
                        onScaleEnd: (details) {
                          if (_isDraggingMouse) {
                            _isDraggingMouse = false;
                            final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                            if (renderBox != null) {
                              _sendNormalizedInput("mouseup", Offset.zero, renderBox.size);
                            }
                          }
                          _isScaling = false;
                          if (_viewScale < 1.05) {
                            _resetZoom();
                          } else {
                            _notifyZoomRegion();
                          }
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
                                    filterQuality: FilterQuality.high,
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

              // Floating Controls Bar Overlay (Collapsible & Positionable Top/Bottom)
              if (_showOverlay)
                _isOverlayCollapsed
                    ? Positioned(
                        top: _overlayAtTop ? (_isFullscreen ? 36 : 18) : null,
                        bottom: _overlayAtTop ? null : 18,
                        right: 18,
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => setState(() => _isOverlayCollapsed = false),
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B).withValues(alpha: 0.85),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.6), width: 1.5),
                                boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.tune_rounded, color: Color(0xFF38BDF8), size: 16),
                                  SizedBox(width: 6),
                                  Text(
                                    "툴바 열기",
                                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      )
                    : Positioned(
                        top: _overlayAtTop ? (_isFullscreen ? 36 : 18) : null,
                        bottom: _overlayAtTop ? null : 18,
                        left: 14,
                        right: 14,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B).withValues(alpha: 0.78),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                            boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
                          ),
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                IconButton(
                                  tooltip: 'Minimize Toolbar',
                                  icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.amberAccent),
                                  onPressed: () => setState(() => _isOverlayCollapsed = true),
                                ),
                                IconButton(
                                  tooltip: _overlayAtTop ? 'Move Toolbar to Bottom' : 'Move Toolbar to Top',
                                  icon: Icon(
                                    _overlayAtTop ? Icons.vertical_align_bottom_rounded : Icons.vertical_align_top_rounded,
                                    color: const Color(0xFF38BDF8),
                                  ),
                                  onPressed: () => setState(() => _overlayAtTop = !_overlayAtTop),
                                ),
                                const SizedBox(width: 4),
                                Container(width: 1, height: 20, color: Colors.white24),
                                const SizedBox(width: 4),
                                IconButton(
                                  tooltip: 'Mouse Instructions',
                                  icon: const Icon(Icons.mouse_rounded, color: Color(0xFF38BDF8)),
                                  onPressed: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Tap: Click | Long Press: RClick | Pinch: Zoom | Mode: Drag & Scroll'),
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                  },
                                ),
                                // -- Trackpad Mode Toggle Button --
                                IconButton(
                                  tooltip: _isTrackpadMode ? 'Trackpad Mode (ON)' : 'Direct Touch Mode',
                                  icon: Icon(
                                    Icons.touch_app_rounded,
                                    color: _isTrackpadMode ? Colors.amberAccent : Colors.white70,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isTrackpadMode = !_isTrackpadMode;
                                    });
                                  },
                                ),
                                // ── Drag Mode Toggle Button ──────────────────────
                                IconButton(
                                  tooltip: _isDragMode ? 'Drag Mode (ON)' : 'Drag Mode (OFF)',
                                  icon: Icon(
                                    Icons.drag_indicator_rounded,
                                    color: _isDragMode ? Colors.amberAccent : Colors.white70,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isDragMode = !_isDragMode;
                                      if (_isDragMode) _isScrollMode = false;
                                    });
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(_isDragMode ? '🖐️ Drag Mode Enabled' : 'Normal Touch Mode'),
                                        duration: const Duration(milliseconds: 900),
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                  },
                                ),
                                // ── Scroll Mode Toggle Button ────────────────────
                                IconButton(
                                  tooltip: _isScrollMode ? 'Scroll Mode (ON)' : 'Scroll Mode (OFF)',
                                  icon: Icon(
                                    Icons.swap_vert_rounded,
                                    color: _isScrollMode ? Colors.amberAccent : Colors.white70,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isScrollMode = !_isScrollMode;
                                      if (_isScrollMode) _isDragMode = false;
                                    });
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(_isScrollMode ? '📜 Scroll Mode Enabled' : 'Normal Touch Mode'),
                                        duration: const Duration(milliseconds: 900),
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
                      ),

              // ── Always-on Mini FPS / Ping Latency HUD Chip ────────────────
              Positioned(
                top: _isFullscreen ? 12 : 8,
                left: 16,
                child: GestureDetector(
                  onTap: _showDebugModal,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: service.isConnected ? const Color(0xFF38BDF8).withValues(alpha: 0.6) : Colors.amberAccent,
                        width: 1.0,
                      ),
                      boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 6)],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: service.isConnected ? Colors.greenAccent : Colors.amberAccent,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${service.currentFps.toStringAsFixed(1)} FPS | ${service.lastPingMs} ms',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // ── Floating Zoom Controls (+ / - / Reset 1:1) ────────────────
              if (_showOverlay || _viewScale > 1.0)
                Positioned(
                  right: 16,
                  bottom: _showOverlay ? 86 : 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.88),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.5)),
                      boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                          onPressed: _zoomIn,
                          tooltip: 'Zoom In (+)',
                        ),
                        InkWell(
                          onTap: _resetZoom,
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Text(
                              '${(_viewScale * 100).round()}%',
                              style: const TextStyle(
                                color: Color(0xFF38BDF8),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        IconButton(
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.remove_rounded, color: Colors.white, size: 20),
                          onPressed: _zoomOut,
                          tooltip: 'Zoom Out (-)',
                        ),
                      ],
                    ),
                  ),
                ),

              // ── Connection Loss / Reconnecting Large Overlay Card ──────────
              if (!service.isConnected && !service.isBackground)
                Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 28),
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.5), width: 1.5),
                      boxShadow: const [BoxShadow(color: Colors.black87, blurRadius: 20)],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          width: 42,
                          height: 42,
                          child: CircularProgressIndicator(
                            strokeWidth: 3.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF38BDF8)),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          service.connectionState == RemoteConnectionState.reconnecting
                              ? '🔌 PC 호스트 연결 탐색 및 재연결 중...'
                              : '⚠️ 원격 연결 해제됨',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          service.connectionState == RemoteConnectionState.reconnecting
                              ? '네트워크 재탐색 중입니다 (시도: ${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})'
                              : (service.lastErrorMsg ?? '호스트 PC와 통신이 중단되었습니다. 다시 시도해 주세요.'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                        const SizedBox(height: 18),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
                          label: const Text('⚡ 즉시 재연결 시도', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          onPressed: () {
                            service.ensureConnected();
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );

          return Scaffold(
            resizeToAvoidBottomInset: true,
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
                            Flexible(
                              child: Text(
                                widget.deviceName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
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
                              ? '🌙 Background Mode (Data Saver)'
                              : (service.isConnected
                                  ? '🟢 Connected (${service.activeUrl ?? "Live"})'
                                  : (service.connectionState == RemoteConnectionState.reconnecting
                                      ? '🟡 Reconnecting (${service.reconnectAttempts}/${RemoteService.maxReconnectAttempts})...'
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
                        tooltip: '📊 Debug HUD',
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
            body: Focus(
              focusNode: _keyboardFocusNode,
              autofocus: true,
              onKeyEvent: _handlePhysicalKeyEvent,
              child: Listener(
                onPointerHover: (event) {
                  if (event.kind == PointerDeviceKind.mouse) {
                    final localPos = _transformationController.toScene(event.localPosition);
                    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                    if (renderBox != null) {
                      _sendNormalizedInput("move", localPos, renderBox.size);
                    }
                  }
                },
                onPointerDown: (event) {
                  if (event.kind == PointerDeviceKind.mouse) {
                    final localPos = _transformationController.toScene(event.localPosition);
                    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                    if (renderBox != null) {
                      if (event.buttons == kSecondaryMouseButton) {
                        _triggerTouchVisual(localPos, isRightClick: true);
                        _sendNormalizedInput("rclick", localPos, renderBox.size);
                      } else if (event.buttons == kPrimaryMouseButton) {
                        _triggerTouchVisual(localPos);
                        _sendNormalizedInput("mousedown", localPos, renderBox.size);
                        _isDraggingMouse = true;
                      } else if (event.buttons == kMiddleMouseButton) {
                        _sendNormalizedInput("dclick", localPos, renderBox.size);
                      }
                    }
                  }
                },
                onPointerUp: (event) {
                  if (event.kind == PointerDeviceKind.mouse && _isDraggingMouse) {
                    _isDraggingMouse = false;
                    final localPos = _transformationController.toScene(event.localPosition);
                    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                    if (renderBox != null) {
                      _sendNormalizedInput("mouseup", localPos, renderBox.size);
                    }
                  }
                },
                onPointerSignal: (event) {
                  if (event is PointerScrollEvent) {
                    final localPos = _transformationController.toScene(event.localPosition);
                    final renderBox = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                    if (renderBox != null) {
                      _sendNormalizedScroll(localPos, renderBox.size, event.scrollDelta.dy / 2);
                    }
                  }
                },
                child: MouseRegion(
                  cursor: SystemMouseCursors.precise,
                  child: _isFullscreen
                      ? bodyContent
                      : SafeArea(
                          child: bodyContent,
                        ),
                ),
              ),
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

