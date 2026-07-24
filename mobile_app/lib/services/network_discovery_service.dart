import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class DiscoveredHost {
  final String deviceId;
  final String deviceName;
  final String os;
  final Map<String, dynamic> resolution;
  final List<Map<String, dynamic>> windows;
  final List<String> localIps;
  final String remoteIp;
  final bool usbAvailable;
  final List<String> directWsUrls;
  final String status;
  final String discoverySource;

  DiscoveredHost({
    required this.deviceId,
    required this.deviceName,
    required this.os,
    required this.resolution,
    required this.windows,
    required this.localIps,
    required this.remoteIp,
    required this.usbAvailable,
    required this.directWsUrls,
    this.status = 'online',
    this.discoverySource = 'unknown',
  });

  factory DiscoveredHost.fromJson(Map<String, dynamic> json, {String source = 'server'}) {
    final localIpsList = List<String>.from(json['local_ips'] ?? []);
    final directWsList = List<String>.from(json['direct_ws_urls'] ?? []);
    final wsPort = json['ws_port'] ?? 8080;

    if (directWsList.isEmpty) {
      if (json['usb_available'] == true || source == 'usb') {
        directWsList.add('ws://127.0.0.1:$wsPort');
      }
      for (var ip in localIpsList) {
        final url = 'ws://$ip:$wsPort';
        if (!directWsList.contains(url)) {
          directWsList.add(url);
        }
      }
    }

    return DiscoveredHost(
      deviceId: json['device_id'] ?? 'unknown_device',
      deviceName: json['device_name'] ?? 'Remote PC Host',
      os: json['os'] ?? 'Windows',
      resolution: Map<String, dynamic>.from(json['resolution'] ?? {'width': 1920, 'height': 1080}),
      windows: List<Map<String, dynamic>>.from(json['windows'] ?? []),
      localIps: localIpsList,
      remoteIp: json['remote_ip'] ?? '',
      usbAvailable: json['usb_available'] ?? false,
      directWsUrls: directWsList,
      status: json['status'] ?? 'online',
      discoverySource: source,
    );
  }
}

class NetworkDiscoveryService {
  /// Probes USB ADB loopback endpoints (127.0.0.1:8080 and 10.0.2.2:8080) via HTTP health check.
  static Future<List<String>> probeUsbAdbEndpoints({int port = 8080}) async {
    final List<String> availableUrls = [];
    final candidates = [
      'http://127.0.0.1:$port/api/health',
      'http://10.0.2.2:$port/api/health',
    ];

    await Future.wait(candidates.map((url) async {
      try {
        final response = await http.get(Uri.parse(url)).timeout(const Duration(milliseconds: 600));
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          if (data['status'] == 'ok' && data['service'] == 'anyremote') {
            final wsUrl = url.startsWith('http://127.0.0.1')
                ? 'ws://127.0.0.1:$port'
                : 'ws://10.0.2.2:$port';
            if (!availableUrls.contains(wsUrl)) {
              availableUrls.add(wsUrl);
            }
          }
        }
      } catch (_) {
        // Not reachable or timed out
      }
    }));

