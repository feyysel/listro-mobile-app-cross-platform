import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  final Widget next;

  const SplashScreen({super.key, required this.next});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;
  late final Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    _scale = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.55, curve: Curves.elasticOut),
    );
    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.05, 0.45, curve: Curves.easeOut),
    );
    _glow = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.3, 1.0, curve: Curves.easeInOut),
    );
    _controller.forward();
    Future.delayed(const Duration(milliseconds: 2400), _finish);
  }

  void _finish() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => widget.next,
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 450),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0B1220), Color(0xFF16254A), Color(0xFF5B5BD6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 188 + (_glow.value * 46),
                        height: 188 + (_glow.value * 46),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.06 + _glow.value * 0.05),
                        ),
                      ),
                      Container(
                        width: 144 + (_glow.value * 16),
                        height: 144 + (_glow.value * 16),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.1),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                        ),
                      ),
                      ScaleTransition(
                        scale: Tween<double>(begin: 0.35, end: 1).animate(_scale),
                        child: FadeTransition(
                          opacity: _fade,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(32),
                            child: Image.asset(
                              'assets/listro_icon.png',
                              width: 124,
                              height: 124,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                  FadeTransition(
                    opacity: _fade,
                    child: Column(
                      children: [
                        const Text(
                          'LISTRO',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 7,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Shoes cared for, every step of the way',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontSize: 12,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 34),
                  SizedBox(
                    width: 130,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: _controller.value,
                        minHeight: 3,
                        backgroundColor: Colors.white.withValues(alpha: 0.14),
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
