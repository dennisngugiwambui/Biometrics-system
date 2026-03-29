import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:school_biometric_mobile/core/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  late SharedPreferences _prefs;

  String? _token;
  bool _isSetup = false;
  Map<String, dynamic>? _teacherData;
  Map<String, dynamic>? _schoolConfig;

  String? get token => _token;
  bool get isAuthenticated => _token != null;
  bool get isSetup => _isSetup;
  Map<String, dynamic>? get teacherData => _teacherData;
  Map<String, dynamic>? get schoolConfig => _schoolConfig;

  /// Returns the persisted server base URL, trailing-slash-free.
  String get baseUrl =>
      (_prefs.getString('server_url') ?? 'http://localhost:8000')
          .replaceAll(RegExp(r'/+$'), '');

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _token = await _storage.read(key: 'auth_token');
    _isSetup = _prefs.getBool('is_setup') ?? false;

    final teacherJson = await _storage.read(key: 'teacher_data');
    if (teacherJson != null) {
      _teacherData = jsonDecode(teacherJson);
    }

    final configJson = _prefs.getString('school_config');
    if (configJson != null) {
      _schoolConfig = jsonDecode(configJson);
    }

    notifyListeners();
  }

  Future<bool> setupSchool(String schoolCode, {String? serverUrl}) async {
    try {
      _prefs = await SharedPreferences.getInstance();

      // Persist & normalise the server URL (works for http, https, www.xxx.com)
      if (serverUrl != null && serverUrl.isNotEmpty) {
        final trimmed = serverUrl.trim().replaceAll(RegExp(r'/+$'), '');
        await _prefs.setString('server_url', trimmed);
      }

      // Reinit ApiService so subsequent calls use the new base URL
      await ApiService.reinit();

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      ));
      final response = await dio.get(
        '$baseUrl/api/v1/mobile/config',
        queryParameters: {'school_code': schoolCode},
      );

      if (response.statusCode == 200) {
        _schoolConfig = response.data;
        await _prefs.setString('school_code', schoolCode);
        await _prefs.setString('school_config', jsonEncode(_schoolConfig));
        await _prefs.setBool('is_setup', true);
        _isSetup = true;
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Setup error: $e');
    }
    return false;
  }

  Future<bool> login(String phone) async {
    try {
      final schoolCode = _prefs.getString('school_code');
      if (schoolCode == null) return false;

      final response = await ApiService.post(
        '/api/v1/mobile/auth/login',
        data: {
          'phone': phone,
          'school_code': schoolCode,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        _token = data['access_token'];
        _teacherData = {
          'id': data['teacher_id'],
          'name': data['teacher_name'],
          'employee_id': data['employee_id'],
          'school_name': data['school_name'],
        };

        await _storage.write(key: 'auth_token', value: _token);
        await _storage.write(
            key: 'teacher_data', value: jsonEncode(_teacherData));

        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Login error: $e');
    }
    return false;
  }

  Future<void> logout() async {
    _token = null;
    _teacherData = null;
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'teacher_data');
    notifyListeners();
  }

  /// Full reset — clears school config, server URL, token. Returns to setup.
  Future<void> resetSetup() async {
    _token = null;
    _teacherData = null;
    _schoolConfig = null;
    _isSetup = false;

    await _storage.deleteAll();
    await _prefs.clear();
    notifyListeners();
  }
}
