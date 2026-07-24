import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum RemoteConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  failed,
}

enum ConnectionTransport {
  usbAdb,
  localWifi,
  emulator,
  relay,
  none,
}

class RemoteService extends ChangeNotifier {
  WebSocketChannel? _channel;
  StreamSubscription? _streamSubscription;
  RemoteConnectionState _connectionState = RemoteConnectionState.disconnected;
  ConnectionTransport _activeTransport = ConnectionTransport.none;
  String? _activeUrl;

  Uint8List? _latestFrameBytes;
  List<Map<String, dynamic>> _openWindows = [];
  Map<String, dynamic>? _currentResolution;
  List<Map<String, dynamic>> _supportedResolutions = [];
  int _selectedWindowHandle = 0;
  bool _isBackground = false;

  String? _serverUrl;
  String? _googleUserId;
  String? _targetDeviceId;
  List<String>? _knownLocalIps;

  // Reconnection and Heartbeat
  int _reconnectAttempts = 0;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  DateTime? _lastPongReceived;
  bool _isManualDisconnect = false;

  static const int maxReconnectAttempts = 10;
  static const Duration pingInterval = Duration(seconds: 15);
  static const Duration pingTimeoutThreshold = Duration(seconds: 35);

  RemoteConnectionState get connectionState => _connectionState;
  ConnectionTransport get activeTransport => _activeTransport;
  bool get isConnected => _connectionState == RemoteConnectionState.connected;
  int get reconnectAttempts => _reconnectAttempts;
  String? get activeUrl => _activeUrl;

  Uint8List? get latestFrameBytes => _latestFrameBytes;
  List<Map<String, dynamic>> get openWindows => _openWindows;
  Map<String, dynamic>? get currentResolution => _currentResolution;
  List<Map<String, dynamic>> get supportedResolutions => _supportedResolutions;
  int get selectedWindowHandle => _selectedWindowHandle;
  bool get isBackground => _isBackground;

  String get activeTransportBadge {
    switch (_activeTransport) {
      case ConnectionTransport.usbAdb:
        return '🔌 USB ADB';
      case ConnectionTransport.localWifi:
        return '📶 LAN Wi-Fi';
      case ConnectionTransport.emulator:
        return '📱 Emulator';
      case ConnectionTransport.relay:
        return '🌐 Cloud Relay';
      case ConnectionTransport.none:
        return '⚪ Disconnected';
    }
  }

  ConnectionTransport classifyTransport(String url) {
    if (url.contains('127.0.0.1') || url.contains('localhost')) {
      return ConnectionTransport.usbAdb;
    } else if (url.contains('10.0.2.2')) {
      return ConnectionTransport.emulator;
    } else if (RegExp(r'192\.168\.|10\.\d+\.|172\.(1[6-9]|2[0-9]|3[0-1])\.').hasMatch(url)) {
      return ConnectionTransport.localWifi;
    } else {
      return ConnectionTransport.relay;
    }
  }

  void connect(
    String serverUrl,
    String googleUserId,
    String targetDeviceId, {
    List<String>? candidateUrls,
    List<String>? knownLocalIps,
  }) {
    _serverUrl = serverUrl;
    _googleUserId = googleUserId;
    _targetDeviceId = targetDeviceId;
    _knownLocalIps = knownLocalIps;
    _isManualDisconnect = false;
    _reconnectAttempts = 0;

    _startConnectionProbing(overrideCandidates: candidateUrls);
  }

  void ensureConnected() {
    if (_isManualDisconnect) return;
    if (_connectionState == RemoteConnectionState.disconnected ||
        _connectionState == RemoteConnectionState.failed) {
      _reconnectAttempts = 0;
      _startConnectionProbing();
    }
  }

  Future<List<String>> _buildCandidateUrls() async {
    final List<String> candidates = [];

    // Priority 1: USB ADB direct (127.0.0.1)
    candidates.add('ws://127.0.0.1:8080');

    // Priority 2: Wi-Fi LAN IPs
    if (_knownLocalIps != null && _knownLocalIps!.isNotEmpty) {
      for (var ip in _knownLocalIps!) {
        final url = 'ws://$ip:8080';
        if (!candidates.contains(url)) {
          candidates.add(url);
        }
      }
    }

    // Priority 3: Android Emulator Loopback
    candidates.add('ws://10.0.2.2:8080');

    // Priority 4: Central Relay Server
    if (_serverUrl != null && !candidates.contains(_serverUrl)) {
      candidates.add(_serverUrl!);
    }

    return candidates;
  }

