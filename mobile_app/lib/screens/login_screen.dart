import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:animate_do/animate_do.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/screens/dashboard_screen.dart';
import 'dart:math' as math;

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = "Please enter your phone number.");
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final success =
        await Provider.of<AuthProvider>(context, listen: false).login(phone);

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      } else {
        setState(() =>
            _error = "Login failed. Check your phone number and try again.");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final schoolName = auth.schoolConfig?['school_name'] ?? "Your School";
    final primaryHex =
        auth.schoolConfig?['primary_color'] as String? ?? '#3b82f6';
    final logoUrl = auth.schoolConfig?['logo_url'];

    return Scaffold(
      body: Stack(
        children: [
          // Background
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF020617), Color(0xFF0d1b3e)],
              ),
            ),
          ),

          // Decorative arc top
          Positioned(
            top: -100,
            left: -80,
            child: AnimatedBuilder(
              animation: _pulseController,
              builder: (_, __) => Container(
                height: 400,
                width: 400,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    const Color(0xFF3b82f6)
                        .withOpacity(0.12 + 0.05 * _pulseController.value),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding:
                  const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24),
              child: Column(
                children: [
                  const SizedBox(height: 40),

                  // ── School Logo / Icon ─────────────────────────────
                  FadeInDown(
                    duration: const Duration(milliseconds: 600),
                    child: Column(
                      children: [
                        Container(
                          height: 110,
                          width: 110,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF1e293b), Color(0xFF0f1f3d)],
                            ),
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: const Color(0xFF3b82f6).withOpacity(0.4),
                                width: 2),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    const Color(0xFF3b82f6).withOpacity(0.25),
                                blurRadius: 30,
                                spreadRadius: 4,
                              )
                            ],
                          ),
                          child: logoUrl != null
                              ? ClipOval(
                                  child: Image.network(
                                    logoUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (c, e, s) => const Icon(
                                        Icons.school_rounded,
                                        size: 50,
                                        color: Color(0xFF3b82f6)),
                                  ),
                                )
                              : const Icon(Icons.school_rounded,
                                  size: 50, color: Color(0xFF3b82f6)),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          "Welcome Back",
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 14,
                              letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          schoolName,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 50),

                  // ── Login Card ─────────────────────────────────────
                  FadeInUp(
                    duration: const Duration(milliseconds: 600),
                    delay: const Duration(milliseconds: 150),
                    child: Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(
                            color: Colors.white.withOpacity(0.1)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 40,
                            offset: const Offset(0, 20),
                          )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3b82f6).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.person_rounded,
                                    color: Color(0xFF3b82f6), size: 22),
                              ),
                              const SizedBox(width: 14),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text("Teacher Login",
                                      style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white)),
                                  Text("Sign in with your phone",
                                      style: TextStyle(
                                          color:
                                              Colors.white.withOpacity(0.45),
                                          fontSize: 12)),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 28),

                          // Phone field
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                  color: Colors.white.withOpacity(0.1)),
                            ),
                            child: TextField(
                              controller: _phoneController,
                              keyboardType: TextInputType.phone,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15),
                              decoration: InputDecoration(
                                hintText: '+254 7XX XXX XXX',
                                hintStyle: TextStyle(
                                    color: Colors.white.withOpacity(0.25),
                                    fontSize: 14),
                                prefixIcon: const Icon(Icons.phone_rounded,
                                    color: Color(0xFF3b82f6), size: 20),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 16),
                              ),
                              onSubmitted: (_) => _handleLogin(),
                            ),
                          ),

                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.redAccent.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: Colors.redAccent.withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline,
                                      color: Colors.redAccent, size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(_error!,
                                        style: const TextStyle(
                                            color: Colors.redAccent,
                                            fontSize: 13)),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 28),

                          // Sign In button
                          GestureDetector(
                            onTap: _isLoading ? null : _handleLogin,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 18),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                gradient: _isLoading
                                    ? LinearGradient(colors: [
                                        const Color(0xFF3b82f6)
                                            .withOpacity(0.5),
                                        const Color(0xFF6366f1)
                                            .withOpacity(0.5),
                                      ])
                                    : const LinearGradient(colors: [
                                        Color(0xFF3b82f6),
                                        Color(0xFF6366f1),
                                      ]),
                                boxShadow: _isLoading
                                    ? []
                                    : [
                                        BoxShadow(
                                          color: const Color(0xFF3b82f6)
                                              .withOpacity(0.4),
                                          blurRadius: 20,
                                          offset: const Offset(0, 8),
                                        )
                                      ],
                              ),
                              child: Center(
                                child: _isLoading
                                    ? const SizedBox(
                                        height: 22,
                                        width: 22,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Colors.white))
                                    : const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.login_rounded,
                                              color: Colors.white, size: 20),
                                          SizedBox(width: 10),
                                          Text("Sign In",
                                              style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white)),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  FadeInUp(
                    delay: const Duration(milliseconds: 300),
                    child: TextButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.swap_horiz,
                          color: Colors.white30, size: 18),
                      label: Text(
                        "Switch School",
                        style: TextStyle(
                            color: Colors.white.withOpacity(0.35),
                            fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