    return availableUrls;
  }

  /// Fetches registered devices for a Google user from the central signaling server.
  static Future<List<DiscoveredHost>> fetchServerRegisteredDevices(
      String serverBaseUrl, String googleUserId) async {
    final List<DiscoveredHost> devices = [];
    try {
      final httpUrl = serverBaseUrl.replaceFirst('ws://', 'http://').replaceFirst('wss://', 'https://');
      final uri = Uri.parse('$httpUrl/api/devices/$googleUserId');
      final response = await http.get(uri).timeout(const Duration(seconds: 3));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && data['devices'] != null) {
          for (var dev in data['devices']) {
            devices.add(DiscoveredHost.fromJson(dev, source: 'server'));
          }
        }
      }
    } catch (e) {
      debugPrint('Error fetching server registered devices: $e');
    }
    return devices;
  }

  /// Performs UDP broadcast discovery on port 8888.
  static Future<List<DiscoveredHost>> discoverViaUdpBroadcast({
    int port = 8888,
    Duration timeout = const Duration(seconds: 2),
  }) async {
    RawDatagramSocket? socket;

    try {
      socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      socket.broadcastEnabled = true;

      final reqData = utf8.encode('ANYREMOTE_DISCOVER_REQ');
      socket.send(reqData, InternetAddress('255.255.255.255'), port);

      final completer = Completer<List<DiscoveredHost>>();
      final Map<String, DiscoveredHost> hostMap = {};

      final subscription = socket.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          final datagram = socket?.receive();
          if (datagram != null) {
            try {
              final message = utf8.decode(datagram.data);
              final data = jsonDecode(message);
              if (data['service'] == 'AnyRemote_PC_Host') {
                final host = DiscoveredHost.fromJson(data, source: 'udp');
                hostMap[host.deviceId] = host;
              }
            } catch (e) {
              debugPrint('Error parsing UDP datagram: $e');
            }
          }
        }
      });

      Timer(timeout, () {
        subscription.cancel();
        if (!completer.isCompleted) {
          completer.complete(hostMap.values.toList());
        }
      });

      return await completer.future;
    } catch (e) {
      debugPrint('UDP discovery error: $e');
      return [];
    } finally {
      socket?.close();
    }
  }

  /// Scans the local subnet for hosts with /api/health responding.
  static Future<List<String>> scanSubnetForHosts({
    String? subnetPrefix,
    int port = 8080,
    Duration timeout = const Duration(milliseconds: 500),
  }) async {
    final List<String> activeHosts = [];

    List<String> prefixesToScan = [];
    if (subnetPrefix != null) {
      prefixesToScan.add(subnetPrefix);
    } else {
      try {
        final interfaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
        for (var interface in interfaces) {
          for (var addr in interface.addresses) {
            if (!addr.isLoopback) {
              final parts = addr.address.split('.');
              if (parts.length == 4) {
                prefixesToScan.add('${parts[0]}.${parts[1]}.${parts[2]}');
              }
            }
          }
        }
      } catch (_) {}
    }

    if (prefixesToScan.isEmpty) {
      prefixesToScan = ['192.168.1', '192.168.0', '10.0.2'];
    }

    final List<Future<void>> tasks = [];

    for (var prefix in prefixesToScan) {
      for (int i = 1; i <= 254; i++) {
        final targetIp = '$prefix.$i';
        final url = 'http://$targetIp:$port/api/health';
        tasks.add(
          http.get(Uri.parse(url)).timeout(timeout).then((res) {
            if (res.statusCode == 200) {
              final data = jsonDecode(res.body);
              if (data['status'] == 'ok' && data['service'] == 'anyremote') {
                final wsUrl = 'ws://$targetIp:$port';
                if (!activeHosts.contains(wsUrl)) {
                  activeHosts.add(wsUrl);
                }
              }
            }
          }).catchError((_) {}),
        );
      }
    }

    await Future.wait(tasks);
    return activeHosts;
  }

  /// Combines all discovery methods to return prioritized candidate URLs for a given device or host.
  static Future<List<String>> getPrioritizedCandidateUrls({
    required String serverBaseUrl,
    required String googleUserId,
    String? targetDeviceId,
    List<String>? knownLocalIps,
    bool checkUsb = true,
  }) async {
    final List<String> candidateUrls = [];

    // 1. USB ADB / Emulator check
    if (checkUsb) {
      final usbUrls = await probeUsbAdbEndpoints();
      candidateUrls.addAll(usbUrls);
    }

    // 2. Local Wi-Fi IPs from server or param
    if (knownLocalIps != null && knownLocalIps.isNotEmpty) {
      for (var ip in knownLocalIps) {
        final url = 'ws://$ip:8080';
        if (!candidateUrls.contains(url)) {
          candidateUrls.add(url);
        }
      }
    }

    // 3. UDP Discovery
    final udpHosts = await discoverViaUdpBroadcast();
    for (var host in udpHosts) {
      if (targetDeviceId == null || host.deviceId == targetDeviceId) {
        for (var url in host.directWsUrls) {
          if (!candidateUrls.contains(url)) {
            candidateUrls.add(url);
          }
        }
      }
    }

    // 4. Server Registered Host Details
    final serverHosts = await fetchServerRegisteredDevices(serverBaseUrl, googleUserId);
    for (var host in serverHosts) {
      if (targetDeviceId == null || host.deviceId == targetDeviceId) {
        for (var url in host.directWsUrls) {
          if (!candidateUrls.contains(url)) {
            candidateUrls.add(url);
          }
        }
      }
    }

    // 5. Central Relay / Server Base URL
    if (!candidateUrls.contains(serverBaseUrl)) {
      candidateUrls.add(serverBaseUrl);
    }

    return candidateUrls;
  }
}
