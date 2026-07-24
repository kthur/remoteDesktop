import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/services/network_discovery_service.dart';
import 'package:mobile_app/services/remote_service.dart';

void main() {
  group('Milestone 1 Network Discovery & Remote Service Tests', () {
    test('DiscoveredHost.fromJson correctly parses device payload and generates directWsUrls', () {
      final jsonPayload = {
        'device_id': 'pc_win_123',
        'device_name': 'My Workstation',
        'os': 'Windows 11',
        'resolution': {'width': 1920, 'height': 1080},
        'windows': [],
        'local_ips': ['192.168.1.100'],
        'remote_ip': '127.0.0.1',
        'usb_available': true,
        'direct_ws_urls': ['ws://127.0.0.1:8080', 'ws://192.168.1.100:8080'],
        'status': 'online',
      };

      final host = DiscoveredHost.fromJson(jsonPayload, source: 'server');
      expect(host.deviceId, equals('pc_win_123'));
      expect(host.usbAvailable, isTrue);
      expect(host.localIps, contains('192.168.1.100'));
      expect(host.directWsUrls, contains('ws://127.0.0.1:8080'));
      expect(host.directWsUrls, contains('ws://192.168.1.100:8080'));
    });

    test('RemoteService classifyTransport categorizes URLs by priority transport types', () {
      final service = RemoteService();

      expect(service.classifyTransport('ws://127.0.0.1:8080'), equals(ConnectionTransport.usbAdb));
      expect(service.classifyTransport('ws://localhost:8080'), equals(ConnectionTransport.usbAdb));
      expect(service.classifyTransport('ws://10.0.2.2:8080'), equals(ConnectionTransport.emulator));
      expect(service.classifyTransport('ws://192.168.1.150:8080'), equals(ConnectionTransport.localWifi));
      expect(service.classifyTransport('ws://10.1.2.3:8080'), equals(ConnectionTransport.localWifi));
      expect(service.classifyTransport('ws://signaling.anyremote.io:8080'), equals(ConnectionTransport.relay));
    });

    test('RemoteService initial state is disconnected with ConnectionTransport.none', () {
      final service = RemoteService();
      expect(service.connectionState, equals(RemoteConnectionState.disconnected));
      expect(service.activeTransport, equals(ConnectionTransport.none));
      expect(service.activeTransportBadge, equals('⚪ Disconnected'));
      expect(service.isConnected, isFalse);
    });
  });
}
