import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/screens/login_screen.dart';
import 'package:animate_do/animate_do.dart';
import 'dart:math' as math;

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen>
    with SingleTickerProviderStateMixin {
  final _codeController = TextEditingController();
  final _urlController = TextEditingController(text: 'http://');
  bool _isLoading = false;
  String? _error;
  late AnimationController _bgAnimController;

  @override
  void initState() {
    super.initState();
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _codeController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _handleSetup() async {
    final code = _codeController.text.trim().toUpperCase();
    final url = _urlController.text.trim();

    if (code.isEmpty) {
      setState(() => _error = "Please enter your school activation code.");
      return;
    }
    final urlLower = url.toLowerCase();
    if (url.isEmpty || urlLower == 'http://' || urlLower == 'https://') {
      setState(() => _error = "Please enter a valid server address.");
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final success = await Provider.of<AuthProvider>(context, listen: false)
        .setupSchool(code, serverUrl: url);

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      } else {
        final urlLower = _urlController.text.trim().toLowerCase();
        final useLocalhost = urlLower.contains('localhost') || urlLower.contains('127.0.0.1');
        setState(() => _error = useLocalhost
            ? "Connection failed. On this device, \"localhost\" means the phone itself. Use your computer's IP (e.g. http://192.168.1.5:8000) from Settings on the website."
            : "Connection failed. Check: (1) Backend is running on the computer. (2) IP is correct — use \"Find server IP\" on the website. (3) Computer firewall allows port 8000. (4) School code is correct.");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // ── Animated Background ────────────────────────────────────
          _buildAnimatedBackground(),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                children: [
                  const SizedBox(height: 60),

                  // ── Header ─────────────────────────────────────────
                  FadeInDown(
                    duration: const Duration(milliseconds: 700),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF3b82f6), Color(0xFF6366f1)],
                            ),
                            borderRadius: BorderRadius.circular(22),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF3b82f6).withOpacity(0.4),
                                blurRadius: 24,
                                offset: const Offset(0, 8),
                              )
                            ],
                          ),
                          child: const Icon(Icons.school_rounded,
                              size: 38, color: Colors.white),
                        ),
                        const SizedBox(height: 28),
                        const Text(
                          "Welcome to\nSchool Biometric",
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 32,
                            color: Colors.white,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          "Connect your school to get started.",
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.55),
                              fontSize: 16),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 40),

                  // ── Card ───────────────────────────────────────────
                  FadeInUp(
                    duration: const Duration(milliseconds: 700),
                    delay: const Duration(milliseconds: 150),
                    child: Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: Colors.white.withOpacity(0.1)),
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
                          // Server URL field – same URL shown on website Settings
                          _buildLabel('Server Address (copy from website Settings)', Icons.cloud_outlined),
                          const SizedBox(height: 6),
                          Text(
                            'On the same Wi‑Fi, use your computer\'s IP (e.g. http://192.168.1.5:8000). Do not use localhost on the phone.',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _urlController,
                            hint: 'e.g. http://192.168.1.5:8000',
                            keyboard: TextInputType.url,
                            icon: Icons.dns_outlined,
                          ),

                          const SizedBox(height: 24),

                          // School Code field
                          _buildLabel('School Activation Code', Icons.vpn_key_rounded),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _codeController,
                            hint: 'e.g. GPA001',
                            keyboard: TextInputType.text,
                            icon: Icons.lock_outline_rounded,
                            uppercase: true,
                          ),

                          // Error
                          if (_error != null) ...[
                            const SizedBox(height: 16),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
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

                          const SizedBox(height: 32),

                          // Activate Button
                          _buildActivateButton(),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),

                  FadeInUp(
                    delay: const Duration(milliseconds: 300),
                    child: Text(
                      'Your data is encrypted and secure',
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.25), fontSize: 12),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedBackground() {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (_, __) {
        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF020617), Color(0xFF0d1b3e)],
            ),
          ),
          child: Stack(
            children: [
              // Orb 1
              Positioned(
                top: -60 + 30 * math.sin(_bgAnimController.value * 2 * math.pi),
                right: -60,
                child: Container(
                  height: 260,
                  width: 260,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [
                      const Color(0xFF3b82f6).withOpacity(0.18),
                      Colors.transparent,
                    ]),
                  ),
                ),
              ),
              // Orb 2
              Positioned(
                bottom: -40 + 20 * math.cos(_bgAnimController.value * 2 * math.pi),
                left: -80,
                child: Container(
                  height: 320,
                  width: 320,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [
                      const Color(0xFF6366f1).withOpacity(0.12),
                      Colors.transparent,
                    ]),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLabel(String label, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: const Color(0xFF3b82f6), size: 16),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 13,
                fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required TextInputType keyboard,
    required IconData icon,
    bool uppercase = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        autocorrect: false,
        textCapitalization:
            uppercase ? TextCapitalization.characters : TextCapitalization.none,
        style: const TextStyle(
            color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
              color: Colors.white.withOpacity(0.25), fontSize: 14),
          prefixIcon: Icon(icon, color: const Color(0xFF3b82f6), size: 20),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildActivateButton() {
    return GestureDetector(
      onTap: _isLoading ? null : _handleSetup,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: _isLoading
              ? LinearGradient(colors: [
                  const Color(0xFF3b82f6).withOpacity(0.5),
                  const Color(0xFF6366f1).withOpacity(0.5)
                ])
              : const LinearGradient(
                  colors: [Color(0xFF3b82f6), Color(0xFF6366f1)]),
          boxShadow: _isLoading
              ? []
              : [
                  BoxShadow(
                    color: const Color(0xFF3b82f6).withOpacity(0.4),
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
                      strokeWidth: 2.5, color: Colors.white))
              : const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.rocket_launch_rounded,
                        color: Colors.white, size: 20),
                    SizedBox(width: 10),
                    Text("Activate School",
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5)),
                  ],
                ),
        ),
      ),
    );
  }
}