  Future<void> _startConnectionProbing({List<String>? overrideCandidates}) async {
    _cancelReconnectTimer();
    _stopPingTimer();

    _connectionState = _reconnectAttempts == 0
        ? RemoteConnectionState.connecting
        : RemoteConnectionState.reconnecting;
    notifyListeners();

    if (_serverUrl == null || _googleUserId == null || _targetDeviceId == null) {
      _connectionState = RemoteConnectionState.failed;
      notifyListeners();
      return;
    }

    final candidateUrls = overrideCandidates ?? await _buildCandidateUrls();
    debugPrint('Starting candidate connection probing across ${candidateUrls.length} targets: $candidateUrls');

    bool winnerFound = false;
    final List<WebSocketChannel> openProbingChannels = [];
    final List<StreamSubscription> probingSubscriptions = [];

    final Completer<bool> probeCompleter = Completer<bool>();

    for (var candidateUrl in candidateUrls) {
      if (winnerFound) break;

      try {
        final uri = Uri.parse(candidateUrl);
        final channel = WebSocketChannel.connect(uri);
        openProbingChannels.add(channel);

        final regMsg = jsonEncode({
          "type": "register_client",
          "google_user_id": _googleUserId,
          "target_device_id": _targetDeviceId
        });
        channel.sink.add(regMsg);

        late StreamSubscription sub;
        sub = channel.stream.listen(
          (data) {
            try {
              final parsed = jsonDecode(data.toString());
              final msgType = parsed["type"];

              if (!winnerFound && (msgType == "client_registered" || msgType == "screen_frame")) {
                winnerFound = true;
                _activeChannel = channel;
                _activeUrl = candidateUrl;
                _activeTransport = classifyTransport(candidateUrl);
                _streamSubscription = sub;

                for (var ch in openProbingChannels) {
                  if (ch != channel) {
                    try {
                      ch.sink.close();
                    } catch (_) {}
                  }
                }
                for (var s in probingSubscriptions) {
                  if (s != sub) {
                    s.cancel();
                  }
                }

                _onSuccessfulConnection(parsed);
                if (!probeCompleter.isCompleted) {
                  probeCompleter.complete(true);
                }
              } else if (winnerFound && channel == _activeChannel) {
                _handleServerMessage(data);
              }
            } catch (e) {
              debugPrint("Error reading probe frame: $e");
            }
          },
          onError: (err) {
            debugPrint("Probe error on $candidateUrl: $err");
            if (channel == _activeChannel && !winnerFound) {
              _handleDisconnectOrError();
            }
          },
          onDone: () {
            debugPrint("Probe closed on $candidateUrl");
            if (channel == _activeChannel) {
              _handleDisconnectOrError();
            }
          },
        );

        probingSubscriptions.add(sub);
      } catch (e) {
        debugPrint("Exception probing $candidateUrl: $e");
      }
    }

    Timer(const Duration(seconds: 4), () {
      if (!winnerFound && !probeCompleter.isCompleted) {
        for (var ch in openProbingChannels) {
          try {
            ch.sink.close();
          } catch (_) {}
        }
        for (var s in probingSubscriptions) {
          s.cancel();
        }
        probeCompleter.complete(false);
      }
    });

    final success = await probeCompleter.future;
    if (!success && !winnerFound) {
      _handleDisconnectOrError();
    }
  }

  WebSocketChannel? get _activeChannel => _channel;
  set _activeChannel(WebSocketChannel? channel) => _channel = channel;

  void _onSuccessfulConnection(Map<String, dynamic> firstMsg) {
    _connectionState = RemoteConnectionState.connected;
    _reconnectAttempts = 0;
    _lastPongReceived = DateTime.now();
    _startPingTimer();

    debugPrint('Successfully connected to $_activeUrl via $_activeTransport badge: $activeTransportBadge');

    _handleServerMessage(jsonEncode(firstMsg));
    _reSynchronizeSessionState();
    notifyListeners();
  }

  void _handleDisconnectOrError() {
    _stopPingTimer();
    _cleanupActiveChannel();

    if (_isManualDisconnect || _connectionState == RemoteConnectionState.disconnected) return;

    if (_reconnectAttempts < maxReconnectAttempts) {
      _reconnectAttempts++;
      _connectionState = RemoteConnectionState.reconnecting;
      notifyListeners();

      final delay = _calculateBackoffDelay(_reconnectAttempts);
      debugPrint("Scheduling reconnect attempt $_reconnectAttempts in ${delay.inMilliseconds}ms");

      _reconnectTimer = Timer(delay, () {
        _startConnectionProbing();
      });
    } else {
      _connectionState = RemoteConnectionState.failed;
      notifyListeners();
    }
  }

  Duration _calculateBackoffDelay(int attempt) {
    final double exponentialFactor = math.pow(2.0, math.min(attempt - 1, 10)).toDouble();
    final int calculatedMs = (1000 * exponentialFactor).round();
    final int cappedMs = math.min(calculatedMs, 30000);
    final double jitter = 0.8 + (math.Random().nextDouble() * 0.4);
    return Duration(milliseconds: (cappedMs * jitter).round());
  }

