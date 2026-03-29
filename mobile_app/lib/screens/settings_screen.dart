import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:animate_do/animate_do.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/screens/setup_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _voiceEnabled = true;
  bool _soundEnabled = true;
  String _serverUrl = '';
  String _schoolCode = '';
  String? _localIp;
  final NetworkInfo _networkInfo = NetworkInfo();

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _getNetworkInfo();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _voiceEnabled = prefs.getBool('voice_enabled') ?? true;
        _soundEnabled = prefs.getBool('sound_enabled') ?? true;
        _serverUrl = prefs.getString('server_url') ?? 'Not set';
        _schoolCode = prefs.getString('school_code') ?? 'Not set';
      });
    }
  }

  Future<void> _getNetworkInfo() async {
    try {
      final ip = await _networkInfo.getWifiIP();
      if (mounted) setState(() => _localIp = ip);
    } catch (e) {
      debugPrint("Could not get IP: $e");
    }
  }

  Future<void> _setVoice(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('voice_enabled', val);
    setState(() => _voiceEnabled = val);
  }

  Future<void> _setSound(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('sound_enabled', val);
    setState(() => _soundEnabled = val);
  }

  Future<void> _switchSchool() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0f172a),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        title: const Text('Switch School?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(
          'This will disconnect you from the current school and clear all settings.',
          style: TextStyle(color: Colors.white.withOpacity(0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: Colors.white.withOpacity(0.5))),
          ),
          Container(
            margin: const EdgeInsets.only(right: 8, bottom: 8),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reset App', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await Provider.of<AuthProvider>(context, listen: false).resetSetup();
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const SetupScreen()),
        (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final teacherName = auth.teacherData?['first_name'] ?? 'Teacher';
    final schoolName = auth.teacherData?['school_name'] ?? 'School System';

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildSliverHeader(teacherName, schoolName),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 60),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                FadeInDown(
                  duration: const Duration(milliseconds: 400),
                  child: _sectionTitle('Notifications', Icons.notifications_active_outlined, Colors.blueAccent),
                ),
                const SizedBox(height: 12),
                FadeInDown(
                  duration: const Duration(milliseconds: 400),
                  delay: const Duration(milliseconds: 100),
                  child: _settingsGroup([
                    _toggleTile(
                      icon: Icons.record_voice_over_outlined,
                      color: Colors.blueAccent,
                      title: 'Voice Greetings',
                      subtitle: 'Speak your name on attendance scan',
                      value: _voiceEnabled,
                      onChanged: _setVoice,
                    ),
                    _divider(),
                    _toggleTile(
                      icon: Icons.volume_up_outlined,
                      color: Colors.indigoAccent,
                      title: 'Sound Effects',
                      subtitle: 'Play confirmation chimes',
                      value: _soundEnabled,
                      onChanged: _setSound,
                    ),
                  ]),
                ),

                const SizedBox(height: 32),
                FadeInDown(
                  duration: const Duration(milliseconds: 400),
                  delay: const Duration(milliseconds: 200),
                  child: _sectionTitle('Network & Connection', Icons.lan_outlined, Colors.green),
                ),
                const SizedBox(height: 12),
                FadeInDown(
                  duration: const Duration(milliseconds: 400),
                  delay: const Duration(milliseconds: 300),
                  child: _settingsGroup([
                    _infoTile(
                      icon: Icons.wifi_tethering_outlined,
                      color: Colors.green,
                      title: 'My Device IP',
                      value: _localIp ?? 'Searching...',
                    ),
                    _divider(),
                    _infoTile(
                      icon: Icons.dns_outlined,
                      color: Colors.cyanAccent,
                      title: 'Server URL',
                      value: _serverUrl,
                      onCopy: () {
                        Clipboard.setData(ClipboardData(text: _serverUrl));
                        _showSnippet('URL copied to clipboard');
                      },
                    ),
                    _divider(),
                    _infoTile(
                      icon: Icons.fingerprint_outlined,
                      color: Colors.blueGrey,
                      title: 'School Identifier',
                      value: _schoolCode,
                    ),
                  ]),
                ),

                const SizedBox(height: 32),
                FadeInUp(
                  duration: const Duration(milliseconds: 400),
                  delay: const Duration(milliseconds: 400),
                  child: _sectionTitle('Account & Privacy', Icons.security_outlined, Colors.orangeAccent),
                ),
                const SizedBox(height: 12),
                FadeInUp(
                  duration: const Duration(milliseconds: 400),
                  delay: const Duration(milliseconds: 500),
                  child: _settingsGroup([
                    _actionTile(
                      icon: Icons.business_outlined,
                      color: Colors.orangeAccent,
                      title: 'Switch School',
                      subtitle: 'Connect to a different workspace',
                      onTap: _switchSchool,
                    ),
                    _divider(),
                    _actionTile(
                      icon: Icons.power_settings_new_rounded,
                      color: Colors.redAccent,
                      title: 'Logout',
                      subtitle: 'End current session',
                      onTap: () => auth.logout(),
                    ),
                  ]),
                ),

                const SizedBox(height: 60),
                Center(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'Version 2.0.0 Platinum',
                          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Powered by Pixel Solutions',
                        style: TextStyle(color: Colors.white.withOpacity(0.15), fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliverHeader(String name, String school) {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      backgroundColor: const Color(0xFF020617),
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
        onPressed: () => Navigator.pop(context),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF1e1b4b),
                    Color(0xFF020617),
                  ],
                ),
              ),
            ),
            Positioned(
              top: -50,
              right: -50,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF4f46e5).withOpacity(0.2),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 40),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF4f46e5), width: 2),
                  ),
                  child: const CircleAvatar(
                    radius: 35,
                    backgroundColor: Color(0xFF1e293b),
                    child: Icon(Icons.person_rounded, size: 40, color: Colors.white70),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22),
                ),
                Text(
                  school,
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Text(
            title.toUpperCase(),
            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _settingsGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }

  Widget _toggleTile({required IconData icon, required Color color, required String title, required String subtitle, required bool value, required ValueChanged<bool> onChanged}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
      ),
      trailing: Switch.adaptive(
        value: value,
        onChanged: onChanged,
        activeColor: color,
        activeTrackColor: color.withOpacity(0.3),
      ),
    );
  }

  Widget _infoTile({required IconData icon, required Color color, required String title, required String value, VoidCallback? onCopy}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      onTap: onCopy,
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(title, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
      ),
      trailing: onCopy != null ? Icon(Icons.copy_rounded, color: Colors.white.withOpacity(0.2), size: 18) : null,
    );
  }

  Widget _actionTile({required IconData icon, required Color color, required String title, required String subtitle, required VoidCallback onTap}) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 15)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
      ),
      trailing: Icon(Icons.arrow_forward_ios_rounded, color: Colors.white.withOpacity(0.1), size: 14),
    );
  }

  Widget _divider() => Divider(height: 1, indent: 70, endIndent: 20, color: Colors.white.withOpacity(0.05));

  void _showSnippet(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF1e293b),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
