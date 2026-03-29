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
import 'package:school_biometric_mobile/screens/setup_screen.dart';

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

    if (!auth.isSetup) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const SetupScreen()),
      );
    } else if (auth.isAuthenticated) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const DashboardScreen()),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3b82f6), Color(0xFF6366f1)],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF3b82f6).withOpacity(0.4),
                    blurRadius: 30,
                    spreadRadius: 4,
                  )
                ],
              ),
              child: const Icon(Icons.school_rounded,
                  color: Colors.white, size: 48),
            ),
            const SizedBox(height: 28),
            const CircularProgressIndicator(
              color: Color(0xFF3b82f6),
              strokeWidth: 2,
            ),
          ],
        ),
      ),
    );
  }
}
