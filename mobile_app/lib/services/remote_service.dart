import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class RemoteService extends ChangeNotifier {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  Uint8List? _latestFrameBytes;
  List<Map<String, dynamic>> _openWindows = [];
  Map<String, dynamic>? _currentResolution;
  List<Map<String, dynamic>> _supportedResolutions = [];
  int _selectedWindowHandle = 0;
  bool _isBackground = false;
  String? _targetDeviceId;
  String? _googleUserId;

  bool get isConnected => _isConnected;
  Uint8List? get latestFrameBytes => _latestFrameBytes;
  List<Map<String, dynamic>> get openWindows => _openWindows;
  Map<String, dynamic>? get currentResolution => _currentResolution;
  List<Map<String, dynamic>> get supportedResolutions => _supportedResolutions;
  int get selectedWindowHandle => _selectedWindowHandle;
  bool get isBackground => _isBackground;

  void connect(String serverUrl, String googleUserId, String targetDeviceId) {
    _targetDeviceId = targetDeviceId;
    _googleUserId = googleUserId;
    _tryConnect(serverUrl, googleUserId, targetDeviceId);
  }

  void _tryConnect(String serverUrl, String googleUserId, String targetDeviceId, {bool isFallback = false}) {
    try {
      final uri = Uri.parse(serverUrl);
      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;
      notifyListeners();

      final regMsg = jsonEncode({
        "type": "register_client",
        "google_user_id": googleUserId,
        "target_device_id": targetDeviceId
      });
      _channel?.sink.add(regMsg);

      _channel?.stream.listen(
        (data) => _handleServerMessage(data),
        onError: (err) {
          debugPrint("WS Error on $serverUrl: $err");
          _isConnected = false;
          notifyListeners();
          if (!isFallback && serverUrl.contains("localhost")) {
            debugPrint("Retrying connection with fallback ws://10.0.2.2:8080...");
            _tryConnect("ws://10.0.2.2:8080", googleUserId, targetDeviceId, isFallback: true);
          }
        },
        onDone: () {
          debugPrint("WS Connection closed on $serverUrl");
          _isConnected = false;
          notifyListeners();
        },
      );
    } catch (e) {
      debugPrint("WS Connect Exception: $e");
      _isConnected = false;
      notifyListeners();
    }
  }

  void _handleServerMessage(dynamic rawMsg) {
    try {
      final data = jsonDecode(rawMsg.toString());
      final msgType = data["type"];

      if (msgType == "screen_frame") {
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
    if (_channel != null && _isConnected) {
      _channel?.sink.add(jsonEncode(msg));
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _isConnected = false;
    _latestFrameBytes = null;
    notifyListeners();
  }
}