  void _handleServerMessage(dynamic rawMsg) {
    try {
      final data = jsonDecode(rawMsg.toString());
      final msgType = data["type"];

      if (msgType == "client_registered") {
        _connectionState = RemoteConnectionState.connected;
        _reconnectAttempts = 0;
        _lastPongReceived = DateTime.now();
        _startPingTimer();
        notifyListeners();

        _reSynchronizeSessionState();
      } else if (msgType == "pong") {
        _lastPongReceived = DateTime.now();
      } else if (msgType == "screen_frame") {
        _lastPongReceived = DateTime.now();
        if (!_isBackground && data["frame"] != null) {
          _latestFrameBytes = base64Decode(data["frame"]);
          notifyListeners();
        }
      } else if (msgType == "windows_list_update") {
        if (data["windows"] != null) {
          _openWindows = List<Map<String, dynamic>>.from(data["windows"]);
          notifyListeners();
        }
      } else if (msgType == "resolution_updated") {
        if (data["resolution"] != null) {
          _currentResolution = Map<String, dynamic>.from(data["resolution"]);
          notifyListeners();
        }
      } else if (msgType == "device_list_update") {
        final devices = List<dynamic>.from(data["devices"] ?? []);
        for (var dev in devices) {
          if (dev["device_id"] == _targetDeviceId) {
            if (dev["windows"] != null) {
              _openWindows = List<Map<String, dynamic>>.from(dev["windows"]);
            }
            if (dev["resolution"] != null) {
              _currentResolution = Map<String, dynamic>.from(dev["resolution"]);
            }
            if (dev["supported_resolutions"] != null) {
              _supportedResolutions = List<Map<String, dynamic>>.from(dev["supported_resolutions"]);
            }
            notifyListeners();
            break;
          }
        }
      }
    } catch (e) {
      debugPrint("Error processing WS frame: $e");
    }
  }

  void _reSynchronizeSessionState() {
    if (_selectedWindowHandle != 0) {
      selectWindow(_selectedWindowHandle);
    }
    if (_isBackground) {
      updateAppState(true);
    }
  }

  void _startPingTimer() {
    _stopPingTimer();
    _pingTimer = Timer.periodic(pingInterval, (timer) {
      if (_connectionState == RemoteConnectionState.connected) {
        _sendMsg({"type": "ping"});

        if (_lastPongReceived != null) {
          final elapsed = DateTime.now().difference(_lastPongReceived!);
          if (elapsed > pingTimeoutThreshold) {
            debugPrint("Ping timeout threshold exceeded (${elapsed.inSeconds}s). Forcing reconnect...");
            _handleDisconnectOrError();
          }
        }
      }
    });
  }

  void _stopPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _cancelReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  void _cleanupActiveChannel() {
    _streamSubscription?.cancel();
    _streamSubscription = null;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  void selectWindow(int handle) {
    _selectedWindowHandle = handle;
    _sendMsg({
      "type": "select_window",
      "target_device_id": _targetDeviceId,
      "handle": handle
    });
    notifyListeners();
  }

  void changeResolution(int width, int height) {
    _sendMsg({
      "type": "change_resolution",
      "target_device_id": _targetDeviceId,
      "width": width,
      "height": height
    });
  }

  void fitMobileResolution(double mobileWidth, double mobileHeight) {
    _sendMsg({
      "type": "fit_resolution",
      "target_device_id": _targetDeviceId,
      "mobile_width": mobileWidth.toInt(),
      "mobile_height": mobileHeight.toInt()
    });
  }

  void sendInputEvent(Map<String, dynamic> payload) {
    if (_isBackground) return;
    _sendMsg({
      "type": "input_event",
      "target_device_id": _targetDeviceId,
      "payload": payload
    });
  }

  void updateAppState(bool isBg) {
    _isBackground = isBg;
    _sendMsg({
      "type": "app_state",
      "target_device_id": _targetDeviceId,
      "state": isBg ? "background" : "foreground"
    });
    notifyListeners();
  }

  void _sendMsg(Map<String, dynamic> msg) {
    if (_channel != null && _connectionState == RemoteConnectionState.connected) {
      _channel?.sink.add(jsonEncode(msg));
    }
  }

  void disconnect() {
    _isManualDisconnect = true;
    _connectionState = RemoteConnectionState.disconnected;
    _activeTransport = ConnectionTransport.none;
    _activeUrl = null;
    _cancelReconnectTimer();
    _stopPingTimer();
    _cleanupActiveChannel();
    _latestFrameBytes = null;
    notifyListeners();
  }
}
