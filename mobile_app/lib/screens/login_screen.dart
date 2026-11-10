import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:animate_do/animate_do.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/screens/dashboard_screen.dart';
import 'package:school_biometric_mobile/widgets/school_illustration.dart';

/// The first screen of the app (after the CSMS / Shulepoa sign-in).
///
///  • Phones: a soft, animated school illustration at the top and the form in a
///    white sheet that slides up beneath it.
///  • Tablets / landscape: the illustration on one side, the form on the other.
///
/// The school code and server address live on this screen too, so a fresh
/// install opens straight onto sign-in: the first sign-in connects the device
/// to the school, and later ones only need the phone number.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _codeController = TextEditingController();
  final _phoneController = TextEditingController();
  final _urlController = TextEditingController();
  final _phoneFocus = FocusNode();

  bool _isLoading = false;
  bool _showServer = false;
  String? _error;
  int _errorTick = 0;

  late final AnimationController _ambient = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _codeController.text = auth.schoolCode ?? '';
    _urlController.text = auth.savedServerUrl ?? 'http://';
    // A device that has never been connected needs the server address.
    _showServer = !auth.isSetup;
  }

  @override
  void dispose() {
    _ambient.dispose();
    _codeController.dispose();
    _phoneController.dispose();
    _urlController.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  void _fail(String message) {
    setState(() {
      _isLoading = false;
      _error = message;
      _errorTick++;
    });
    HapticFeedback.mediumImpact();
  }

  Future<void> _handleLogin() async {
    FocusScope.of(context).unfocus();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final code = _codeController.text.trim().toUpperCase();
    final phone = _phoneController.text.trim();
    final url = _urlController.text.trim().replaceAll(RegExp(r'/+$'), '');
    final urlLower = url.toLowerCase();

    if (code.isEmpty) return _fail('Enter your school code.');
    if (phone.isEmpty) return _fail('Enter your phone number.');

    final serverChanged =
        url.isNotEmpty && urlLower != 'http:' && urlLower != 'https:' && url != auth.savedServerUrl;
    final needsConnect = !auth.isSetup || code != auth.schoolCode || serverChanged;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    if (needsConnect) {
      if (url.isEmpty || urlLower == 'http:' || urlLower == 'https:') {
        setState(() => _showServer = true);
        return _fail('Enter the server address to connect this device.');
      }
      final connected = await auth.setupSchool(code, serverUrl: url);
      if (!mounted) return;
      if (!connected) {
        setState(() => _showServer = true);
        final localhost = urlLower.contains('localhost') || urlLower.contains('127.0.0.1');
        return _fail(localhost
            ? 'Could not connect. On a phone, "localhost" is the phone itself — use your computer\'s IP, e.g. http://192.168.1.5:8000.'
            : 'Could not connect. Check the school code and server address, and that the server is running.');
      }
    }

    final ok = await auth.login(phone);
    if (!mounted) return;
    if (!ok) return _fail('Sign-in failed. Check your phone number and try again.');

    HapticFeedback.lightImpact();
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 450),
        pageBuilder: (_, __, ___) => const DashboardScreen(),
        transitionsBuilder: (_, a, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
          child: child,
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final schoolName = auth.isSetup
        ? (auth.schoolConfig?['school_name'] as String? ?? 'School Biometric')
        : 'School Biometric';
    final String? logoUrl = auth.isSetup ? (auth.schoolConfig?['logo_url'] as String?) : null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AuthColors.g50,
        body: LayoutBuilder(builder: (context, c) {
          final wide = c.maxWidth >= 720;
          return wide
              ? _wideLayout(schoolName, logoUrl)
              : _phoneLayout(schoolName, logoUrl, c);
        }),
      ),
    );
  }

  // Phones: hero on top, the form in a sheet that slides up.
  Widget _phoneLayout(String schoolName, String? logoUrl, BoxConstraints c) {
    final top = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        ..._blobs(),
        CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(top: top + 16, left: 24, right: 24),
                child: Column(
                  children: [
                    FadeInDown(
                      duration: const Duration(milliseconds: 600),
                      child: _brandMark(schoolName, logoUrl),
                    ),
                    const SizedBox(height: 8),
                    ZoomIn(
                      duration: const Duration(milliseconds: 800),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: 340,
                          maxHeight: math.max(160, c.maxHeight * .30),
                        ),
                        child: _floating(const SchoolIllustration()),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: FadeInUp(
                duration: const Duration(milliseconds: 700),
                delay: const Duration(milliseconds: 150),
                from: 60,
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                    boxShadow: [
                      BoxShadow(color: Color(0x1F0F172A), blurRadius: 40, offset: Offset(0, -12)),
                    ],
                  ),
                  padding: EdgeInsets.fromLTRB(
                      24, 12, 24, 20 + MediaQuery.paddingOf(context).bottom),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 5,
                          decoration: BoxDecoration(
                            color: AuthColors.slate300,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      _form(),
                      const Spacer(),
                      const SizedBox(height: 16),
                      _footer(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // Tablets / landscape: the picture on one side, the form on the other.
  Widget _wideLayout(String schoolName, String? logoUrl) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: const [
                  BoxShadow(color: Color(0x380F172A), blurRadius: 60, offset: Offset(0, 28), spreadRadius: -20),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    flex: 54,
                    child: Container(
                      color: const Color(0xFFF5F8F6),
                      child: Stack(
                        children: [
                          ..._blobs(),
                          Padding(
                            padding: const EdgeInsets.all(36),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _brandMark(schoolName, logoUrl),
                                Expanded(child: Center(child: _floating(const SchoolIllustration()))),
                                const Text('Every check-in, captured in real time.',
                                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AuthColors.slate900)),
                                const SizedBox(height: 8),
                                const Text(
                                  'Mark your attendance from school grounds and see your history at a glance.',
                                  style: TextStyle(fontSize: 14, height: 1.5, color: AuthColors.slate500),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    flex: 46,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 44, vertical: 40),
                      child: FadeInRight(
                        duration: const Duration(milliseconds: 600),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [_form(), const SizedBox(height: 28), _footer()],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── pieces ──────────────────────────────────────────────────────────────

  Widget _floating(Widget child) => AnimatedBuilder(
        animation: _ambient,
        builder: (_, w) => Transform.translate(
          offset: Offset(0, -6 * math.sin(_ambient.value * 2 * math.pi)),
          child: w,
        ),
        child: child,
      );

  List<Widget> _blobs() => [
        AnimatedBuilder(
          animation: _ambient,
          builder: (_, __) {
            final s = math.sin(_ambient.value * 2 * math.pi);
            return Stack(children: [
              Positioned(
                top: -90 + 10 * s,
                left: -70 + 12 * s,
                child: _blob(260, AuthColors.g100.withOpacity(.85)),
              ),
              Positioned(
                top: 140 - 8 * s,
                right: -90 - 10 * s,
                child: _blob(220, AuthColors.g100.withOpacity(.7)),
              ),
              Positioned(
                top: 120,
                right: 36,
                child: Opacity(
                  opacity: .35 + .45 * (0.5 + 0.5 * s),
                  child: _blob(10, AuthColors.g300),
                ),
              ),
            ]);
          },
        ),
      ];

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );

  Widget _brandMark(String schoolName, String? logoUrl) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AuthColors.g600,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(color: AuthColors.g600.withOpacity(.45), blurRadius: 14, offset: const Offset(0, 6)),
              ],
            ),
            child: logoUrl != null
                ? Image.network(logoUrl, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 22))
                : const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              schoolName,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: -.3,
                color: AuthColors.slate900,
              ),
            ),
          ),
        ],
      );

  Widget _form() {
    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Welcome back 👋',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -.5, color: AuthColors.slate900)),
          const SizedBox(height: 6),
          const Text('Sign in to mark attendance and view your records.',
              style: TextStyle(fontSize: 14, color: AuthColors.slate500)),
          const SizedBox(height: 22),

          if (_error != null) ...[
            ShakeX(
              key: ValueKey(_errorTick),
              from: 8,
              duration: const Duration(milliseconds: 450),
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(14),
                  border: const Border(
                    left: BorderSide(color: Color(0xFFF43F5E), width: 3),
                    top: BorderSide(color: Color(0xFFFECDD3)),
                    right: BorderSide(color: Color(0xFFFECDD3)),
                    bottom: BorderSide(color: Color(0xFFFECDD3)),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Color(0xFFF43F5E), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(_error!,
                          style: const TextStyle(color: Color(0xFFBE123C), fontSize: 13, height: 1.35)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
          ],

          _label('School code'),
          _field(
            controller: _codeController,
            hint: 'e.g. OLK123',
            icon: Icons.school_rounded,
            caps: TextCapitalization.characters,
            action: TextInputAction.next,
            onSubmitted: (_) => _phoneFocus.requestFocus(),
          ),
          const SizedBox(height: 16),
          _label('Phone number'),
          _field(
            controller: _phoneController,
            focusNode: _phoneFocus,
            hint: '07XX XXX XXX',
            icon: Icons.phone_iphone_rounded,
            keyboard: TextInputType.phone,
            autofill: const [AutofillHints.telephoneNumber],
            action: TextInputAction.done,
            onSubmitted: (_) => _handleLogin(),
          ),

          // Connection settings
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => setState(() => _showServer = !_showServer),
              style: TextButton.styleFrom(
                foregroundColor: AuthColors.g700,
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              icon: AnimatedRotation(
                turns: _showServer ? .5 : 0,
                duration: const Duration(milliseconds: 250),
                child: const Icon(Icons.expand_more_rounded, size: 18),
              ),
              label: const Text('Server settings'),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: _showServer
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _label('Server address'),
                        _field(
                          controller: _urlController,
                          hint: 'http://192.168.1.5:8000',
                          icon: Icons.dns_rounded,
                          keyboard: TextInputType.url,
                          action: TextInputAction.done,
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Find it on the website under Settings → "Find server IP".',
                          style: TextStyle(fontSize: 11.5, color: AuthColors.slate500),
                        ),
                      ],
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
          const SizedBox(height: 14),
          _signInButton(),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 7),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1,
            color: Color(0xFF475569),
          ),
        ),
      );

  Widget _field({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    FocusNode? focusNode,
    TextInputType? keyboard,
    TextCapitalization caps = TextCapitalization.none,
    TextInputAction? action,
    Iterable<String>? autofill,
    ValueChanged<String>? onSubmitted,
  }) {
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c, width: w),
        );
    return TextField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboard,
      textCapitalization: caps,
      textInputAction: action,
      autofillHints: autofill,
      enabled: !_isLoading,
      onSubmitted: onSubmitted,
      onChanged: (_) {
        if (_error != null) setState(() => _error = null);
      },
      cursorColor: AuthColors.g600,
      style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: AuthColors.slate900),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w400),
        prefixIcon: Icon(icon, size: 20, color: const Color(0xFF94A3B8)),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: border(const Color(0xFFE2E8F0)),
        disabledBorder: border(const Color(0xFFE2E8F0)),
        focusedBorder: border(AuthColors.g600, 1.8),
      ),
    );
  }

  Widget _signInButton() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: _isLoading
              ? [AuthColors.g600.withOpacity(.6), AuthColors.g700.withOpacity(.6)]
              : const [AuthColors.g500, AuthColors.g700],
        ),
        boxShadow: _isLoading
            ? const []
            : [BoxShadow(color: AuthColors.g600.withOpacity(.45), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: _isLoading ? null : _handleLogin,
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _isLoading
                  ? const Row(
                      key: ValueKey('busy'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                        ),
                        SizedBox(width: 12),
                        Text('Signing in…',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                      ],
                    )
                  : const Row(
                      key: ValueKey('idle'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Sign in',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _footer() => Column(
        children: [
          const Divider(color: Color(0xFFF1F5F9), height: 1),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                '© ${DateTime.now().year} School Biometric · Secure',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ],
      );
}
