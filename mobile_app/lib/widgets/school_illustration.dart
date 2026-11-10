import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Brand greens shared by the sign-in screens.
class AuthColors {
  static const g50 = Color(0xFFF0FDF4);
  static const g100 = Color(0xFFDCFCE7);
  static const g200 = Color(0xFFBBF7D0);
  static const g300 = Color(0xFF86EFAC);
  static const g500 = Color(0xFF22C55E);
  static const g600 = Color(0xFF16A34A);
  static const g700 = Color(0xFF15803D);
  static const g900 = Color(0xFF14532D);
  static const ink = Color(0xFF1F2937);
  static const line = Color(0xFF94A3B8);
  static const dot = Color(0xFFCBD5E1);
  static const hill = Color(0xFFE9EEEC);
  static const skin = Color(0xFFE8A383);
  static const slate900 = Color(0xFF0F172A);
  static const slate500 = Color(0xFF64748B);
  static const slate300 = Color(0xFFCBD5E1);
}

/// A flat school scene — the school with its flag, trees and a learner holding
/// a book — drawn natively (no SVG package needed) and gently animated:
/// drifting clouds, a waving flag, a swaying tree, a ticking clock and a
/// learner who breathes and glances up. The same picture as the web sign-in.
class SchoolIllustration extends StatefulWidget {
  const SchoolIllustration({super.key, this.animate = true});

  final bool animate;

  @override
  State<SchoolIllustration> createState() => _SchoolIllustrationState();
}

class _SchoolIllustrationState extends State<SchoolIllustration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 12),
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduceMotion && _c.isAnimating) _c.stop();
    return AspectRatio(
      aspectRatio: 520 / 440,
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, __) => CustomPaint(painter: _ScenePainter(_c.value)),
        ),
      ),
    );
  }
}

class _ScenePainter extends CustomPainter {
  _ScenePainter(this.t);

  /// 0..1 over a 12-second loop.
  final double t;

  // A smooth wave that completes [cycles] whole periods per loop, so the
  // animation joins up seamlessly when the controller wraps around.
  double _wave(int cycles, [double phase = 0]) =>
      math.sin((t * cycles + phase) * 2 * math.pi);

  Paint _fill(Color c, [double opacity = 1]) => Paint()
    ..color = c.withOpacity(opacity)
    ..style = PaintingStyle.fill
    ..isAntiAlias = true;

  Paint _stroke(Color c, double w, {bool round = false}) => Paint()
    ..color = c
    ..style = PaintingStyle.stroke
    ..strokeWidth = w
    ..strokeCap = round ? StrokeCap.round : StrokeCap.butt
    ..isAntiAlias = true;

