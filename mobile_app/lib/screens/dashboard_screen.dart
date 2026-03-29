import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:animate_do/animate_do.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:school_biometric_mobile/core/auth_provider.dart';
import 'package:school_biometric_mobile/core/location_service.dart';
import 'package:school_biometric_mobile/core/api_service.dart';
import 'package:school_biometric_mobile/core/notification_service.dart';
import 'package:school_biometric_mobile/screens/reports_screen.dart';
import 'package:school_biometric_mobile/screens/settings_screen.dart';
import 'dart:math' as math;

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  bool _isActionLoading = false;
  Map<String, dynamic>? _lastRecord;
  List<dynamic> _history = [];
  int _selectedTab = 0; // 0=Overview, 1=Teacher Logs
  late AnimationController _radarController;

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initLocationMonitoring();
      _fetchHistory();
    });
  }

  @override
  void dispose() {
    _radarController.dispose();
    super.dispose();
  }

  void _initLocationMonitoring() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final location = Provider.of<LocationService>(context, listen: false);
    final school = auth.schoolConfig;
    if (school != null) {
      location.startMonitoring(
        (school['geofence_lat'] as num?)?.toDouble() ?? -1.286389,
        (school['geofence_lng'] as num?)?.toDouble() ?? 36.817223,
        (school['geofence_radius_m'] as num?)?.toDouble() ?? 150.0,
      );
    }
  }

  Future<void> _fetchHistory() async {
    try {
      final response = await ApiService.get('/api/v1/mobile/attendance/me');
      if (response.statusCode == 200 && mounted) {
        setState(() {
          _history = response.data is List ? response.data : [];
          _lastRecord = _history.isNotEmpty ? _history.first : null;
        });
      }
    } catch (e) {
      debugPrint("Fetch error: $e");
    }
  }

  Future<void> _handleAttendance(String type) async {
    final location = Provider.of<LocationService>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    if (!location.isInside) {
      HapticFeedback.heavyImpact();
      _showSnack("You are outside school premises!", Colors.redAccent);
      return;
    }

    setState(() => _isActionLoading = true);
    HapticFeedback.mediumImpact();

    try {
      final response = await ApiService.post(
        '/api/v1/mobile/attendance/check-in',
        data: {
          'event_type': type,
          'latitude': location.currentPosition?.latitude,
          'longitude': location.currentPosition?.longitude,
          'accuracy': location.currentPosition?.accuracy,
        },
      );

      if (response.statusCode == 200) {
        await _fetchHistory();
        final name = auth.teacherData?['name'] ?? 'Teacher';
        final time = DateFormat('hh:mm a').format(DateTime.now());

        // Fire voice + banner notification
        await NotificationService.instance.showAttendanceBanner(
          type: type, name: name, time: time,
        );
        await NotificationService.instance.speakAttendance(
          type: type, name: name, time: time,
        );

        _showSnack(
          type == 'IN' ? "✅ Checked in successfully!" : "👋 Checked out!",
          type == 'IN' ? const Color(0xFF22c55e) : Colors.orangeAccent,
        );
      }
    } catch (e) {
      _showSnack("Error: ${e.toString()}", Colors.redAccent);
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(width: 4),
            Expanded(child: Text(msg, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final location = Provider.of<LocationService>(context);
    final teacher = auth.teacherData;
    final isCheckedIn = _lastRecord?['event_type'] == 'IN';

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildAppBar(teacher?['name'] ?? "Teacher", auth.schoolConfig?['school_name'] ?? ''),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  const SizedBox(height: 4),
                  _buildTabBar(),
                  const SizedBox(height: 20),
                  if (_selectedTab == 0) ...[
                    _buildStatusCard(isCheckedIn),
                    const SizedBox(height: 16),
                    _buildQuickStats(),
                    const SizedBox(height: 16),
                    _buildGeofenceCard(location),
                    const SizedBox(height: 20),
                    _buildActionButtons(isCheckedIn, location.isInside),
                    const SizedBox(height: 20),
                    _buildShortcutsRow(context),
                    const SizedBox(height: 24),
                    _buildWeeklyChart(),
                    const SizedBox(height: 24),
                    _buildRecentActivity(),
                  ] else ...[
                    _buildTeacherLogs(),
                  ],
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar(String name, String schoolName) {
    return SliverAppBar(
      expandedHeight: 150,
      floating: false,
      pinned: true,
      backgroundColor: const Color(0xFF020617),
      actions: [
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.settings_rounded, color: Colors.white, size: 20),
          ),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const SettingsScreen()),
          ),
        ),
        const SizedBox(width: 8),
      ],
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Hi, ${name.split(' ').first} 👋",
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Colors.white)),
            Text(schoolName,
                style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5))),
          ],
        ),
        background: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF3b82f6).withOpacity(0.2),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            Positioned(
              right: -40, top: -40,
              child: Container(
                height: 200, width: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    const Color(0xFF6366f1).withOpacity(0.1),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    final tabs = ['Overview', 'Attendance Logs'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: List.generate(tabs.length, (i) {
          final active = _selectedTab == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: active
                      ? const LinearGradient(
                          colors: [Color(0xFF3b82f6), Color(0xFF6366f1)])
                      : null,
                  boxShadow: active
                      ? [BoxShadow(
                          color: const Color(0xFF3b82f6).withOpacity(0.3),
                          blurRadius: 12)]
                      : [],
                ),
                child: Text(
                  tabs[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: active ? Colors.white : Colors.white.withOpacity(0.45),
                    fontWeight: active ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStatusCard(bool isCheckedIn) {
    final color = isCheckedIn ? const Color(0xFF22c55e) : Colors.orangeAccent;
    return FadeInDown(
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [color.withOpacity(0.15), color.withOpacity(0.05)],
          ),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Row(
          children: [
            // Pulsing ring
            Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _radarController,
                  builder: (_, __) => Container(
                    height: 80,
                    width: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: color.withOpacity(
                            0.3 * (1 - _radarController.value)),
                        width: 2,
                      ),
                    ),
                  ),
                ),
                Container(
                  height: 60,
                  width: 60,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: color.withOpacity(0.4),
                          blurRadius: 20, spreadRadius: 2)
                    ],
                  ),
                  child: Icon(
                    isCheckedIn
                        ? Icons.how_to_reg_rounded
                        : Icons.time_to_leave_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isCheckedIn ? "CURRENTLY ACTIVE" : "SIGNED OUT",
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isCheckedIn ? "Working shift" : "Off duty",
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.access_time_rounded,
                          size: 13, color: Colors.white.withOpacity(0.4)),
                      const SizedBox(width: 4),
                      Text(
                        _lastRecord != null
                            ? "Last: ${DateFormat('hh:mm a').format(DateTime.parse(_lastRecord!['scanned_at']).toLocal())}"
                            : "No activity today",
                        style: TextStyle(
                            color: Colors.white.withOpacity(0.45), fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickStats() {
    final todayLogs = _history.where((h) {
      final d = DateTime.tryParse(h['scanned_at'] ?? '');
      return d != null && DateUtils.isSameDay(d, DateTime.now());
    }).toList();

    final checkIn = todayLogs.lastWhereOrNull((h) => h['event_type'] == 'IN');
    final checkOut = todayLogs.firstWhereOrNull((h) => h['event_type'] == 'OUT');

    Duration? hours;
    if (checkIn != null && checkOut != null) {
      final inTime = DateTime.parse(checkIn['scanned_at']).toLocal();
      final outTime = DateTime.parse(checkOut['scanned_at']).toLocal();
      hours = outTime.difference(inTime);
    }

    return FadeInDown(
      delay: const Duration(milliseconds: 80),
      child: Row(
        children: [
          _statCard(
            icon: Icons.login_rounded,
            iconColor: const Color(0xFF3b82f6),
            label: 'Time In',
            value: checkIn != null
                ? DateFormat('hh:mm a').format(DateTime.parse(checkIn['scanned_at']).toLocal())
                : '--:--',
          ),
          const SizedBox(width: 12),
          _statCard(
            icon: Icons.logout_rounded,
            iconColor: Colors.orangeAccent,
            label: 'Time Out',
            value: checkOut != null
                ? DateFormat('hh:mm a').format(DateTime.parse(checkOut['scanned_at']).toLocal())
                : '--:--',
          ),
          const SizedBox(width: 12),
          _statCard(
            icon: Icons.timer_rounded,
            iconColor: const Color(0xFF10b981),
            label: 'Hours',
            value: hours != null
                ? '${hours.inHours}h ${hours.inMinutes % 60}m'
                : '--',
          ),
        ],
      ),
    );
  }

  Widget _statCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Column(
          children: [
            Icon(icon, color: iconColor, size: 22),
            const SizedBox(height: 8),
            Text(value,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14)),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.4), fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _buildGeofenceCard(LocationService location) {
    final distance = location.distance;
    final isInside = location.isInside;
    final color = isInside ? const Color(0xFF3b82f6) : Colors.redAccent;

    return FadeInUp(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            // Radar sweep animation
            SizedBox(
              height: 48,
              width: 48,
              child: AnimatedBuilder(
                animation: _radarController,
                builder: (_, __) {
                  return CustomPaint(
                    painter: _RadarPainter(
                      progress: _radarController.value,
                      color: color,
                      isActive: isInside,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isInside ? "Within School Premises" : "Outside School Premises",
                    style: TextStyle(
                        color: color, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    distance != null
                        ? "${distance.toStringAsFixed(0)} meters from school"
                        : "Acquiring GPS...",
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.45), fontSize: 12),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withOpacity(0.3)),
              ),
              child: Text(
                isInside ? "IN RANGE" : "OUT",
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w800, fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(bool isCheckedIn, bool isInside) {
    return Row(
      children: [
        Expanded(
          child: _actionButton(
            label: "TIME IN",
            sublabel: "Start shift",
            icon: Icons.how_to_reg_rounded,
            gradient: const [Color(0xFF3b82f6), Color(0xFF1d4ed8)],
            glowColor: const Color(0xFF3b82f6),
            isActive: !isCheckedIn && isInside,
            onTap: () => _handleAttendance("IN"),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _actionButton(
            label: "TIME OUT",
            sublabel: "End shift",
            icon: Icons.time_to_leave_rounded,
            gradient: [Colors.redAccent, Colors.red.shade800],
            glowColor: Colors.redAccent,
            isActive: isCheckedIn && isInside,
            onTap: () => _handleAttendance("OUT"),
          ),
        ),
      ],
    );
  }

  Widget _actionButton({
    required String label,
    required String sublabel,
    required IconData icon,
    required List<Color> gradient,
    required Color glowColor,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: isActive && !_isActionLoading ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(vertical: 26),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: isActive
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradient,
                )
              : null,
          color: isActive ? null : Colors.white.withOpacity(0.03),
          border: Border.all(
              color: isActive
                  ? glowColor.withOpacity(0.5)
                  : Colors.white.withOpacity(0.07)),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: glowColor.withOpacity(0.35),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  )
                ]
              : [],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _isActionLoading && isActive
                ? const SizedBox(
                    height: 32, width: 32,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white))
                : Icon(icon,
                    color: isActive ? Colors.white : Colors.white12, size: 34),
            const SizedBox(height: 10),
            Text(label,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: isActive ? Colors.white : Colors.white12,
                  letterSpacing: 1.2,
                  fontSize: 13,
                )),
            const SizedBox(height: 2),
            Text(sublabel,
                style: TextStyle(
                  color: isActive
                      ? Colors.white.withOpacity(0.6)
                      : Colors.white.withOpacity(0.1),
                  fontSize: 10,
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildShortcutsRow(BuildContext context) {
    return Row(
      children: [
        _shortcutCard(
          icon: Icons.assignment_outlined,
          label: 'Reports',
          color: const Color(0xFF6366f1),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ReportsScreen()),
          ),
        ),
        const SizedBox(width: 12),
        _shortcutCard(
          icon: Icons.settings_rounded,
          label: 'Settings',
          color: const Color(0xFF10b981),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const SettingsScreen()),
          ),
        ),
        const SizedBox(width: 12),
        _shortcutCard(
          icon: Icons.refresh_rounded,
          label: 'Refresh',
          color: Colors.orangeAccent,
          onTap: _fetchHistory,
        ),
      ],
    );
  }

  Widget _shortcutCard({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 6),
              Text(label,
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWeeklyChart() {
    return FadeInUp(
      child: Container(
        height: 220,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text("Weekly Activity",
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.white)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3b82f6).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text("This Week",
                      style: TextStyle(
                          color: Color(0xFF3b82f6),
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                )
              ],
            ),
            const SizedBox(height: 20),
            Expanded(
              child: LineChart(LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: Colors.white.withOpacity(0.04),
                    strokeWidth: 1,
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (val, _) {
                        const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                        return Text(
                          val.toInt() < days.length ? days[val.toInt()] : '',
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.3), fontSize: 11),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: const [
                      FlSpot(0, 7.8), FlSpot(1, 8.1), FlSpot(2, 7.95),
                      FlSpot(3, 8.3), FlSpot(4, 8.0), FlSpot(5, 0), FlSpot(6, 0),
                    ],
                    isCurved: true,
                    gradient: const LinearGradient(
                        colors: [Color(0xFF3b82f6), Color(0xFF6366f1)]),
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                        radius: spot.y > 0 ? 4 : 0,
                        color: const Color(0xFF3b82f6),
                        strokeWidth: 2,
                        strokeColor: Colors.white,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF3b82f6).withOpacity(0.2),
                          Colors.transparent,
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ],
              )),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentActivity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text("Recent Activity",
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: Colors.white)),
            const Spacer(),
            TextButton(
              onPressed: () => setState(() => _selectedTab = 1),
              child: const Text("See all",
                  style: TextStyle(
                      color: Color(0xFF3b82f6), fontSize: 13)),
            )
          ],
        ),
        const SizedBox(height: 12),
        if (_history.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  Icon(Icons.history_rounded,
                      color: Colors.white.withOpacity(0.15), size: 48),
                  const SizedBox(height: 12),
                  Text("No activity yet",
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.3), fontSize: 14)),
                ],
              ),
            ),
          )
        else
          ..._history.take(5).map((log) => _buildActivityTile(log)),
      ],
    );
  }

  Widget _buildActivityTile(Map<String, dynamic> log) {
    final date = DateTime.parse(log['scanned_at']).toLocal();
    final isIN = log['event_type'] == 'IN';
    final accentColor =
        isIN ? const Color(0xFF3b82f6) : Colors.orangeAccent;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accentColor.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: accentColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              isIN ? Icons.how_to_reg_rounded : Icons.time_to_leave_rounded,
              color: accentColor, size: 22),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isIN ? "Checked In" : "Checked Out",
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Colors.white)),
                const SizedBox(height: 2),
                Text(DateFormat('EEEE, MMM dd').format(date),
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.4), fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                DateFormat('hh:mm a').format(date),
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: Colors.white),
              ),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isIN ? "In" : "Out",
                  style: TextStyle(
                      color: accentColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTeacherLogs() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.07)),
          ),
          child: Row(
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
                  const Text("Your Attendance Log",
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: Colors.white)),
                  Text("Full time-in / time-out history",
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.4), fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (_history.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                children: [
                  Icon(Icons.event_note_rounded,
                      size: 60, color: Colors.white.withOpacity(0.1)),
                  const SizedBox(height: 16),
                  Text("No attendance records found",
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.3), fontSize: 15)),
                ],
              ),
            ),
          )
        else
          ..._history.map((log) => _buildDetailedLogTile(log)),
      ],
    );
  }

  Widget _buildDetailedLogTile(Map<String, dynamic> log) {
    final date = DateTime.parse(log['scanned_at']).toLocal();
    final isIN = log['event_type'] == 'IN';
    final accentColor = isIN ? const Color(0xFF22c55e) : Colors.orangeAccent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 44,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isIN ? "Time In" : "Time Out",
                  style: TextStyle(
                      color: accentColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('EEEE, MMMM d, yyyy').format(date),
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.45), fontSize: 11),
                ),
              ],
            ),
          ),
          Text(
            DateFormat('hh:mm a').format(date),
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

// ── Radar sweep custom painter ─────────────────────────────────────────
class _RadarPainter extends CustomPainter {
  final double progress;
  final Color color;
  final bool isActive;

  _RadarPainter({required this.progress, required this.color, required this.isActive});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Outer ring
    canvas.drawCircle(
      center, radius,
      Paint()
        ..color = color.withOpacity(0.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Inner ring
    canvas.drawCircle(
      center, radius * 0.6,
      Paint()
        ..color = color.withOpacity(0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    // Sweep gradient
    if (isActive) {
      final sweepAngle = 2 * math.pi * progress;
      final sweepPaint = Paint()
        ..shader = SweepGradient(
          startAngle: sweepAngle - 0.8,
          endAngle: sweepAngle,
          colors: [Colors.transparent, color.withOpacity(0.5)],
        ).createShader(Rect.fromCircle(center: center, radius: radius))
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center, radius, sweepPaint);
    }
    // Center dot
    canvas.drawCircle(
      center, 5,
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(_RadarPainter old) => old.progress != progress;
}

extension _ListExt<T> on List<T> {
  T? lastWhereOrNull(bool Function(T) test) {
    for (var i = length - 1; i >= 0; i--) {
      if (test(this[i])) return this[i];
    }
    return null;
  }

  T? firstWhereOrNull(bool Function(T) test) {
    for (final e in this) {
      if (test(e)) return e;
    }
    return null;
  }
}
