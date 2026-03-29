import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

class LocationService extends ChangeNotifier {
  bool _isInside = false;
  Position? _currentPosition;
  double? _distance;
  String? _error;
  StreamSubscription<Position>? _positionStream;

  bool get isInside => _isInside;
  Position? get currentPosition => _currentPosition;
  double? get distance => _distance;
  String? get error => _error;

  /// Starts monitoring the device's location and updates the 'isInside' status 
  /// based on the provided school coordinates and radius.
  Future<void> startMonitoring(double targetLat, double targetLng, double radius) async {
    final hasPermission = await _handlePermission();
    if (!hasPermission) return;

    // Get initial position
    await _updatePosition(targetLat, targetLng, radius);

    // Listen for changes
    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((position) {
      _currentPosition = position;
      _distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        targetLat,
        targetLng,
      );
      _isInside = _distance! <= radius;
      notifyListeners();
    });
  }

  void stopMonitoring() {
    _positionStream?.cancel();
    _positionStream = null;
  }

  Future<bool> _handlePermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _error = 'Location services are disabled.';
      notifyListeners();
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _error = 'Location permissions are denied';
        notifyListeners();
        return false;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      _error = 'Location permissions are permanently denied.';
      notifyListeners();
      return false;
    }

    return true;
  }

  Future<void> _updatePosition(double targetLat, double targetLng, double radius) async {
    try {
      final position = await Geolocator.getCurrentPosition();
      _currentPosition = position;
      _distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        targetLat,
        targetLng,
      );
      _isInside = _distance! <= radius;
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    notifyListeners();
  }

  @override
  void dispose() {
    stopMonitoring();
    super.dispose();
  }
}
