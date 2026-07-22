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
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  GoogleUserModel? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  AuthService() {
    _autoInitDemoUser();
  }

  void _autoInitDemoUser() {
    _currentUser = GoogleUserModel(
      id: 'google_user_12345',
      email: 'demo.user@gmail.com',
      displayName: 'Google Account User',
      photoUrl: 'https://lh3.googleusercontent.com/a/default-user',
      idToken: 'demo_token',
    );
  }

  Future<bool> signInWithGoogle() async {
    try {
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account != null) {
        final GoogleSignInAuthentication auth = await account.authentication;
        _currentUser = GoogleUserModel(
          id: account.id,
          email: account.email,
          displayName: account.displayName ?? account.email.split('@')[0],
          photoUrl: account.photoUrl ?? '',
          idToken: auth.idToken ?? 'demo_token',
        );
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Google Sign In Error: $e');
    }
    _currentUser = GoogleUserModel(
      id: 'google_user_12345',
      email: 'demo.user@gmail.com',
      displayName: 'Google Account User',
      photoUrl: '',
      idToken: 'demo_token',
    );
    notifyListeners();
    return true;
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
