import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static Dio? _dio;
  static const _storage = FlutterSecureStorage();

  /// Returns the base URL persisted during school setup, or localhost fallback.
  static Future<String> _getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_url') ?? 'http://localhost:8000';
  }

  /// Initialise (or reinitialise) the Dio instance with the saved base URL.
  /// Call this once at startup AND after persisting a new server URL.
  static Future<void> init() async {
    final baseUrl = await _getBaseUrl();
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ));

    _dio!.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'auth_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  /// Re-initialise with a new base URL (called after school setup).
  static Future<void> reinit() => init();

  static Dio get dio {
    if (_dio == null) {
      throw StateError(
          'ApiService not initialised. Call ApiService.init() first.');
    }
    return _dio!;
  }

  static Future<Response> get(String path,
      {Map<String, dynamic>? query}) async {
    return dio.get(path, queryParameters: query);
  }

  static Future<Response> post(String path, {dynamic data}) async {
    return dio.post(path, data: data);
  }
}
