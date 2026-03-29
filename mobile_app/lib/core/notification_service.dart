import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _localNotif =
      FlutterLocalNotificationsPlugin();
  final FlutterTts _tts = FlutterTts();

  bool _initialised = false;

  Future<void> init() async {
    if (_initialised) return;

    // ── Local Notifications ─────────────────────────────────────────
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);
    await _localNotif.initialize(initSettings);

    // Request Android 13+ notification permission
    if (Platform.isAndroid) {
      final androidPlugin = _localNotif
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.requestNotificationsPermission();
    }

    // ── TTS Setup ───────────────────────────────────────────────────
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.48);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);

    _initialised = true;
  }

  /// Show a system banner notification for attendance event.
  Future<void> showAttendanceBanner({
    required String type, // 'IN' or 'OUT'
    required String name,
    required String time,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final soundEnabled = prefs.getBool('sound_enabled') ?? true;

    final isIn = type.toUpperCase() == 'IN';
    final title = isIn ? '✅ Checked In' : '🔴 Checked Out';
    final body = isIn ? '$name checked in at $time' : '$name checked out at $time';

    final androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Attendance Alerts',
      channelDescription: 'Time-in and time-out notifications',
      importance: Importance.max,
      priority: Priority.high,
      playSound: soundEnabled,
      enableVibration: true,
      color: isIn
          ? const Color(0xFF22c55e)
          : const Color(0xFFef4444),
      icon: '@mipmap/ic_launcher',
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    final details =
        NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _localNotif.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      details,
    );
  }

  /// Speak an attendance message via TTS if voice is enabled.
  Future<void> speakAttendance({
    required String type,
    required String name,
    required String time,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final voiceEnabled = prefs.getBool('voice_enabled') ?? true;
    if (!voiceEnabled) return;

    final isIn = type.toUpperCase() == 'IN';
    final greeting = _greeting();
    final message = isIn
        ? '$greeting $name, you have been checked in at $time.'
        : '$greeting $name, you have been checked out at $time. Have a great day!';

    await _tts.stop();
    await _tts.speak(message);
    debugPrint('[TTS] $message');
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> stopSpeech() async => _tts.stop();
}
