import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

class GeofenceService extends ChangeNotifier {
  bool _isInside = false;
  Position? _currentPosition;
  double? _distance;
  String? _error;

  bool get isInside => _isInside;
  Position? get currentPosition => _currentPosition;
  double? get distance => _distance;
  String? get error => _error;

  Future<void> checkLocation(double targetLat, double targetLng, double radius) async {
    try {
      final status = await Permission.location.request();
      if (!status.isGranted) {
        _error = "Location permission denied";
        notifyListeners();
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      
      _currentPosition = position;
      _distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        targetLat,
        targetLng,
      );

      _isInside = _distance! <= radius;
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
