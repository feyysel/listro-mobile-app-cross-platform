import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../realtime.dart';
import '../roles.dart';
import 'delivery_home_screen.dart';
import 'home_screen.dart';
import 'manager_home_screen.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'operator_home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;
  int _unread = 0;
  StreamSubscription<RealtimeEvent>? _realtimeSub;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.sessionRevision.addListener(_handleSessionChange);
    _realtimeSub = RealtimeClient.instance.events.listen((event) {
      if (event.type == 'notification') _loadUnread();
    });
    RealtimeClient.instance.start();
    _loadUnread();
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    RealtimeClient.instance.stop();
    ApiClient.instance.sessionRevision.removeListener(_handleSessionChange);
    super.dispose();
  }

  Future<void> _loadUnread() async {
    if (!ApiClient.instance.isSignedIn) return;
    try {
      final count = await ApiClient.instance.unreadCount();
      if (mounted) setState(() => _unread = count);
    } catch (_) {}
  }

  void _handleSessionChange() {
    if (!ApiClient.instance.isSignedIn) {
      RealtimeClient.instance.stop();
    }
    if (!ApiClient.instance.isSignedIn && mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (_) => false,
      );
    }
  }

  Widget _homeFor(String role) {
    switch (role) {
      case AppRole.delivery:
        return const DeliveryHomeScreen();
      case AppRole.operator:
        return const OperatorHomeScreen();
      case AppRole.manager:
      case AppRole.admin:
        return const ManagerHomeScreen();
      default:
        return const HomeScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ApiClient.instance.user?.role ?? AppRole.customer;
    final pages = <Widget>[
      _homeFor(role),
      const OrdersScreen(),
      const NotificationsScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (index) => setState(() => _index = index),
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          const BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_rounded), label: 'Orders'),
          BottomNavigationBarItem(
            icon: Badge(
              label: Text('$_unread'),
              isLabelVisible: _unread > 0,
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Updates',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