  Path _poly(List<double> pts) {
    final p = Path()..moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) {
      p.lineTo(pts[i], pts[i + 1]);
    }
    return p..close();
  }

  void _rotated(Canvas canvas, Offset pivot, double radians, VoidCallback draw) {
    canvas.save();
    canvas.translate(pivot.dx, pivot.dy);
    canvas.rotate(radians);
    canvas.translate(-pivot.dx, -pivot.dy);
    draw();
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 520, size.height / 440);

    const ink = AuthColors.ink;

    // ── sky ───────────────────────────────────────────────────────────
    final sun = 48 * (1 + 0.05 * _wave(2));
    canvas.drawCircle(const Offset(96, 88), sun, _fill(AuthColors.g200, .75));
    canvas.drawCircle(const Offset(430, 70), 18, _fill(AuthColors.g100));
    canvas.drawOval(
        Rect.fromCenter(center: Offset(150 + 20 * _wave(1), 104), width: 68, height: 22),
        _fill(Colors.white, .85));
    canvas.drawOval(
        Rect.fromCenter(center: Offset(392 - 16 * _wave(1, .3), 118), width: 56, height: 18),
        _fill(Colors.white, .85));

    // ── hills ─────────────────────────────────────────────────────────
    canvas.drawPath(_poly([0, 330, 92, 236, 132, 270, 196, 196, 270, 290, 0, 300]),
        _fill(AuthColors.hill));
    canvas.drawPath(_poly([196, 196, 214, 214, 204, 222, 188, 206]), _fill(Colors.white, .9));
    canvas.drawPath(_poly([300, 300, 382, 214, 430, 258, 470, 222, 520, 270, 520, 310]),
        _fill(AuthColors.hill));

    // ── school ────────────────────────────────────────────────────────
    final wall = RRect.fromRectAndRadius(const Rect.fromLTWH(150, 214, 214, 146), const Radius.circular(3));
    canvas.drawRRect(wall, _fill(Colors.white));
    canvas.drawRRect(wall, _stroke(AuthColors.dot, 2));
    canvas.drawPath(_poly([138, 218, 257, 150, 376, 218]), _fill(AuthColors.g700));
    canvas.drawPath(_poly([160, 214, 257, 160, 354, 214]), _fill(AuthColors.g500, .35));

    // clock
    canvas.drawCircle(const Offset(257, 194), 13, _fill(Colors.white));
    canvas.drawCircle(const Offset(257, 194), 13, _stroke(AuthColors.g900, 2.5));
    final hands = _stroke(AuthColors.g900, 2.5, round: true);
    _rotated(canvas, const Offset(257, 194), t * 2 * math.pi, () {
      canvas.drawLine(const Offset(257, 194), const Offset(257, 186), hands);
    });
    canvas.drawLine(const Offset(257, 194), const Offset(263, 198), hands);

    // flag
    canvas.drawLine(const Offset(257, 150), const Offset(257, 108), _stroke(ink, 2.5));
    final f = 6 * _wave(5);
    final flag = Path()
      ..moveTo(258, 110)
      ..cubicTo(270, 104 + f, 278, 116 - f, 292, 110 + f * .5)
      ..lineTo(292, 128 + f * .5)
      ..cubicTo(278, 134 - f, 270, 122 + f, 258, 128)
      ..close();
    canvas.drawPath(flag, _fill(AuthColors.g500));

    // windows — each lights up warmly now and then
    const xs = [166.0, 202.0, 284.0, 320.0];
    for (var i = 0; i < xs.length; i++) {
      final x = xs[i];
      final glow = math.max(0.0, _wave(2, i * .23)) ;
      final lit = Color.lerp(AuthColors.g100, const Color(0xFFFEF9C3), glow > .92 ? 1 : 0)!;
      for (final y in [236.0, 292.0]) {
        final r = RRect.fromRectAndRadius(Rect.fromLTWH(x, y, 28, 34), const Radius.circular(3));
        canvas.drawRRect(r, _fill(y == 236 ? lit : AuthColors.g100));
        canvas.drawRRect(r, _stroke(AuthColors.g300, 2));
      }
      canvas.drawLine(Offset(x + 14, 236), Offset(x + 14, 270), _stroke(AuthColors.g300, 2));
    }

    // door
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(240, 290, 36, 70), const Radius.circular(3)), _fill(ink));
    canvas.drawCircle(const Offset(268, 326), 2.5, _fill(AuthColors.g300));
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(232, 356, 52, 6), const Radius.circular(2)), _fill(AuthColors.dot));

    // ── dotted shrub, left ────────────────────────────────────────────
    final shrub = _stroke(AuthColors.line, 1.6);
    canvas.drawPath(Path()..moveTo(70, 360)..cubicTo(68, 330, 74, 300, 92, 268), shrub);
    canvas.drawLine(const Offset(78, 318), const Offset(58, 294), shrub);
    canvas.drawLine(const Offset(84, 300), const Offset(104, 282), shrub);
    canvas.drawLine(const Offset(74, 338), const Offset(52, 322), shrub);
    for (final o in const [Offset(92, 264), Offset(56, 290), Offset(106, 278), Offset(50, 318), Offset(100, 300)]) {
      canvas.drawCircle(o, 5.5, _fill(AuthColors.dot));
    }

    // ── tree, right (sways from its trunk) ────────────────────────────
    canvas.drawLine(const Offset(470, 360), const Offset(470, 268), _stroke(ink, 3));
    _rotated(canvas, const Offset(470, 300), 0.04 * _wave(2), () {
      final br = _stroke(ink, 2.5, round: true);
      canvas.drawLine(const Offset(470, 300), const Offset(452, 282), br);
      canvas.drawLine(const Offset(470, 288), const Offset(488, 272), br);
      canvas.drawCircle(const Offset(470, 246), 34, _fill(AuthColors.g300));
      canvas.drawCircle(const Offset(452, 232), 18, _fill(AuthColors.g500, .55));
      canvas.drawCircle(const Offset(488, 258), 6, _fill(ink));
      canvas.drawCircle(const Offset(452, 270), 6, _fill(ink));
    });

    // ── learner with a book ───────────────────────────────────────────
    canvas.drawPath(_poly([398, 360, 404, 302, 414, 302, 412, 360]), _fill(ink));
    canvas.drawPath(_poly([418, 360, 418, 302, 428, 302, 432, 360]), _fill(ink));
    canvas.drawPath(_poly([396, 362, 414, 362, 414, 368, 392, 368]), _fill(ink));
    canvas.drawPath(_poly([416, 362, 434, 362, 438, 368, 416, 368]), _fill(ink));

    canvas.save();
    canvas.translate(0, -1.5 * (0.5 + 0.5 * _wave(4)));
    final body = Path()
      ..moveTo(396, 304)
      ..cubicTo(394, 270, 398, 246, 414, 240)
      ..cubicTo(430, 246, 436, 270, 434, 304)
      ..close();
    canvas.drawPath(body, _fill(AuthColors.g700));
    canvas.drawPath(_poly([407, 242, 414, 256, 421, 242]), _fill(Colors.white));
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(408, 226, 12, 16), const Radius.circular(5)), _fill(AuthColors.skin));

    // head — glances up from the book once a loop
    final nodPhase = (t * 2) % 1;
    final nod = nodPhase > .75 && nodPhase < .95 ? math.sin((nodPhase - .75) / .2 * math.pi) * .1 : 0.0;
    _rotated(canvas, const Offset(414, 231), nod, () {
      canvas.drawCircle(const Offset(414, 216), 15, _fill(AuthColors.skin));
      final hair = Path()
        ..moveTo(399, 214)
        ..cubicTo(399, 196, 428, 194, 430, 212)
        ..cubicTo(424, 206, 412, 206, 406, 214)
        ..close();
      canvas.drawPath(hair, _fill(ink));
    });

    // book held open
    final left = _poly([388, 268, 412, 274, 412, 296, 388, 290]);
    final right = _poly([412, 274, 436, 268, 436, 290, 412, 296]);
    canvas.drawPath(left, _fill(Colors.white));
    canvas.drawPath(left, _stroke(ink, 1.8));
    canvas.drawPath(right, _fill(AuthColors.g100));
    canvas.drawPath(right, _stroke(ink, 1.8));
    final arm = _stroke(AuthColors.skin, 6, round: true);
    canvas.drawPath(Path()..moveTo(394, 262)..cubicTo(390, 270, 392, 280, 398, 284), arm);
    canvas.drawPath(Path()..moveTo(434, 262)..cubicTo(438, 270, 436, 280, 430, 284), arm);
    canvas.restore();

    // ── ground ────────────────────────────────────────────────────────
    canvas.drawLine(const Offset(24, 362), const Offset(500, 362), _stroke(AuthColors.line, 1.6));

    // ── leaves, front left (sway from the base) ───────────────────────
    _rotated(canvas, const Offset(140, 362), 0.045 * _wave(2, .4), () {
      final a = Path()
        ..moveTo(140, 362)
        ..cubicTo(112, 330, 108, 300, 120, 276)
        ..cubicTo(150, 296, 160, 330, 140, 362)
        ..close();
      canvas.drawPath(a, _fill(AuthColors.g300));
      canvas.drawPath(a, _stroke(ink, 1.4));
      final b = Path()
        ..moveTo(144, 362)
        ..cubicTo(150, 320, 170, 296, 196, 288)
        ..cubicTo(196, 322, 176, 350, 144, 362)
        ..close();
      canvas.drawPath(b, _fill(ink));
      final c = Path()
        ..moveTo(138, 362)
        ..cubicTo(120, 342, 92, 336, 72, 340)
        ..cubicTo(86, 360, 112, 368, 138, 362)
        ..close();
      canvas.drawPath(c, _fill(AuthColors.g200));
      canvas.drawPath(c, _stroke(ink, 1.4));
      canvas.drawLine(const Offset(140, 362), const Offset(122, 290), _stroke(ink, 1.2));
    });

    // ── small flower ──────────────────────────────────────────────────
    canvas.drawLine(const Offset(372, 362), const Offset(372, 338), _stroke(ink, 1.6));
    canvas.drawCircle(const Offset(372, 334), 5, _fill(ink));
    canvas.drawCircle(const Offset(360, 352), 3, _fill(const Color(0xFFF43F5E)));

    canvas.restore();
  }

  @override
  bool shouldRepaint(_ScenePainter old) => old.t != t;
}
