import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

class GoogleUserModel {
  final String id;
  final String email;
  final String displayName;
  final String photoUrl;
  final String idToken;

  GoogleUserModel({
    required this.id,
    required this.email,
    required this.displayName,
    required this.photoUrl,
    required this.idToken,
  });
}

class AuthService extends ChangeNotifier {
  GoogleUserModel? _currentUser;
  String? _lastError;

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  GoogleUserModel? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  String? get lastError => _lastError;

  AuthService();

  Future<bool> signInWithGoogle() async {
    _lastError = null;
    try {
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account != null) {
        final GoogleSignInAuthentication auth = await account.authentication;
        _currentUser = GoogleUserModel(
          id: account.id,
          email: account.email,
          displayName: account.displayName ?? account.email.split('@')[0],
          photoUrl: account.photoUrl ?? '',
          idToken: auth.idToken ?? '',
        );
        notifyListeners();
        return true;
      } else {
        _lastError = "Google Sign-In canceled by user.";
      }
    } catch (e) {
      _lastError = "Google Sign-In Exception: $e";
      debugPrint('Google Sign In Error: $e');
    }
    _currentUser = null;
    notifyListeners();
    return false;
  }

  void signInAsGuest() {
    _lastError = null;
    _currentUser = GoogleUserModel(
      id: "google_user_12345",
      email: "demo.user@gmail.com",
      displayName: "Guest User",
      photoUrl: "",
      idToken: "demo_token",
    );
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      debugPrint('Sign out error: $e');
    }
    _currentUser = null;
    notifyListeners();
  }
}
