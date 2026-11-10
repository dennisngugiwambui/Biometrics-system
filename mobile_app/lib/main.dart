import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/core/location_service.dart';
import 'package:school_biometric_mobile/core/api_service.dart';
import 'package:school_biometric_mobile/core/notification_service.dart';
import 'package:school_biometric_mobile/screens/login_screen.dart';
import 'package:school_biometric_mobile/screens/dashboard_screen.dart';
import 'package:school_biometric_mobile/widgets/school_illustration.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialise services
  await ApiService.init();
  await NotificationService.instance.init();

  // Lock to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Premium status bar style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LocationService()),
      ],
      child: const SchoolBiometricApp(),
    ),
  );
}

class SchoolBiometricApp extends StatelessWidget {
  const SchoolBiometricApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'School Biometric',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF3b82f6),
          brightness: Brightness.dark,
          primary: const Color(0xFF3b82f6),
          secondary: const Color(0xFF6366f1),
          surface: const Color(0xFF0f172a),
        ),
        textTheme: GoogleFonts.outfitTextTheme(
          ThemeData.dark().textTheme,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1e293b).withOpacity(0.8),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
        ),
        snackBarTheme: const SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  void initState() {
    super.initState();
    _checkInitialState();
  }

  Future<void> _checkInitialState() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.init();

    if (!mounted) return;

    // The app always opens on sign-in unless a session is already saved. The
    // login screen also connects a fresh device to its school.
    final Widget next = auth.isSetup && auth.isAuthenticated
        ? const DashboardScreen()
        : const LoginScreen();
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 400),
        pageBuilder: (_, __, ___) => next,
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: a, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Launch splash, in the sign-in colours so the hand-off to login is seamless.
    return const Scaffold(
      backgroundColor: AuthColors.g50,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 72,
              height: 72,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AuthColors.g600,
                  borderRadius: BorderRadius.all(Radius.circular(22)),
                  boxShadow: [
                    BoxShadow(color: Color(0x6616A34A), blurRadius: 24, offset: Offset(0, 10)),
                  ],
                ),
                child: Icon(Icons.fingerprint_rounded, color: Colors.white, size: 40),
              ),
            ),
            SizedBox(height: 28),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(color: AuthColors.g600, strokeWidth: 2.4),
            ),
          ],
        ),
      ),
    );
  }
}
