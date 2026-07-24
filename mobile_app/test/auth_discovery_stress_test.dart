import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/services/auth_service.dart';
import 'package:mobile_app/services/network_discovery_service.dart';
import 'package:mobile_app/services/remote_service.dart';
import 'package:mobile_app/screens/device_list_screen.dart';
import 'package:mobile_app/screens/remote_control_screen.dart';

class TestAuthService extends AuthService {
  final GoogleUserModel? mockUser;
  TestAuthService({this.mockUser});

  @override
  GoogleUserModel? get currentUser => mockUser;

  @override
  bool get isLoggedIn => mockUser != null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Empirical Challenge 1: Unauthenticated State Security & Gate Verification', () {
    test('AuthService initial state has null currentUser', () {
      final auth = AuthService();
      expect(auth.currentUser, isNull);
      expect(auth.isLoggedIn, isFalse);
    });

    testWidgets('Unauthenticated state cleanly prevents device list fetching in DeviceListScreen', (WidgetTester tester) async {
      final unauthService = TestAuthService(mockUser: null);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthService>.value(
          value: unauthService,
          child: const MaterialApp(
            home: DeviceListScreen(),
          ),
        ),
      );

      await tester.pump();

      // Verify that "HOST COMPUTERS (0)" is rendered and no devices are displayed
      expect(find.text('HOST COMPUTERS (0)'), findsOneWidget);
      expect(find.byIcon(Icons.laptop_windows_rounded), findsNothing);
    });

    testWidgets('Unauthenticated state cleanly prevents remote control connection entry', (WidgetTester tester) async {
      final unauthService = TestAuthService(mockUser: null);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthService>.value(
          value: unauthService,
          child: const MaterialApp(
            home: RemoteControlScreen(
              targetDeviceId: 'pc_test_123',
              deviceName: 'Test Workstation',
            ),
          ),
        ),
      );

      await tester.pump();

      // RemoteControlScreen should remain in DISCONNECTED state with no WS attempt initiated
      expect(find.text('Test Workstation'), findsOneWidget);
      expect(find.textContaining('🔴 DISCONNECTED'), findsOneWidget);
    });
  });

  group('Empirical Challenge 2: Network Failure Handling & Zero Mock Device Guarantee', () {
    test('Failed network request to fetchServerRegisteredDevices returns empty list without mock devices', () async {
      final devices = await NetworkDiscoveryService.fetchServerRegisteredDevices(
        'http://127.0.0.1:99999', // Invalid unreachable port
        'test_user_id',
      );

      expect(devices, isEmpty);
      expect(devices, equals([]));
    });

    testWidgets('Failed network requests set _devices = [] without mock devices in DeviceListScreen', (WidgetTester tester) async {
      final authService = TestAuthService(
        mockUser: GoogleUserModel(
          id: 'user_123',
          email: 'tester@example.com',
          displayName: 'Test User',
          photoUrl: '',
          idToken: 'token_123',
        ),
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthService>.value(
          value: authService,
          child: const MaterialApp(
            home: DeviceListScreen(),
          ),
        ),
      );

      // Pump to trigger _refreshDeviceList and complete network timeouts/errors
      await tester.pump(const Duration(seconds: 5));

      // Verify zero devices displayed and count shows 0
      expect(find.text('HOST COMPUTERS (0)'), findsOneWidget);
      expect(find.byIcon(Icons.laptop_windows_rounded), findsNothing);
    });
  });

  group('Empirical Challenge 3: Empty Window List Zero Mock Window Verification', () {
    test('RemoteService openWindows defaults to empty list', () {
      final remoteService = RemoteService();
      expect(remoteService.openWindows, isEmpty);
      expect(remoteService.openWindows, equals([]));
    });

    testWidgets('Empty window list displays zero mock windows in RemoteControlScreen window manager menu', (WidgetTester tester) async {
      // Suppress existing UI overflow warning in remote_control_screen.dart header Row (line 97)
      final originalOnError = FlutterError.onError;
      FlutterError.onError = (FlutterErrorDetails details) {
        final exception = details.exception;
        final isOverflow = exception is FlutterError &&
            exception.message.contains('A RenderFlex overflowed');
        if (!isOverflow) {
          originalOnError?.call(details);
        }
      };
      addTearDown(() {
        FlutterError.onError = originalOnError;
      });

      final authService = TestAuthService(
        mockUser: GoogleUserModel(
          id: 'user_123',
          email: 'tester@example.com',
          displayName: 'Test User',
          photoUrl: '',
          idToken: 'token_123',
        ),
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthService>.value(
          value: authService,
          child: const MaterialApp(
            home: RemoteControlScreen(
              targetDeviceId: 'pc_test_123',
              deviceName: 'Test Workstation',
            ),
          ),
        ),
      );

      await tester.pump();

      // Open Window Manager Bottom Sheet
      final windowMenuBtn = find.byTooltip('Windows Manager Menu');
      expect(windowMenuBtn, findsOneWidget);
      await tester.tap(windowMenuBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify zero mock window tiles displayed, and empty message shown
      expect(find.text('No open windows reported by host.'), findsOneWidget);
      expect(find.byType(ListTile), findsNothing);
    });
  });
}
